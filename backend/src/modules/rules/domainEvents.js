import { randomUUID } from 'node:crypto';

/**
 * Domain events — the trigger surface of the rules engine.
 *
 * Events are written to the DomainEvent outbox table *inside the same
 * transaction* as the change that caused them. That guarantees an event exists
 * for every committed change and for no rolled-back one. A separate publisher
 * (outbox.js) moves them onto the queue.
 *
 * One event per semantic change, not one per request: a single task update that
 * changes both status and priority records two events, so rule triggers stay a
 * simple equality match on `type` instead of having to introspect a diff.
 */

export const EVENT_TYPES = {
  TASK_CREATED:          'TASK_CREATED',
  TASK_STATUS_CHANGED:   'TASK_STATUS_CHANGED',
  TASK_COMPLETED:        'TASK_COMPLETED',
  TASK_PRIORITY_CHANGED: 'TASK_PRIORITY_CHANGED',
  TASK_DUE_DATE_SET:     'TASK_DUE_DATE_SET',
  TASK_MOVED:            'TASK_MOVED',
  TASK_ASSIGNED:         'TASK_ASSIGNED',
  TASK_UNASSIGNED:       'TASK_UNASSIGNED',
  COMMENT_ADDED:         'COMMENT_ADDED',
  // Synthetic — not written to the DomainEvent outbox by a transaction like the
  // others above. modules/rules/dueDateScheduler.js scans for due dates on a
  // timer and feeds these straight onto the rule-events queue instead, since
  // there's no write to hang them on. Everything downstream (matching,
  // idempotency, loop guards) treats them identically either way.
  DUE_DATE_APPROACHING:  'DUE_DATE_APPROACHING',
  DUE_DATE_PASSED:       'DUE_DATE_PASSED'
};

// How far ahead of a due date DUE_DATE_APPROACHING fires. A task re-enters the
// window every scan tick until it's handled, but the RuleRun (ruleId, eventId)
// uniqueness (keyed on this exact due date) means a rule only ever acts on it once.
export const DUE_APPROACHING_WINDOW_HOURS = parseInt(process.env.RULE_DUE_APPROACHING_HOURS, 10) || 24;

// Statuses that count as "finished" — mirrors COMPLETED_STATUSES in taskService.
const COMPLETED_STATUSES = ['DONE', 'VERIFIED'];

// A rule action is itself a change, which records another event. `depth` caps how
// far that can cascade; `chainId` groups everything descended from one user action
// so a rule can be stopped from firing twice within the same chain.
export const MAX_EVENT_DEPTH = 3;

/**
 * Build one event envelope. `actor` describes who caused the change — a real
 * user, or the rules engine itself once Phase 2 lands.
 */
export const buildEvent = ({
  type,
  workspaceId,
  projectId,
  taskId,
  actorId = null,
  actorType = 'USER',
  depth = 0,
  chainId = null,
  data = {}
}) => ({
  id: randomUUID(),
  type,
  workspaceId,
  projectId: projectId ?? null,
  payload: {
    taskId: taskId ?? null,
    actorId,
    actorType,
    depth,
    // A user action starts a fresh chain; rule-triggered events inherit one.
    chainId: chainId || randomUUID(),
    ...data
  }
});

/**
 * Persist events through the given Prisma transaction client.
 *
 * Always pass `tx` from an enclosing `prisma.$transaction` — passing the plain
 * client writes the event outside the transaction and defeats the outbox.
 * Returns the events written, so callers can log ids.
 */
export const recordEvents = async (tx, events) => {
  const rows = (events || []).filter(Boolean);
  if (!rows.length) return [];

  await tx.domainEvent.createMany({
    data: rows.map((e) => ({
      id: e.id,
      type: e.type,
      workspaceId: e.workspaceId,
      projectId: e.projectId,
      payload: e.payload
    }))
  });

  return rows;
};

/** Convenience wrapper for the common single-event case. */
export const recordEvent = async (tx, event) => {
  const [written] = await recordEvents(tx, [event]);
  return written;
};

// ── Diffing helpers ──────────────────────────────────────────────────────────

const sameDate = (a, b) => {
  const ta = a ? new Date(a).getTime() : null;
  const tb = b ? new Date(b).getTime() : null;
  return ta === tb;
};

/**
 * Derive the events a task update should record, from before/after snapshots.
 *
 * Only fields that actually changed produce events — an idempotent save (setting
 * status to the value it already holds) records nothing, which is the first of
 * the engine's loop guards.
 */
export const diffTaskUpdate = ({ before, after, base }) => {
  const events = [];
  const mk = (type, data) => buildEvent({ ...base, type, data });

  if (before.status !== after.status) {
    events.push(mk(EVENT_TYPES.TASK_STATUS_CHANGED, { from: before.status, to: after.status }));

    // A separate, more specific event so "when a task is completed" does not have
    // to enumerate every finished status.
    const wasDone = COMPLETED_STATUSES.includes(before.status);
    const isDone  = COMPLETED_STATUSES.includes(after.status);
    if (!wasDone && isDone) {
      events.push(mk(EVENT_TYPES.TASK_COMPLETED, { from: before.status, to: after.status }));
    }
  }

  if (before.priority !== after.priority) {
    events.push(mk(EVENT_TYPES.TASK_PRIORITY_CHANGED, { from: before.priority, to: after.priority }));
  }

  // Fires on set and on change, but not on clear — "due date was set" reads as a
  // date now existing, so a rule keyed on it should not run when one is removed.
  if (!sameDate(before.dueDate, after.dueDate) && after.dueDate) {
    events.push(mk(EVENT_TYPES.TASK_DUE_DATE_SET, {
      from: before.dueDate ? new Date(before.dueDate).toISOString() : null,
      to: new Date(after.dueDate).toISOString()
    }));
  }

  return events;
};
