import { TaskStatus, Priority, TaskType } from '@prisma/client';
import prisma from '../../core/database/prisma.js';
import { ApiError } from '../../core/utils/apiResponse.js';
import { hasProjectPermission } from '../../core/utils/projectPermissions.js';
import { TRIGGERS, CONDITION_FIELDS, OPERATORS, ACTIONS } from './ruleRegistry.js';
import { evaluateConditions } from './conditionEvaluator.js';
import { resolveDueDate, renderTemplate, resolveAssignee } from './actionExecutor.js';
import { RULE_TEMPLATES, getTemplate, materializeTemplate } from './ruleTemplates.js';

const isWorkspaceAdmin = (role) => role === 'OWNER' || role === 'ADMIN';

// ── Access control ───────────────────────────────────────────────────────────
// A rule scoped to a project follows the normal rule.view/rule.manage project
// permission. A workspace-wide rule (projectId: null) reaches every project in
// the workspace, so it's gated at workspace-admin level instead — there is no
// project-level permission that could scope it safely.

async function getWorkspaceMember(workspaceId, userId) {
  const member = await prisma.workspaceMember.findFirst({ where: { workspaceId, userId } });
  if (!member) throw ApiError.forbidden('You are not a member of this workspace');
  return member;
}

async function getProjectAccessContext(projectId, userId) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      workspace: { include: { members: { where: { userId }, include: { customRole: { select: { permissions: true } } } } } },
      members: { where: { userId }, include: { customRole: true } }
    }
  });
  if (!project) throw ApiError.notFound('Project not found');

  const workspaceMember = project.workspace.members[0];
  if (!workspaceMember) throw ApiError.forbidden('You are not a member of this workspace');

  const projectMember = project.members[0] || null;
  const projectRole = projectMember?.projectRole ?? null;
  const customPermissions = projectMember?.customRole?.permissions ?? workspaceMember.customRole?.permissions ?? null;

  return { project, workspaceMember, projectRole, customPermissions };
}

async function resolveAccess({ workspaceId, projectId }, userId, permissionKey) {
  if (projectId) {
    const ctx = await getProjectAccessContext(projectId, userId);
    if (ctx.project.workspaceId !== workspaceId) {
      throw ApiError.badRequest('That project does not belong to the given workspace');
    }
    const allowed = hasProjectPermission(ctx.workspaceMember.role, ctx.projectRole, ctx.customPermissions, permissionKey);
    if (!allowed) {
      throw ApiError.forbidden(
        permissionKey === 'rule.manage'
          ? 'You do not have permission to manage rules in this project'
          : 'You do not have permission to view rules in this project'
      );
    }
    return ctx.workspaceMember;
  }

  const workspaceMember = await getWorkspaceMember(workspaceId, userId);
  if (permissionKey === 'rule.manage' && !isWorkspaceAdmin(workspaceMember.role)) {
    throw ApiError.forbidden('Only workspace admins can manage workspace-wide rules');
  }
  return workspaceMember;
}

// ── Shape validation ─────────────────────────────────────────────────────────
// The registry is the single source of truth here too, not just documentation
// for the builder UI — a rule with an unknown trigger/field/operator/action
// can never be created, so there is nothing for the engine to silently skip.

function assertValidTrigger(trigger) {
  if (!trigger || typeof trigger !== 'object') throw ApiError.badRequest('trigger is required');
  const def = TRIGGERS[trigger.type];
  if (!def) throw ApiError.badRequest(`Unknown trigger type: "${trigger.type}"`);
  for (const key of Object.keys(trigger)) {
    if (key === 'type') continue;
    if (!def.params.some((p) => p.key === key)) {
      throw ApiError.badRequest(`Trigger "${trigger.type}" has no parameter "${key}"`);
    }
  }
}

function assertValidConditions(conditions) {
  if (conditions == null) return;
  if (typeof conditions !== 'object') throw ApiError.badRequest('conditions must be an object');
  if (conditions.match !== undefined && !['ALL', 'ANY'].includes(conditions.match)) {
    throw ApiError.badRequest('conditions.match must be "ALL" or "ANY"');
  }
  const items = conditions.items;
  if (items === undefined) return;
  if (!Array.isArray(items)) throw ApiError.badRequest('conditions.items must be an array');

  for (const item of items) {
    const fieldDef = CONDITION_FIELDS[item?.field];
    if (!fieldDef) throw ApiError.badRequest(`Unknown condition field: "${item?.field}"`);
    const opDef = OPERATORS[item?.operator];
    if (!opDef) throw ApiError.badRequest(`Unknown condition operator: "${item?.operator}"`);
    if (!opDef.appliesTo.includes(fieldDef.type)) {
      throw ApiError.badRequest(`Operator "${item.operator}" does not apply to field "${item.field}"`);
    }
  }
}

