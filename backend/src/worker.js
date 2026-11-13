import 'dotenv/config';
import { Worker } from 'bullmq';
import logger from './core/logger/index.js';
import prisma from './core/database/prisma.js';
import { createRedisConnection, closeSharedRedis, isRedisEnabled } from './core/redis.js';
import { closeQueues, QUEUE_RULE_EVENTS, QUEUE_RULE_ACTIONS, QUEUE_RULE_SCHEDULER, getRuleSchedulerQueue } from './core/queues/index.js';
import { matchEvent, applyRule } from './modules/rules/ruleEngine.js';
import { scanDueDates } from './modules/rules/dueDateScheduler.js';

/**
 * Rules worker — a separate process from the API.
 *
 * rule-events jobs are matched against enabled rules (modules/rules/ruleEngine
 * .matchEvent); rule-actions jobs run one rule's action list against the task
 * (ruleEngine.applyRule). See ruleEngine.js for the loop guards.
 *
 * Run with: node src/worker.js
 */

if (!isRedisEnabled()) {
  logger.error('REDIS_URL is not set — the rules worker cannot start');
  process.exit(1);
}

const CONCURRENCY = parseInt(process.env.RULE_WORKER_CONCURRENCY, 10) || 5;

// ── rule-events: match an event against the project's rules ──────────────────
const eventsWorker = new Worker(
  QUEUE_RULE_EVENTS,
  async (job) => {
    const { eventId, type, workspaceId, projectId, payload } = job.data;
    const { taskId, actorId, actorType, depth, chainId, ...data } = payload || {};

    logger.info({
      queue: QUEUE_RULE_EVENTS,
      jobId: job.id,
      eventId,
      type,
      workspaceId,
      projectId,
      taskId,
      actorId,
      actorType,
      depth,
      chainId,
      data          // just the event-specific fields, envelope already logged above
    }, 'Rule event received');

    return matchEvent({ eventId, type, workspaceId, projectId, payload });
  },
  { connection: createRedisConnection('worker-events'), concurrency: CONCURRENCY }
);

// ── rule-actions: apply one matched rule's action list ────────────────────────
const actionsWorker = new Worker(
  QUEUE_RULE_ACTIONS,
  async (job) => {
    logger.info({ queue: QUEUE_RULE_ACTIONS, jobId: job.id, data: job.data }, 'Rule action job received');
    return applyRule(job.data);
  },
  { connection: createRedisConnection('worker-actions'), concurrency: CONCURRENCY }
);

// ── rule-scheduler: periodic scan for due-date triggers ──────────────────────
const SCAN_INTERVAL_MS = (parseInt(process.env.RULE_DUE_SCAN_INTERVAL_MINUTES, 10) || 15) * 60_000;

const schedulerWorker = new Worker(
  QUEUE_RULE_SCHEDULER,
  async () => scanDueDates(),
  { connection: createRedisConnection('worker-scheduler'), concurrency: 1 }
);

// upsertJobScheduler is idempotent (internally an upsert) — safe to call on
// every boot, including when multiple worker replicas start at once.
const schedulerQueue = getRuleSchedulerQueue(); // never null here — isRedisEnabled() already checked above
// `immediately: true` runs the first tick right away instead of waiting a full
// interval — matters at boot (a fresh deploy shouldn't sit idle for up to
// RULE_DUE_SCAN_INTERVAL_MINUTES before its first scan). BullMQ logs a
// (harmless, inaccurately worded) warning that this option only affects
// `pattern`-based repeats; empirically, without it the first run does wait a
// full `every` — keeping it.
schedulerQueue
  .upsertJobScheduler('due-date-scan', { every: SCAN_INTERVAL_MS, immediately: true }, { name: 'scan-due-dates' })
  .then(() => logger.info({ everyMs: SCAN_INTERVAL_MS }, 'Due-date scheduler registered'))
  .catch((err) => logger.error({ err: err?.message }, 'Failed to register due-date scheduler'));

for (const [name, w] of [['events', eventsWorker], ['actions', actionsWorker], ['scheduler', schedulerWorker]]) {
  w.on('failed', (job, err) => {
    logger.error({
      worker: name,
      jobId: job?.id,
      attempt: job?.attemptsMade,
      maxAttempts: job?.opts?.attempts,
      err: err?.message
    }, 'Rule job failed');
  });
  w.on('error', (err) => logger.error({ worker: name, err: err?.message }, 'Rule worker error'));
}

logger.info({ concurrency: CONCURRENCY, queues: [QUEUE_RULE_EVENTS, QUEUE_RULE_ACTIONS, QUEUE_RULE_SCHEDULER] }, 'Rules worker started');

// ── Shutdown ─────────────────────────────────────────────────────────────────
// close() lets in-flight jobs finish; unfinished ones return to the queue and
// are picked up by the next worker, so a deploy never drops an event.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Rules worker shutting down');

  await Promise.allSettled([eventsWorker.close(), actionsWorker.close(), schedulerWorker.close()]);
  await closeQueues();
  await closeSharedRedis();
  await prisma.$disconnect();

  logger.info('Rules worker stopped');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err: err?.message }, 'Unhandled rejection in rules worker'));
