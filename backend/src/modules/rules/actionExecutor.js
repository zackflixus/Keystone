import { ApiError } from '../../core/utils/apiResponse.js';
import { taskService } from '../tasks/taskService.js';
import { commentService } from '../comments/commentService.js';
import { ACTIONS } from './ruleRegistry.js';

/**
 * Runs one action from a rule's `actions` array through the same task/comment
 * services a human edit goes through — same permission checks, same activity
 * log, same domain events (tagged actorType: 'RULE' via ctx.ruleContext so
 * they can cascade into further rules, bounded by the depth/chain guards in
 * ruleEngine.js).
 */

// Relative due-date presets. Absolute ISO dates also pass straight through.
// Exported for reuse by ruleService's dry-run preview, which needs to compute
// the same resulting values without calling the write-side service methods.
export const resolveDueDate = (value) => {
  if (!value) return null;

  if (value === 'today') return new Date();

  const relative = /^\+(\d+)d$/.exec(value);
  if (relative) {
    const d = new Date();
    d.setDate(d.getDate() + Number(relative[1]));
    return d;
  }

  if (value === 'endOfWeek') {
    const d = new Date();
    d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); // next Sunday, or in 7 days if today is Sunday
    return d;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw ApiError.badRequest(`Invalid due date value: "${value}"`);
  return parsed;
};

export const renderTemplate = (text, task) =>
  String(text ?? '').replace(/\{\{\s*task\.title\s*\}\}/g, task.title);

export const resolveAssignee = (value, task, ctx) => {
  if (value === 'ruleCreator') return ctx.actingUserId;
  if (value === 'taskCreator') {
    // Tasks created before the createdById column existed have nothing to
    // resolve to — fail clearly rather than silently assigning no one.
    if (!task.createdById) {
      throw ApiError.badRequest('This task has no recorded creator (it predates that being tracked), so ASSIGN_TO "taskCreator" cannot resolve an assignee');
    }
    return task.createdById;
  }
  return value; // a literal userId
};

export async function executeAction(action, task, ctx) {
  const { type, value } = action || {};
  const def = ACTIONS[type];
  if (!def) throw ApiError.badRequest(`Unknown action type: "${type}"`);
  if (!def.implemented) throw ApiError.badRequest(`Action "${type}" is not implemented yet`);

  switch (type) {
    case 'ASSIGN_TO':
      return taskService.assignUser(task.id, ctx.actingUserId, resolveAssignee(value, task, ctx), undefined, ctx.ruleContext);

    case 'UNASSIGN_ALL': {
      const removed = [];
      for (const a of task.assignees) {
        removed.push(await taskService.removeAssignee(task.id, ctx.actingUserId, a.userId, undefined, ctx.ruleContext));
      }
      return removed;
    }

    case 'SET_STATUS':
      return taskService.update(task.id, ctx.actingUserId, { status: value }, undefined, ctx.ruleContext);

    case 'SET_PRIORITY':
      return taskService.update(task.id, ctx.actingUserId, { priority: value }, undefined, ctx.ruleContext);

    case 'SET_BILLABLE':
      return taskService.update(task.id, ctx.actingUserId, { billable: value === true || value === 'true' }, undefined, ctx.ruleContext);

    case 'SET_TASK_TYPE':
      return taskService.update(task.id, ctx.actingUserId, { taskType: value }, undefined, ctx.ruleContext);

    case 'SET_DUE_DATE':
      return taskService.update(task.id, ctx.actingUserId, { dueDate: resolveDueDate(value) }, undefined, ctx.ruleContext);

    case 'MOVE_TO_SECTION':
      return taskService.moveTask(task.id, ctx.actingUserId, { listId: value, position: 0 }, undefined, ctx.ruleContext);

    case 'ADD_COMMENT':
      return commentService.create(task.id, ctx.actingUserId, renderTemplate(value, task), ctx.ruleContext);

    default:
      // Unreachable given the implemented-flag check above; kept as a guard
      // against a registry entry marked implemented without a case here.
      throw ApiError.badRequest(`Action "${type}" has no executor`);
  }
}
