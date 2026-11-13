import prisma from '../../core/database/prisma.js';
import logger from '../../core/logger/index.js';
import { getRuleActionsQueue } from '../../core/queues/index.js';
import { getSharedRedis, isRedisEnabled } from '../../core/redis.js';
import { MAX_EVENT_DEPTH } from './domainEvents.js';
import { triggerMatches } from './ruleRegistry.js';
import { evaluateConditions } from './conditionEvaluator.js';
import { executeAction } from './actionExecutor.js';
import { buildRuleContext } from './systemActor.js';
import { emailService } from '../email/emailService.js';
import config from '../../core/config/index.js';

/**
 * Two-stage engine, one function per BullMQ queue (wired up in worker.js):
 *
 *   matchEvent()  — rule-events queue.  Which rules does this event trigger,
 *                   filtered by the loop guards and the rule's conditions?
 *                   Enqueues one rule-actions job per surviving match.
 *   applyRule()   — rule-actions queue. Runs one rule's action list in order
 *                   against the task, records a RuleRun, updates rule stats.
 *
 * Splitting them means a slow action never blocks matching for other tasks,
 * per action list retries independently of the matching step, and — the part
 * that actually matters here — every rule this event could match gets a
 * verdict (a RuleRun row, even for a skip) before any of them start writing.
 *
 * Loop guards, all four:
 *   1. No-op suppression   — domainEvents.diffTaskUpdate (Phase 1). A save
 *      that doesn't change anything records no event at all.
 *   2. Depth cap            — checked below, MAX_EVENT_DEPTH hops per chain.
 *   3. Chain guard           — checked below, a rule fires at most once per chain.
 *   4. RuleRun idempotency  — the (ruleId, eventId) unique constraint, claimed
 *      before applyRule executes anything, so a BullMQ retry can't double-apply.
 *
 * Two more safety nets, independent of loop guards:
 *   - Per-workspace rate limit — caps total rule-actions/minute per workspace
 *     (a Redis counter, checked before claiming a RuleRun) so one workspace's
 *     misbehaving rules can't starve every other workspace sharing this worker.
 *   - Auto-disable on repeated failure — a rule that fails RULE_AUTO_DISABLE_
 *     THRESHOLD times in a row (not lifetime — any success resets the streak)
 *     gets turned off and its creator emailed, instead of failing silently
 *     forever every time its trigger fires.
 */

// ── Per-workspace rate limit ──────────────────────────────────────────────
const RATE_LIMIT_PER_MINUTE = parseInt(process.env.RULE_WORKSPACE_RATE_LIMIT, 10) || 60;
// Short retry, not a full minute — keeps a briefly-throttled action's latency
// reasonable while still capping sustained throughput per workspace.
const RATE_LIMIT_REQUEUE_DELAY_MS = parseInt(process.env.RULE_RATE_LIMIT_REQUEUE_DELAY_MS, 10) || 15000;