function assertValidActions(actions) {
  if (!Array.isArray(actions) || !actions.length) throw ApiError.badRequest('At least one action is required');
  for (const action of actions) {
    const def = ACTIONS[action?.type];
    if (!def) throw ApiError.badRequest(`Unknown action type: "${action?.type}"`);
    if (!def.implemented) throw ApiError.badRequest(`Action "${action.type}" is not implemented yet`);
  }
}

// ── Schema (for the builder UI) ──────────────────────────────────────────────

async function getSchema(userId, { workspaceId, projectId }) {
  if (projectId) {
    await resolveAccess({ workspaceId, projectId }, userId, 'rule.view');
  } else {
    await getWorkspaceMember(workspaceId, userId);
  }

  const [members, sections] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      include: { user: { select: { id: true, name: true, avatar: true } } }
    }),
    projectId
      ? prisma.list.findMany({
          where: { board: { projectId } },
          select: { id: true, name: true },
          orderBy: { position: 'asc' }
        })
      : []
  ]);

  return {
    triggers: TRIGGERS,
    conditionFields: CONDITION_FIELDS,
    operators: OPERATORS,
    actions: ACTIONS,
    sources: {
      taskStatus: Object.values(TaskStatus).map((value) => ({ value })),
      priority: Object.values(Priority).map((value) => ({ value })),
      taskType: Object.values(TaskType).map((value) => ({ value })),
      section: sections,
      member: members.map((m) => ({ id: m.userId, name: m.user.name, avatar: m.user.avatar }))
    }
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function create(userId, data) {
  const { name, description, workspaceId, projectId = null, trigger, conditions, actions, enabled, templateKey } = data;

  assertValidTrigger(trigger);
  assertValidConditions(conditions);
  assertValidActions(actions);
  await resolveAccess({ workspaceId, projectId }, userId, 'rule.manage');

  return prisma.rule.create({
    data: {
      name,
      description: description || null,
      workspaceId,
      projectId,
      trigger,
      conditions: conditions || { match: 'ALL', items: [] },
      actions,
      enabled: enabled !== undefined ? !!enabled : true,
      templateKey: templateKey || null,
      createdById: userId
    }
  });
}

async function getById(id, userId) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) throw ApiError.notFound('Rule not found');
  await resolveAccess(rule, userId, 'rule.view');
  return rule;
}

async function list(userId, { workspaceId, projectId }) {
  if (projectId) {
    await resolveAccess({ workspaceId, projectId }, userId, 'rule.view');
    // Both rules scoped to this project and workspace-wide rules apply here —
    // a project member should see everything that can actually touch their
    // tasks, not just the ones created inside this specific project.
    return prisma.rule.findMany({
      where: { workspaceId, OR: [{ projectId }, { projectId: null }] },
      orderBy: { createdAt: 'desc' }
    });
  }

  const workspaceMember = await getWorkspaceMember(workspaceId, userId);
  if (!isWorkspaceAdmin(workspaceMember.role)) {
    throw ApiError.forbidden('Only workspace admins can view all rules across a workspace');
  }
  return prisma.rule.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' } });
}

async function update(id, userId, data) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) throw ApiError.notFound('Rule not found');
  await resolveAccess(rule, userId, 'rule.manage');

  if (data.trigger !== undefined) assertValidTrigger(data.trigger);
  if (data.conditions !== undefined) assertValidConditions(data.conditions);
  if (data.actions !== undefined) assertValidActions(data.actions);

  // Re-enabling clears the auto-disable trail and gives the rule a fresh
  // failure-streak count — the user presumably just fixed what was breaking it,
  // so it shouldn't be one failure away from being disabled again immediately.
  const reenabling = data.enabled === true && rule.enabled === false && rule.autoDisabledAt;

  return prisma.rule.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.enabled !== undefined && { enabled: !!data.enabled }),
      ...(data.trigger !== undefined && { trigger: data.trigger }),
      ...(data.conditions !== undefined && { conditions: data.conditions }),
      ...(data.actions !== undefined && { actions: data.actions }),
      ...(reenabling && { autoDisabledAt: null, consecutiveFailCount: 0 })
    }
  });
}

async function remove(id, userId) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) throw ApiError.notFound('Rule not found');
  await resolveAccess(rule, userId, 'rule.manage');
  await prisma.rule.delete({ where: { id } });
  return true;
}

