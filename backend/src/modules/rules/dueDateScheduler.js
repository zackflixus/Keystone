import { randomUUID } from 'node:crypto';
import prisma from '../../core/database/prisma.js';
import logger from '../../core/logger/index.js';
import { getRuleEventsQueue } from '../../core/queues/index.js';
import { EVENT_TYPES, DUE_APPROACHING_WINDOW_HOURS } from './domainEvents.js';

/**
 * Time-based triggers have no write to hang a domain event on — nothing about
 * a task changes just because the clock moved. Instead this scans on a timer
 * (see worker.js's repeatable "rule-scheduler" job) and synthesizes the same
 * event envelope matchEvent() already knows how to handle.
 *
 * A task re-enters the scan window every tick until it's handled — that's
 * fine, not a bug. The event id is deterministic per (task, due date), so
 * ruleEngine's RuleRun (ruleId, eventId) uniqueness (Phase 2) still only lets
 * a rule act on it once. Rescheduling the task changes the due date, which
 * changes the event id, which lets it fire again — exactly like a real event.
 */

const COMPLETED_STATUSES = ['DONE', 'VERIFIED'];

// Overdue tasks are rescanned every tick forever otherwise — an unbounded and
// ever-growing query as the workspace accumulates old, ignored tasks. Bound it
// to a trailing window instead; a task overdue longer than this just stops
// being a trigger candidate rather than getting scanned forever for no benefit
// (any rule that could have acted on it already got its one shot).
const PASSED_LOOKBACK_DAYS = parseInt(process.env.RULE_DUE_PASSED_LOOKBACK_DAYS, 10) || 30;

const taskSelect = {
  id: true,
  dueDate: true,
  list: { select: { board: { select: { projectId: true, project: { select: { workspaceId: true } } } } } }
};

async function enqueue(queue, type, task) {
  const projectId = task.list?.board?.projectId;
  const workspaceId = task.list?.board?.project?.workspaceId;
  if (!projectId || !workspaceId) return false;

  const dueDateIso = new Date(task.dueDate).toISOString();
  // Epoch ms, not the ISO string — eventId isn't just this job's id, it also
  // flows into ruleEngine.matchEvent's `${rule.id}__${eventId}` job id for the
  // rule-actions queue downstream, so it has to be colon-free at the source,
  // not just sanitized for this one queue.add() call.
  const dueKey = new Date(task.dueDate).getTime();
  const eventId = `${type}__${task.id}__${dueKey}`;

  await queue.add(type, {
    eventId,
    type,
    workspaceId,
    projectId,
    payload: { taskId: task.id, actorId: null, actorType: 'SYSTEM', depth: 0, chainId: randomUUID(), dueDate: dueDateIso }
  }, { jobId: eventId });

  return true;
}

export async function scanDueDates() {
  const queue = getRuleEventsQueue();
  if (!queue) return { approaching: 0, passed: 0 };

  const now = new Date();
  const windowEnd = new Date(now.getTime() + DUE_APPROACHING_WINDOW_HOURS * 3600_000);
  const lookback = new Date(now.getTime() - PASSED_LOOKBACK_DAYS * 86400_000);

  const [approaching, passed] = await Promise.all([
    prisma.task.findMany({
      where: { dueDate: { gt: now, lte: windowEnd }, status: { notIn: COMPLETED_STATUSES } },
      select: taskSelect
    }),
    prisma.task.findMany({
      where: { dueDate: { lt: now, gte: lookback }, status: { notIn: COMPLETED_STATUSES } },
      select: taskSelect
    })
  ]);

  let enqueuedApproaching = 0;
  let enqueuedPassed = 0;
  for (const t of approaching) if (await enqueue(queue, EVENT_TYPES.DUE_DATE_APPROACHING, t)) enqueuedApproaching++;
  for (const t of passed) if (await enqueue(queue, EVENT_TYPES.DUE_DATE_PASSED, t)) enqueuedPassed++;

  logger.info({ approaching: enqueuedApproaching, passed: enqueuedPassed }, 'Due-date scan complete');
  return { approaching: enqueuedApproaching, passed: enqueuedPassed };
}

export default scanDueDates;