async function isWorkspaceRateLimited(workspaceId) {
  if (!isRedisEnabled()) return false;
  const redis = getSharedRedis();
  const bucket = Math.floor(Date.now() / 60000); // current minute
  const key = `rule-rate:${workspaceId}:${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 90); // outlives the bucket; cheap self-cleanup

  if (count > RATE_LIMIT_PER_MINUTE) {
    // Release the reservation this attempt just took. Without this, every
    // denied check (including the deferred retries of an already-denied
    // action) keeps incrementing the same counter it's failing against —
    // count only ever goes up, so once a workspace is denied once it stays
    // denied for the rest of the minute regardless of the actual limit,
    // instead of correctly reopening on the next minute's fresh bucket.
    // Decrementing keeps the counter equal to "how many actions this minute
    // actually got allowed through," which is the number the limit is meant
    // to cap.
    await redis.decr(key);
    return true;
  }
  return false;
}

// ── Auto-disable on repeated failure ──────────────────────────────────────
const AUTO_DISABLE_THRESHOLD = parseInt(process.env.RULE_AUTO_DISABLE_THRESHOLD, 10) || 5;

async function notifyRuleAutoDisabled(rule) {
  const creator = await prisma.user.findUnique({ where: { id: rule.createdById }, select: { email: true, name: true } });
  if (!creator?.email) return;
  const link = `${config.frontendUrl}/rules`;
  await emailService.sendRuleDisabledEmail(creator.email, creator.name, rule.name, link);
}

const TASK_SNAPSHOT_INCLUDE = {
  assignees: { select: { userId: true } },
  tags: { select: { id: true, name: true } }
};

const loadTaskSnapshot = (taskId) =>
  taskId ? prisma.task.findUnique({ where: { id: taskId }, include: TASK_SNAPSHOT_INCLUDE }) : null;

// Writes a RuleRun for an event the engine considered but did not act on.
// Duplicate skip rows (from a rule-events retry) hit the same unique
// constraint as a real run and are silently dropped — harmless, no side
// effects to double up on.
async function recordSkip({ ruleId, eventId, chainId, taskId, status }) {
  try {
    await prisma.ruleRun.create({ data: { ruleId, eventId, chainId, taskId, status } });
  } catch (err) {
    if (err.code !== 'P2002') throw err;
  }
}

// ── Stage 1: match (rule-events queue) ────────────────────────────────────
export async function matchEvent({ eventId, type, workspaceId, projectId, payload }) {
  const chainId = payload?.chainId;
  const depth = payload?.depth ?? 0;
  const taskId = payload?.taskId;

  const rules = await prisma.rule.findMany({
    where: { workspaceId, enabled: true, OR: [{ projectId }, { projectId: null }] }
  });

  const matched = rules.filter((rule) => triggerMatches(rule.trigger, { type, payload }));
  if (!matched.length) return { matched: 0, enqueued: 0 };

  const actionsQueue = getRuleActionsQueue();
  let enqueued = 0;
  let snapshot; // loaded lazily, once, only if a rule survives the cheap guards first

  for (const rule of matched) {
    if (depth >= MAX_EVENT_DEPTH) {
      await recordSkip({ ruleId: rule.id, eventId, chainId, taskId, status: 'SKIPPED_DEPTH' });
      continue;
    }

    if (chainId) {
      const already = await prisma.ruleRun.findFirst({
        where: { ruleId: rule.id, chainId, status: { in: ['SUCCESS', 'FAILED'] } },
        select: { id: true }
      });
      if (already) {
        await recordSkip({ ruleId: rule.id, eventId, chainId, taskId, status: 'SKIPPED_CHAIN' });
        continue;
      }
    }

    if (snapshot === undefined) snapshot = await loadTaskSnapshot(taskId);
    if (!snapshot) continue; // task was deleted between the event and now — nothing to act on

    if (!evaluateConditions(rule.conditions, snapshot)) {
      await recordSkip({ ruleId: rule.id, eventId, chainId, taskId, status: 'SKIPPED_CONDITION' });
      continue;
    }

    if (!actionsQueue) continue; // Redis unavailable — mirrors Phase 1's degrade-gracefully behavior
    await actionsQueue.add(
      'apply',
      { ruleId: rule.id, eventId, chainId, taskId, depth },
      { jobId: `${rule.id}__${eventId}` } // idempotency at the queue layer, belt-and-suspenders with #4 — BullMQ rejects ":" in custom job IDs
    );
    enqueued++;
  }

  return { matched: matched.length, enqueued };
}

// ── Stage 2: apply (rule-actions queue) ───────────────────────────────────
export async function applyRule({ ruleId, eventId, chainId, taskId, depth }) {
  // Rate-limit gate, before claiming the (ruleId, eventId) pair — a deferred
  // action must still be able to run later, and claiming first would burn the
  // idempotency slot permanently on something that hasn't actually run yet.
  const gate = await prisma.rule.findUnique({ where: { id: ruleId }, select: { workspaceId: true } });
  if (gate && await isWorkspaceRateLimited(gate.workspaceId)) {
    const actionsQueue = getRuleActionsQueue();
    if (actionsQueue) {
      await actionsQueue.add(
        'apply',
        { ruleId, eventId, chainId, taskId, depth },
        { jobId: `${ruleId}__${eventId}__retry-${Date.now()}`, delay: RATE_LIMIT_REQUEUE_DELAY_MS }
      );
    }
    logger.warn({ ruleId, workspaceId: gate.workspaceId }, 'Rule action deferred — workspace rate limit hit');
    return { skipped: 'rate-limited', requeued: !!actionsQueue };
  }

  const startedAt = Date.now();

  // Claim the (ruleId, eventId) pair before doing anything with side effects.
  // If this throws a unique violation, either this event was already fully
  // processed for this rule, or a prior attempt crashed after claiming but
  // before finishing — either way, re-running risks applying actions twice
  // (e.g. assignUser throws on a re-assign), so we skip rather than retry.
  let claim;
  try {
    claim = await prisma.ruleRun.create({
      data: { ruleId, eventId, chainId, taskId, status: 'FAILED' } // placeholder; overwritten below
    });
  } catch (err) {
    if (err.code === 'P2002') return { skipped: 'duplicate' };
    throw err;
  }

  const finish = (data) => prisma.ruleRun.update({ where: { id: claim.id }, data });

  const rule = await prisma.rule.findUnique({ where: { id: ruleId } });
  if (!rule || !rule.enabled) {
    await finish({ error: 'Rule was disabled or deleted before it could run' });
    return { skipped: 'rule-unavailable' };
  }

  let snapshot = await loadTaskSnapshot(taskId);
  if (!snapshot) {
    await finish({ error: 'Task no longer exists' });
    return { skipped: 'task-gone' };
  }

  const { actingUserId, ruleContext } = buildRuleContext({ rule, depth, chainId });
  const actions = Array.isArray(rule.actions) ? rule.actions : [];
  const results = [];
  let failed = false;

  for (const action of actions) {
    try {
      await executeAction(action, snapshot, { actingUserId, ruleContext });
      results.push({ type: action.type, ok: true });
      // Re-fetch so the next action sees this one's effect — e.g. SET_STATUS
      // then ADD_COMMENT referencing the task in its new state.
      snapshot = (await loadTaskSnapshot(taskId)) || snapshot;
    } catch (err) {
      results.push({ type: action.type, ok: false, error: err?.message || String(err) });
      failed = true;
      break; // stop the list on first failure — keeps ordering semantics simple
    }
  }

  await finish({
    status: failed ? 'FAILED' : 'SUCCESS',
    actionResults: results,
    error: failed ? results.find((r) => !r.ok)?.error : null,
    durationMs: Date.now() - startedAt
  });

  const updatedRule = await prisma.rule.update({
    where: { id: ruleId },
    data: {
      runCount: { increment: 1 },
      lastRunAt: new Date(),
      ...(failed
        ? { failCount: { increment: 1 }, consecutiveFailCount: { increment: 1 } }
        : { consecutiveFailCount: 0 })
    }
  });

  if (failed && updatedRule.enabled && updatedRule.consecutiveFailCount >= AUTO_DISABLE_THRESHOLD) {
    await prisma.rule.update({ where: { id: ruleId }, data: { enabled: false, autoDisabledAt: new Date() } });
    logger.warn({ ruleId, consecutiveFailCount: updatedRule.consecutiveFailCount }, 'Rule auto-disabled after repeated failures');
    notifyRuleAutoDisabled(updatedRule).catch((err) =>
      logger.error({ ruleId, err: err?.message }, 'Failed to send rule auto-disable email')
    );
  }

  logger.info({ ruleId, eventId, failed, actionCount: results.length }, 'Rule applied');
  return { failed, results };
}