// ── Templates ─────────────────────────────────────────────────────────────────

const listTemplates = () =>
  RULE_TEMPLATES.map(({ key, name, description, params }) => ({ key, name, description, params }));

async function applyTemplate(key, userId, { workspaceId, projectId = null, params, name }) {
  const template = getTemplate(key);
  if (!template) throw ApiError.notFound('Template not found');

  let materialized;
  try {
    materialized = materializeTemplate(template, params);
  } catch (err) {
    throw ApiError.badRequest(err.message);
  }

  return create(userId, {
    name: name || template.name,
    description: template.description,
    workspaceId,
    projectId,
    trigger: materialized.trigger,
    conditions: materialized.conditions,
    actions: materialized.actions,
    enabled: true,
    templateKey: key
  });
}

// ── Dry run ───────────────────────────────────────────────────────────────────
// Evaluates a rule's conditions against a real task and previews what each
// action WOULD do, without calling any write-side service — so a rule can be
// trusted before it's enabled. Mirrors actionExecutor's own resolution logic
// (imported, not re-implemented) so the preview can't drift from reality.

function previewAction(action, task, ctx) {
  const { type, value } = action || {};
  const def = ACTIONS[type];
  if (!def?.implemented) return { type, noop: true, summary: `Action "${type}" is not implemented yet` };

  switch (type) {
    case 'ASSIGN_TO': {
      const assigneeId = resolveAssignee(value, task, ctx);
      const already = task.assignees.some((a) => a.userId === assigneeId);
      return { type, noop: already, summary: already ? 'Already assigned to this user' : 'Assign to a new user' };
    }
    case 'UNASSIGN_ALL':
      return {
        type,
        noop: task.assignees.length === 0,
        summary: task.assignees.length ? `Remove ${task.assignees.length} assignee(s)` : 'No assignees to remove'
      };
    case 'SET_STATUS':
      return { type, noop: task.status === value, summary: task.status === value ? `Already ${value}` : `Status: ${task.status} → ${value}` };
    case 'SET_PRIORITY':
      return { type, noop: task.priority === value, summary: task.priority === value ? `Already ${value}` : `Priority: ${task.priority} → ${value}` };
    case 'SET_BILLABLE': {
      const next = value === true || value === 'true';
      return { type, noop: task.billable === next, summary: task.billable === next ? `Already ${next ? 'billable' : 'not billable'}` : `Billable: ${next ? 'Yes' : 'No'}` };
    }
    case 'SET_TASK_TYPE':
      return { type, noop: task.taskType === value, summary: task.taskType === value ? `Already ${value}` : `Task type: ${task.taskType} → ${value}` };
    case 'SET_DUE_DATE': {
      const next = resolveDueDate(value);
      return { type, noop: false, summary: `Due date → ${next ? next.toDateString() : 'cleared'}` };
    }
    case 'MOVE_TO_SECTION':
      return { type, noop: task.listId === value, summary: task.listId === value ? 'Already in that section' : 'Move to a different section' };
    case 'ADD_COMMENT':
      return { type, noop: false, summary: `Comment: "${renderTemplate(value, task)}"` };
    default:
      return { type, noop: true, summary: `Action "${type}" has no preview` };
  }
}

async function dryRun(id, userId, taskId) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) throw ApiError.notFound('Rule not found');
  await resolveAccess(rule, userId, 'rule.view');

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignees: { select: { userId: true } } }
  });
  if (!task) throw ApiError.notFound('Task not found');

  const conditionsMet = evaluateConditions(rule.conditions, task);
  const actions = conditionsMet
    ? rule.actions.map((action) => previewAction(action, task, { actingUserId: rule.createdById }))
    : [];

  return { conditionsMet, actions };
}

// ── Run history ───────────────────────────────────────────────────────────────

async function getRuns(id, userId, { cursor, limit = 30 } = {}) {
  const rule = await prisma.rule.findUnique({ where: { id } });
  if (!rule) throw ApiError.notFound('Rule not found');
  await resolveAccess(rule, userId, 'rule.view');

  const where = { ruleId: id };
  if (cursor) where.createdAt = { lt: new Date(cursor) };

  const rows = await prisma.ruleRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit + 1 });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

  return { items, nextCursor, hasMore };
}

export const ruleService = {
  getSchema,
  create,
  getById,
  list,
  update,
  remove,
  listTemplates,
  applyTemplate,
  dryRun,
  getRuns
};

export default ruleService;
