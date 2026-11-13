/**
 * Built-in rule templates — the entry point for a user with zero rules.
 *
 * Every template here uses only triggers/actions the engine can actually run
 * today (see ruleRegistry.js). Templates for tag/custom-field/email actions
 * are deliberately not included yet — those actions aren't implemented, and a
 * template that can never fire is worse than no template.
 *
 * A template value of `{ param: 'sectionId' }` marks a placeholder the caller
 * must fill in via `applyTemplate`'s `params` — e.g. "move to section" needs
 * to know *which* section in *this* project, which the template itself can't
 * know.
 */

export const RULE_TEMPLATES = [
  {
    key: 'claim-new-tasks',
    name: 'Assign new tasks to their creator',
    description: 'When a task is created, assign it to whoever created it, due today, and start it.',
    params: [],
    trigger: { type: 'TASK_CREATED' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'ASSIGN_TO', value: 'taskCreator' },
      { type: 'SET_DUE_DATE', value: 'today' },
      { type: 'SET_STATUS', value: 'IN_PROGRESS' }
    ]
  },
  {
    key: 'flag-blocked-work',
    name: 'Flag blocked work',
    description: 'When a task is marked Blocked, leave a comment so it doesn\'t get missed.',
    params: [],
    trigger: { type: 'TASK_STATUS_CHANGED', to: 'BLOCKED' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'ADD_COMMENT', value: 'This task is blocked — {{task.title}} needs attention.' }
    ]
  },
  {
    key: 'file-completed-work',
    name: 'File completed work',
    description: 'When a task is completed, move it into a Done section.',
    params: [{ key: 'sectionId', label: 'Done section', type: 'section' }],
    trigger: { type: 'TASK_COMPLETED' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'MOVE_TO_SECTION', value: { param: 'sectionId' } }
    ]
  },
  {
    key: 'start-on-assignment',
    name: 'Start work on assignment',
    description: 'When someone is assigned a task, set it to In progress.',
    params: [],
    trigger: { type: 'TASK_ASSIGNED' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'SET_STATUS', value: 'IN_PROGRESS' }
    ]
  },
  {
    key: 'triage-new-in-section',
    name: 'Triage new work in a section',
    description: 'When a task moves into a chosen section, raise its priority so it gets looked at.',
    params: [{ key: 'sectionId', label: 'Section to watch', type: 'section' }],
    trigger: { type: 'TASK_MOVED', toListId: { param: 'sectionId' } },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'SET_PRIORITY', value: 'HIGH' }
    ]
  },
  {
    key: 'unassign-on-hold',
    name: 'Unassign work pushed to next sprint',
    description: 'When a task moves to Next sprint, clear its assignees so it drops off their plate.',
    params: [],
    trigger: { type: 'TASK_STATUS_CHANGED', to: 'NEXT_SPRINT' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'UNASSIGN_ALL' }
    ]
  },
  {
    key: 'remind-before-due',
    name: 'Remind me before it\'s due',
    description: 'When a task\'s due date is approaching, leave a reminder comment.',
    params: [],
    trigger: { type: 'DUE_DATE_APPROACHING' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'ADD_COMMENT', value: 'Reminder: {{task.title}} is due soon.' }
    ]
  },
  {
    key: 'flag-overdue',
    name: 'Flag overdue work',
    description: 'When a task\'s due date passes, raise its priority so it doesn\'t get missed.',
    params: [],
    trigger: { type: 'DUE_DATE_PASSED' },
    conditions: { match: 'ALL', items: [] },
    actions: [
      { type: 'SET_PRIORITY', value: 'HIGH' },
      { type: 'ADD_COMMENT', value: 'This task is overdue: {{task.title}}.' }
    ]
  }
];

export const getTemplate = (key) => RULE_TEMPLATES.find((t) => t.key === key) || null;

// Deep-walks a template's trigger/conditions/actions, replacing every
// `{ param: 'x' }` placeholder with `params.x`. Throws if a required param is
// missing so a half-configured rule is never silently created.
const fillParams = (node, params) => {
  if (Array.isArray(node)) return node.map((n) => fillParams(n, params));
  if (node && typeof node === 'object') {
    if (typeof node.param === 'string' && Object.keys(node).length === 1) {
      const value = params?.[node.param];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing required template parameter: "${node.param}"`);
      }
      return value;
    }
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, fillParams(v, params)]));
  }
  return node;
};

/** Returns { trigger, conditions, actions } with every placeholder resolved. */
export const materializeTemplate = (template, params = {}) => ({
  trigger: fillParams(template.trigger, params),
  conditions: fillParams(template.conditions, params),
  actions: fillParams(template.actions, params)
});
