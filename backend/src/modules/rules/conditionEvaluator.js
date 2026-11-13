import { CONDITION_FIELDS } from './ruleRegistry.js';

/**
 * Evaluates a rule's `conditions` JSON against a task snapshot.
 *
 *   { match: 'ALL' | 'ANY', items: [{ field, operator, value }, ...] }
 *
 * An empty (or absent) items array means "no filter" — the rule is
 * unconditional and this returns true, matching Asana's "no If block" behavior.
 */

const isEmptyValue = (v) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

const getFieldValue = (field, snapshot) => {
  if (field === 'assigneeIds') return (snapshot.assignees || []).map((a) => a.userId);
  return snapshot[field];
};

// The builder UI stores a boolean condition's value as the string "true"/"false"
// (native <select> options are always strings), but a boolean field's actual
// value on the task snapshot is a real boolean — coerce before comparing.
const coerceValue = (fieldDef, value) => {
  if (fieldDef.type === 'boolean' && typeof value === 'string') {
    if (value === 'true') return true;
    if (value === 'false') return false;
  }
  return value;
};

const evalOne = ({ field, operator, value }, snapshot) => {
  const fieldDef = CONDITION_FIELDS[field];
  if (!fieldDef) return false; // unknown field — fail closed, never silently matches
  const actual = getFieldValue(field, snapshot);
  value = coerceValue(fieldDef, value);

  switch (operator) {
    case 'is':           return actual === value;
    case 'is_not':        return actual !== value;
    case 'is_empty':      return isEmptyValue(actual);
    case 'is_not_empty':  return !isEmptyValue(actual);
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(value);
      return typeof actual === 'string' && actual.toLowerCase().includes(String(value ?? '').toLowerCase());
    case 'before':        return actual ? new Date(actual) < new Date(value) : false;
    case 'after':          return actual ? new Date(actual) > new Date(value) : false;
    case 'one_of':         return Array.isArray(value) && value.includes(actual);
    default:               return false; // unknown operator — fail closed
  }
};

export const evaluateConditions = (conditions, snapshot) => {
  const items = conditions?.items || [];
  if (!items.length) return true;

  const results = items.map((item) => evalOne(item, snapshot));
  return conditions.match === 'ANY' ? results.some(Boolean) : results.every(Boolean);
};
