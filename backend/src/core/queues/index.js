import { Queue } from 'bullmq';
import { getSharedRedis, isRedisEnabled } from '../redis.js';
import logger from '../logger/index.js';

/**
 * BullMQ queues for the rules engine.
 *
 * Two queues, not one:
 *   rule-events   — match a domain event against the project's rules
 *   rule-actions  — apply a single matched action
 *
 * Splitting them means one slow action (an email) never blocks rule evaluation
 * for other tasks, and each action retries on its own rather than re-running
 * the whole rule.
 */

export const QUEUE_RULE_EVENTS    = 'rule-events';
export const QUEUE_RULE_ACTIONS   = 'rule-actions';
// Repeatable-job queue for time-based triggers (due date approaching/passed) —
// see modules/rules/dueDateScheduler.js. A repeatable job is locked to one
// worker per tick even if the worker process is ever scaled to N replicas, so
// this never double-scans the way N independent setInterval timers would.
export const QUEUE_RULE_SCHEDULER = 'rule-scheduler';

// Keep completed jobs briefly for debugging, failures for a day so the run log
// can be reconciled against them.
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 86400 }
};

let ruleEventsQueue;
let ruleActionsQueue;
let ruleSchedulerQueue;

const build = (name) => new Queue(name, {
  connection: getSharedRedis(),
  defaultJobOptions: DEFAULT_JOB_OPTIONS
});

export const getRuleEventsQueue = () => {
  if (!isRedisEnabled()) return null;
  if (!ruleEventsQueue) ruleEventsQueue = build(QUEUE_RULE_EVENTS);
  return ruleEventsQueue;
};

export const getRuleActionsQueue = () => {
  if (!isRedisEnabled()) return null;
  if (!ruleActionsQueue) ruleActionsQueue = build(QUEUE_RULE_ACTIONS);
  return ruleActionsQueue;
};

export const getRuleSchedulerQueue = () => {
  if (!isRedisEnabled()) return null;
  // Scheduler ticks aren't rule work, just a trigger to go find some — the
  // events/actions defaults (3 retries, keep failures a day) don't apply.
  if (!ruleSchedulerQueue) {
    ruleSchedulerQueue = new Queue(QUEUE_RULE_SCHEDULER, {
      connection: getSharedRedis(),
      defaultJobOptions: { removeOnComplete: { age: 3600, count: 100 }, removeOnFail: { age: 3600 } }
    });
  }
  return ruleSchedulerQueue;
};

export const closeQueues = async () => {
  await Promise.allSettled([
    ruleEventsQueue?.close(),
    ruleActionsQueue?.close(),
    ruleSchedulerQueue?.close()
  ]);
  ruleEventsQueue = undefined;
  ruleActionsQueue = undefined;
  ruleSchedulerQueue = undefined;
  logger.debug('Rule queues closed');
};
