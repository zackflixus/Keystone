import { EVENT_TYPES, DUE_APPROACHING_WINDOW_HOURS } from './domainEvents.js';

/**
 * The rules engine's single source of truth for what a rule can trigger on,
 * filter by, and do. The engine (conditionEvaluator, actionExecutor) reads
 * this to validate and dispatch; Phase 3's API serves it verbatim at
 * GET /rules/schema so the builder UI renders its dropdowns from here instead
 * of hardcoding a second copy that drifts — exactly the bug fixed twice
 * already in this project's task-status lists.
 */

// Trigger definitions. `params` are optional trigger-level filters stored on
// rule.trigger alongside `type` (e.g. { type: 'TASK_STATUS_CHANGED', to: 'BLOCKED' }).
// An unset param is a wildcard — the trigger matches any value for that field.
export const TRIGGERS = {
  [EVENT_TYPES.TASK_CREATED]: {
    label: 'Task is created',
    params: []
  },
  [EVENT_TYPES.TASK_STATUS_CHANGED]: {
    label: 'Status changes',
    params: [
      { key: 'to', label: 'to', type: 'taskStatus' },
      { key: 'from', label: 'from', type: 'taskStatus' }
    ]
  },
  [EVENT_TYPES.TASK_COMPLETED]: {
    label: 'Task is marked complete',
    params: []
  },
  [EVENT_TYPES.TASK_PRIORITY_CHANGED]: {
    label: 'Priority changes',
    params: [{ key: 'to', label: 'to', type: 'priority' }]
  },
  [EVENT_TYPES.TASK_DUE_DATE_SET]: {
    label: 'Due date is set',
    params: []
  },
  [EVENT_TYPES.TASK_MOVED]: {
    label: 'Task moves to a section',
    params: [{ key: 'toListId', label: 'to section', type: 'section' }]
  },
  [EVENT_TYPES.TASK_ASSIGNED]: {
    label: 'Task is assigned',
    params: []
  },
  [EVENT_TYPES.TASK_UNASSIGNED]: {
    label: 'Assignee is removed',
    params: []
  },
  [EVENT_TYPES.COMMENT_ADDED]: {
    label: 'Comment is added',
    params: []
  },
  [EVENT_TYPES.DUE_DATE_APPROACHING]: {
    label: `Due date is approaching (within ${DUE_APPROACHING_WINDOW_HOURS}h)`,
    params: []
  },
  [EVENT_TYPES.DUE_DATE_PASSED]: {
    label: 'Due date has passed',
    params: []
  }
};

/** Does this rule's trigger (type + optional filters) match this domain event? */
export function triggerMatches(trigger, event) {
  if (!trigger || trigger.type !== event.type) return false;
  const def = TRIGGERS[trigger.type];
  if (!def) return false;

  for (const param of def.params) {
    const want = trigger[param.key];
    if (want === undefined || want === null || want === '') continue; // wildcard
    if (want !== event.payload?.[param.key]) return false;
  }
  return true;
}

// Fields a condition row can test. `type` selects which operators apply and how
// conditionEvaluator reads the value off a task snapshot.
export const CONDITION_FIELDS = {
  status:      { label: 'Status',      type: 'taskStatus' },
  priority:    { label: 'Priority',    type: 'priority' },
  taskType:    { label: 'Task type',   type: 'taskType' },
  billable:    { label: 'Billable',    type: 'boolean' },
  title:       { label: 'Title',       type: 'text' },
  dueDate:     { label: 'Due date',    type: 'date' },
  listId:      { label: 'Section',     type: 'section' },
  assigneeIds: { label: 'Assignee',    type: 'userList' }
};

export const OPERATORS = {
  is:           { label: 'is',           appliesTo: ['taskStatus', 'priority', 'taskType', 'boolean', 'section'] },
  is_not:       { label: 'is not',       appliesTo: ['taskStatus', 'priority', 'taskType', 'boolean', 'section'] },
  is_empty:     { label: 'is empty',     appliesTo: ['text', 'date', 'userList'] },
  is_not_empty: { label: 'is not empty', appliesTo: ['text', 'date', 'userList'] },
  contains:     { label: 'contains',     appliesTo: ['text', 'userList'] },
  before:       { label: 'is before',    appliesTo: ['date'] },
  after:        { label: 'is after',     appliesTo: ['date'] },
  one_of:       { label: 'is one of',    appliesTo: ['taskStatus', 'priority', 'taskType', 'section', 'userList'] }
};

// Action definitions. `implemented: false` entries are registered (so trigger/
// condition metadata and future UI can reference them) but actionExecutor
// rejects them — they need a service method this project doesn't have yet
// (tag assignment, custom fields, email) and are deferred to a later phase.
export const ACTIONS = {
  ASSIGN_TO:        { label: 'Assign to',        permission: 'task.assign',    implemented: true },
  UNASSIGN_ALL:     { label: 'Unassign everyone', permission: 'task.assign',    implemented: true },
  SET_STATUS:       { label: 'Set status',        permission: 'task.complete',  implemented: true },
  SET_PRIORITY:     { label: 'Set priority',      permission: 'task.edit',      implemented: true },
  SET_BILLABLE:     { label: 'Set billable',      permission: 'task.edit',      implemented: true },
  SET_TASK_TYPE:    { label: 'Set task type',     permission: 'task.edit',      implemented: true },
  SET_DUE_DATE:     { label: 'Set due date',      permission: 'task.edit',      implemented: true },
  MOVE_TO_SECTION:  { label: 'Move to section',   permission: 'task.move',      implemented: true },
  ADD_COMMENT:      { label: 'Add comment',       permission: 'comment.create', implemented: true },
  ADD_TAG:          { label: 'Add tag',           permission: 'task.edit',      implemented: false },
  REMOVE_TAG:       { label: 'Remove tag',        permission: 'task.edit',      implemented: false },
  SET_CUSTOM_FIELD: { label: 'Set custom field',  permission: 'field.edit',     implemented: false },
  SEND_EMAIL:       { label: 'Send email',        permission: null,             implemented: false }
};
