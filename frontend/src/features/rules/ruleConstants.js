// Shared label/color maps + human-readable describers for rules UI.
// Colors mirror STATUS_CONFIG / PRIORITY_CONFIG in features/board/ProjectListView.jsx —
// kept as a small local copy here (not imported) since that file exports lower-level
// row-rendering config, not a reusable label lookup.

export const STATUS_LABEL = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  REVIEW: 'Review',
  NEXT_SPRINT: 'Next sprint',
  DONE: 'Completed',
  VERIFIED: 'Verified',
};

export const STATUS_BADGE = {
  TODO: 'bg-gray-100 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  BLOCKED: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  REVIEW: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  NEXT_SPRINT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  DONE: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  VERIFIED: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
};

export const PRIORITY_LABEL = { HIGH: 'High', MEDIUM: 'Medium', LOW: 'Low' };
export const TASK_TYPE_LABEL = { DEFAULT_TASK: 'Task', MILESTONE: 'Milestone', APPROVAL: 'Approval' };
export const PRIORITY_BADGE = {
  HIGH: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  MEDIUM: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  LOW: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

export const DUE_DATE_PRESETS = [
  { value: 'today', label: 'Today' },
  { value: '+1d', label: 'Tomorrow' },
  { value: '+3d', label: 'In 3 days' },
  { value: '+7d', label: 'In 1 week' },
  { value: 'endOfWeek', label: 'End of this week' },
];

export const dueDateLabel = (value) => {
  if (!value) return '';
  const preset = DUE_DATE_PRESETS.find((p) => p.value === value);
  if (preset) return preset.label;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
};

const sourceLabel = (type, value, schema) => {
  if (value === undefined || value === null || value === '') return null;
  switch (type) {
    case 'taskStatus':
      return STATUS_LABEL[value] || value;
    case 'priority':
      return PRIORITY_LABEL[value] || value;
    case 'taskType':
      return TASK_TYPE_LABEL[value] || value;
    case 'boolean':
      return value === true || value === 'true' ? 'Yes' : 'No';
    case 'section': {
      const s = schema?.sources?.section?.find((s) => s.id === value);
      return s?.name || 'a section';
    }
    case 'member': {
      const m = schema?.sources?.member?.find((m) => m.id === value);
      return m?.name || 'a member';
    }
    default:
      return String(value);
  }
};

/** "Status changes (to Blocked)" */
export function describeTrigger(trigger, schema) {
  if (!trigger?.type) return 'Choose a trigger';
  const def = schema?.triggers?.[trigger.type];
  const label = def?.label || trigger.type;
  const parts = (def?.params || [])
    .map((p) => {
      const v = sourceLabel(p.type, trigger[p.key], schema);
      return v ? `${p.label} ${v}` : null;
    })
    .filter(Boolean);
  return parts.length ? `${label} (${parts.join(', ')})` : label;
}

/** "is Blocked", "contains 3 assignees", etc. for one condition row */
export function describeCondition(item, schema) {
  const fieldDef = schema?.conditionFields?.[item.field];
  const opDef = schema?.operators?.[item.operator];
  if (!fieldDef || !opDef) return '';
  const fieldLabel = fieldDef.label;
  const opLabel = opDef.label;
  if (['is_empty', 'is_not_empty'].includes(item.operator)) {
    return `${fieldLabel} ${opLabel}`;
  }
  if (item.operator === 'one_of' && Array.isArray(item.value)) {
    const vals = item.value.map((v) => sourceLabel(fieldDef.type, v, schema) || v).join(', ');
    return `${fieldLabel} ${opLabel}: ${vals}`;
  }
  if (fieldDef.type === 'date') {
    return `${fieldLabel} ${opLabel} ${item.value || ''}`;
  }
  const v = sourceLabel(fieldDef.type, item.value, schema) || item.value;
  return `${fieldLabel} ${opLabel} ${v ?? ''}`;
}

/** "Assign to: rule creator" */
export function describeAction(action, schema) {
  const def = schema?.actions?.[action.type];
  const label = def?.label || action.type;
  switch (action.type) {
    case 'ASSIGN_TO': {
      if (action.value === 'ruleCreator') return `${label}: rule creator`;
      if (action.value === 'taskCreator') return `${label}: task creator`;
      return `${label}: ${sourceLabel('member', action.value, schema)}`;
    }
    case 'SET_STATUS':
      return `${label}: ${sourceLabel('taskStatus', action.value, schema)}`;
    case 'SET_PRIORITY':
      return `${label}: ${sourceLabel('priority', action.value, schema)}`;
    case 'SET_BILLABLE':
      return `${label}: ${sourceLabel('boolean', action.value, schema)}`;
    case 'SET_TASK_TYPE':
      return `${label}: ${sourceLabel('taskType', action.value, schema)}`;
    case 'SET_DUE_DATE':
      return `${label}: ${dueDateLabel(action.value)}`;
    case 'MOVE_TO_SECTION':
      return `${label}: ${sourceLabel('section', action.value, schema)}`;
    case 'ADD_COMMENT':
      return `${label}: "${action.value || ''}"`;
    case 'UNASSIGN_ALL':
    default:
      return label;
  }
}
