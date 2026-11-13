import prisma from '../../core/database/prisma.js';
import { ApiError } from '../../core/utils/apiResponse.js';
import { emitToProject, emitToWorkspace } from '../../core/socket.js';
import { cloudinary, signAttachment } from '../../core/cloudinary.js';
import { stripHtml } from '../../core/utils/sanitize.js';
import {
  EVENT_TYPES,
  buildEvent,
  recordEvent,
  recordEvents,
  diffTaskUpdate
} from '../rules/domainEvents.js';

// ── Cloudinary URL → publicId fallback for old attachments without publicId ──
// URL format: https://res.cloudinary.com/{cloud}/image/upload/v1234/asana_clone/abc123.jpg
// We need: "asana_clone/abc123" (folder + filename without extension)
function extractPublicIdFromUrl(url) {
  if (!url) return null;
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.*?)(?:\.[a-zA-Z0-9]+)?$/);
    return match?.[1] || null;
  } catch { return null; }
}

// ── Workspace role hierarchy ──────────────────────────────────────────────────
// OWNER / ADMIN  →  workspace administrators (bypass all project-level checks)
// MEMBER         →  regular workspace member (governed by ProjectRole within each project)
// GUEST          →  external user (can ONLY access projects they're explicitly added to)

function isWorkspaceAdmin(workspaceRole) {
  return workspaceRole === 'OWNER' || workspaceRole === 'ADMIN';
}

// ── Project-level permission helpers ─────────────────────────────────────────
// projectRole: 'EDITOR' | 'COMMENTER' | 'VIEWER' | null (not a project member)

function canAccessProject(workspaceRole, projectVisibility, projectRole) {
  if (isWorkspaceAdmin(workspaceRole)) return true;
  // Public projects: any workspace member (including guests) can view
  if (projectVisibility === 'PUBLIC') return true;
  // Private projects: must be an explicit project member
  return projectRole !== null;
}

// Granular check — uses customPermissions from the new role system (CustomProjectRole),
// with legacy projectRole enum as fallback for un-migrated data.
function hasPermission(workspaceRole, projectRole, customPermissions, key) {
  if (isWorkspaceAdmin(workspaceRole)) return true;
  // New role system: customPermissions comes from customRole.permissions (always check first)
  if (customPermissions && typeof customPermissions === 'object') return !!customPermissions[key];
  // Legacy fallback: check the old projectRole enum
  if (projectRole === 'EDITOR') return true;
  if (projectRole === 'COMMENTER' && (key === 'comment.create' || key === 'comment.delete' || key === 'time.track')) return true;
  return false;
}

// ── Context resolvers ─────────────────────────────────────────────────────────

async function getContextFromList(listId, userId) {
  const list = await prisma.list.findUnique({
    where: { id: listId },
    include: {
      board: {
        include: {
          project: {
            include: {
              workspace: { include: { members: { where: { userId }, include: { customRole: { select: { permissions: true } } } } } },
              members: { where: { userId }, include: { customRole: true } }
            }
          }
        }
      }
    }
  });

  if (!list) throw ApiError.notFound('List not found');

  const project = list.board.project;
  const workspaceMember = project.workspace.members[0];
  if (!workspaceMember) throw ApiError.forbidden('You are not a member of this workspace');

  const projectMember = project.members[0] || null;
  const projectRole = projectMember?.projectRole ?? null;
  const customPermissions = projectMember?.customRole?.permissions ?? workspaceMember.customRole?.permissions ?? null;

  if (!canAccessProject(workspaceMember.role, project.visibility, projectRole)) {
    const canViewPrivate = !!(customPermissions?.['project.viewPrivate']);
    if (!canViewPrivate) throw ApiError.forbidden('You do not have access to this project');
  }

  return { list, workspaceMember, projectRole, customPermissions, projectId: project.id, workspaceId: project.workspaceId };
}

async function getContextFromTask(taskId, userId) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      list: {
        include: {
          board: {
            include: {
              project: {
                include: {
                  workspace: { include: { members: { where: { userId }, include: { customRole: { select: { permissions: true } } } } } },
                  members: { where: { userId }, include: { customRole: true } }
                }
              }
            }
          }
        }
      }
    }
  });

  if (!task) throw ApiError.notFound('Task not found');

  const project = task.list.board.project;
  const workspaceMember = project.workspace.members[0];
  if (!workspaceMember) throw ApiError.forbidden('You are not a member of this workspace');

  const projectMember = project.members[0] || null;
  const projectRole = projectMember?.projectRole ?? null;
  const customPermissions = projectMember?.customRole?.permissions ?? workspaceMember.customRole?.permissions ?? null;

  if (!canAccessProject(workspaceMember.role, project.visibility, projectRole)) {
    const canViewPrivate = !!(customPermissions?.['project.viewPrivate']);
    if (!canViewPrivate) throw ApiError.forbidden('You do not have access to this project');
  }

  return { task, workspaceMember, projectRole, customPermissions, projectId: project.id, workspaceId: project.workspaceId };
}

// Current assignees, in the shape the board/list views already render
// (task.assignees[i].user...) — used to broadcast a full, correct list after
// any add/remove/reassign, rather than trying to patch the array in place.
const getAssigneesForBroadcast = (taskId) =>
  prisma.taskAssignee.findMany({ where: { taskId }, include: { user: true } });

// ── Duplicate helpers ─────────────────────────────────────────────────────────

// A duplicate always starts incomplete (same as Asana) — everything else is preserved.
const COMPLETED_STATUSES = ['DONE', 'VERIFIED'];

// Safety net so a corrupted parent/child cycle can't recurse forever.
const MAX_DUPLICATE_DEPTH = 20;

// Include shape the List view expects for a freshly rendered row
// (mirrors listService.getAll + the extras the client needs for custom fields).
const DUPLICATE_RESULT_INCLUDE = {
  list: { select: { id: true, name: true } },
  assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
  attachments: true,
  tags: { select: { id: true, name: true, color: true } },
  customFieldValues: { select: { id: true, fieldId: true, value: true } },
  subtasks: {
    orderBy: { position: 'asc' },
    include: {
      assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
      customFieldValues: { select: { id: true, fieldId: true, value: true } },
      subtasks: {
        orderBy: { position: 'asc' },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          customFieldValues: { select: { id: true, fieldId: true, value: true } }
        }
      }
    }
  }
};

// Copies one task row plus the selected relations, then recurses into subtasks.
// Never copied: comments, activity logs, time entries, actualTime, timer state and
// linkedMilestoneId — copying those would either be wrong (derived data) or corrupt
// the multi-project milestone links.
async function copyTaskTree(tx, sourceId, { listId, parentId, position, title, inc, createdById, depth = 0 }) {
  if (depth > MAX_DUPLICATE_DEPTH) return null;

  const src = await tx.task.findUnique({
    where: { id: sourceId },
    include: {
      assignees: { select: { userId: true } },
      attachments: true,
      tags: { select: { id: true } },
      customFieldValues: { select: { fieldId: true, value: true } },
      subtasks: { orderBy: { position: 'asc' }, select: { id: true } }
    }
  });
  if (!src) return null;

  const copy = await tx.task.create({
    data: {
      title: title ?? src.title,
      description: inc.description ? src.description : null,
      taskType: src.taskType,
      status: COMPLETED_STATUSES.includes(src.status) ? 'TODO' : src.status,
      priority: src.priority,
      dueDate: inc.dueDate ? src.dueDate : null,
      estimatedTime: inc.estimatedTime ? src.estimatedTime : null,
      billable: inc.billable ? src.billable : null,
      listId,
      parentId,
      position,
      createdById: createdById ?? null,
      ...(inc.assignees && src.assignees.length > 0 && {
        assignees: { create: src.assignees.map(a => ({ userId: a.userId })) }
      }),
      ...(inc.tags && src.tags.length > 0 && {
        tags: { connect: src.tags.map(t => ({ id: t.id })) }
      }),
      ...(inc.customFields && src.customFieldValues.length > 0 && {
        customFieldValues: {
          create: src.customFieldValues.map(v => ({ fieldId: v.fieldId, value: v.value }))
        }
      }),
      // The copy points at the SAME Cloudinary asset — no re-upload. taskService.delete
      // refuses to purge an asset that is still referenced by another task's attachment.
      ...(inc.attachments && src.attachments.length > 0 && {
        attachments: {
          create: src.attachments.map(a => ({
            filename: a.filename,
            url: a.url,
            publicId: a.publicId,
            mimeType: a.mimeType,
            size: a.size,
            userId: a.userId // keep the original uploader
          }))
        }
      })
    }
  });

  if (inc.subtasks) {
    let childPosition = 0;
    for (const sub of src.subtasks) {
      await copyTaskTree(tx, sub.id, {
        listId,
        parentId: copy.id,
        position: childPosition++,
        title: null, // subtasks keep their own name
        inc,
        createdById,
        depth: depth + 1
      });
    }
  }

  return copy;
}

// Slot the copy directly below the original (positions are Float, so a midpoint works).
// When the copy is detached from its parent it has no comparable sibling — append instead.
async function positionBelow(tx, task, newParentId) {
  if (newParentId !== (task.parentId || null)) {
    const last = await tx.task.findFirst({
      where: { listId: task.listId, parentId: newParentId },
      orderBy: { position: 'desc' }
    });
    return last ? last.position + 1 : 0;
  }

  const next = await tx.task.findFirst({
    where: { listId: task.listId, parentId: newParentId, position: { gt: task.position } },
    orderBy: { position: 'asc' }
  });
  return next ? (task.position + next.position) / 2 : task.position + 1;
}

// ── Task Service ──────────────────────────────────────────────────────────────
export const taskService = {

  // Create task or subtask
  async create(listId, userId, taskData, excludeSocketId) {
    const { description, status, priority, dueDate, estimatedTime, taskType, parentId } = taskData;
    if (Object.prototype.hasOwnProperty.call(taskData, 'actualTime')) {
      throw ApiError.badRequest(
        'Actual time is computed from time entries. Use the time-tracking API to log time.'
      );
    }
    const title = stripHtml(taskData.title);

    const { list, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromList(listId, userId);

    const permKey = parentId ? 'subtask.create' : 'task.create';
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, permKey)) {
      throw ApiError.forbidden(`You do not have permission to create ${parentId ? 'subtasks' : 'tasks'}`);
    }

    const lastTask = await prisma.task.findFirst({
      where: { listId, parentId: parentId || null },
      orderBy: { position: 'desc' }
    });
    const position = lastTask ? lastTask.position + 1 : 0;

    // The task row and its rule event commit together — see modules/rules/outbox.js
    // for why the event must not be written outside this transaction.
    const task = await prisma.$transaction(async (tx) => {
      const created = await tx.task.create({
        data: {
          title,
          description: description || null,
          taskType: taskType || 'DEFAULT_TASK',
          status: status || 'TODO',
          priority: priority || 'LOW',
          dueDate: dueDate ? new Date(dueDate) : null,
          estimatedTime: estimatedTime != null ? parseInt(estimatedTime) : null,
          listId,
          parentId: parentId || null,
          position,
          createdById: userId
        },
        include: {
          list: { select: { id: true, name: true } },
          assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          subtasks: true
        }
      });

      await recordEvent(tx, buildEvent({
        type: EVENT_TYPES.TASK_CREATED,
        workspaceId,
        projectId,
        taskId: created.id,
        actorId: userId,
        data: {
          listId,
          parentId: parentId || null,
          isSubtask: Boolean(parentId),
          title: created.title,
          status: created.status,
          priority: created.priority
        }
      }));

      return created;
    });

    try {
      await prisma.activityLog.create({
        data: { action: parentId ? 'SUBTASK_CREATED' : 'TASK_CREATED', details: { title, parentId: parentId || null }, userId, taskId: task.id }
      });
    } catch (e) {
      // Don't fail task creation if activity log fails
    }

    // NOTE: task_created emit removed - frontend handles real-time via instant_change
    // emitToProject(projectId, 'task_created', { task, listId }, excludeSocketId);
    return task;
  },

  // Duplicate a task — deep-copies the selected parts into a new task placed
  // directly below the original. `include` flags mirror Asana's Duplicate dialog.
  async duplicate(taskId, userId, payload = {}, excludeSocketId) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    const isSubtask = !!task.parentId;
    const permKey = isSubtask ? 'subtask.create' : 'task.create';
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, permKey)) {
      throw ApiError.forbidden(`You do not have permission to create ${isSubtask ? 'subtasks' : 'tasks'}`);
    }

    // Defaults match Asana: assignee and due date are OFF unless asked for.
    const inc = {
      description: true,
      assignees: false,
      subtasks: true,
      attachments: true,
      tags: true,
      customFields: true,
      dueDate: false,
      estimatedTime: true,
      billable: true,
      parentTask: true,
      ...(payload.include && typeof payload.include === 'object' ? payload.include : {})
    };

    const rawTitle = payload.title ? stripHtml(payload.title).trim() : '';
    const title = (rawTitle || `Duplicate of: ${task.title}`).slice(0, 200);

    // Keep the copy under the same parent unless the caller detached it.
    const newParentId = inc.parentTask ? (task.parentId || null) : null;

    const created = await prisma.$transaction(
      async (tx) => {
        const position = await positionBelow(tx, task, newParentId);
        return copyTaskTree(tx, task.id, {
          listId: task.listId,
          parentId: newParentId,
          position,
          title,
          inc,
          createdById: userId
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

    if (!created) throw ApiError.notFound('Task not found');

    const duplicated = await prisma.task.findUnique({
      where: { id: created.id },
      include: DUPLICATE_RESULT_INCLUDE
    });

    if (duplicated?.attachments?.length) {
      duplicated.attachments = duplicated.attachments.map(signAttachment);
    }

    try {
      await prisma.activityLog.create({
        data: {
          action: 'TASK_DUPLICATED',
          details: { title, sourceTaskId: task.id, sourceTitle: task.title },
          userId,
          taskId: duplicated.id
        }
      });
    } catch (e) {
      // Don't fail the duplicate if activity logging fails
    }

    // Real-time UI is driven by the frontend's instant_change channel (same as create),
    // so only the My Tasks fallback needs a server-side emit.
    const assigneeIds = (duplicated.assignees || []).map(a => a.userId);
    if (assigneeIds.length) {
      emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds: assigneeIds, action: 'created', taskId: duplicated.id });
    }

    return duplicated;
  },

  // Get task — any member who can access the project (Viewer, Commenter, Editor, Admin)
  async getById(taskId, userId) {
    await getContextFromTask(taskId, userId); // access check

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        list: { include: { board: { include: { project: true } } } },
        parent: { select: { id: true, title: true } },
        subtasks: {
          include: { assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } } },
          orderBy: { position: 'asc' }
        },
        assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
        tags: { select: { id: true, name: true, color: true } },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' }
        },
        activityLogs: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20
        }
      }
    });

    if (task?.attachments?.length) {
      task.attachments = task.attachments.map(signAttachment);
    }
    return task;
  },

  // Update task
  //
  // ruleContext is set only by the rules engine (Phase 2) to carry { actorType,
  // depth, chainId } into the recorded events so cascades stay bounded. It is a
  // separate parameter rather than a field on updateData so it can never be
  // injected through the HTTP body.
  async update(taskId, userId, updateData, excludeSocketId, ruleContext = {}) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    // Status-only change → check task.complete; everything else → task.edit
    const statusOnly = Object.keys(updateData).length === 1 && updateData.status !== undefined;
    const permKey = statusOnly ? 'task.complete' : 'task.edit';
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, permKey)) {
      throw ApiError.forbidden('You do not have permission to edit this task');
    }

    if (Object.prototype.hasOwnProperty.call(updateData, 'actualTime')) {
      throw ApiError.badRequest(
        'Actual time is computed from time entries. Use the time-tracking API to log time.'
      );
    }
    const { description, status, priority, dueDate, estimatedTime, taskType, parentId, billable } = updateData;
    const title = updateData.title !== undefined ? stripHtml(updateData.title) : undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.task.update({
        where: { id: taskId },
        data: {
          ...(title && { title }),
          ...(description !== undefined && { description }),
          ...(taskType && { taskType }),
          ...(status && { status }),
          ...(priority && { priority }),
          ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
          ...(estimatedTime !== undefined && { estimatedTime: estimatedTime != null ? parseInt(estimatedTime) : null }),
          ...(parentId !== undefined && { parentId: parentId || null }),
          ...(billable !== undefined && { billable: billable === null ? null : Boolean(billable) })
        },
        include: {
          assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          subtasks: true,
          parent: true
        }
      });

      // One event per field that actually changed. A save that sets a field to the
      // value it already holds records nothing — the engine's first loop guard.
      await recordEvents(tx, diffTaskUpdate({
        before: task,
        after: next,
        base: { workspaceId, projectId, taskId, actorId: userId, ...ruleContext }
      }));

      return next;
    });

    try {
      await prisma.activityLog.create({
        data: { action: 'TASK_UPDATED', details: { changed: Object.keys(updateData) }, userId, taskId }
      });
    } catch (e) {
      // Don't fail task update if activity log fails
    }

    emitToProject(projectId, 'task_updated', updated, excludeSocketId);
    // If status or dueDate changed, notify My Tasks pages (affects tabs/filters)
    if (updateData.status || updateData.dueDate !== undefined) {
      const affectedUserIds = (updated.assignees || []).map(a => a.userId || a.user?.id).filter(Boolean);
      if (affectedUserIds.length) {
        emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds, action: 'updated', taskId });
      }
    }
    return updated;
  },

  // Delete task
  async delete(taskId, userId, excludeSocketId) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    const permKey = task.parentId ? 'subtask.delete' : 'task.delete';
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, permKey)) {
      throw ApiError.forbidden('You do not have permission to delete this task');
    }

    // Clean up Cloudinary files before cascade-deleting the task.
    // Collect ALL task IDs in the subtree (any depth) so their attachments are cleaned.
    const collectSubtreeIds = async (rootId) => {
      const ids = [rootId];
      const children = await prisma.task.findMany({ where: { parentId: rootId }, select: { id: true } });
      for (const child of children) {
        ids.push(...(await collectSubtreeIds(child.id)));
      }
      return ids;
    };
    const allTaskIds = await collectSubtreeIds(taskId);
    const attachments = await prisma.attachment.findMany({
      where: { taskId: { in: allTaskIds } },
      select: { publicId: true, url: true },
    });
    // Fire-and-forget Cloudinary deletes — don't block the task deletion.
    if (attachments.length > 0) {
      const publicIds = [...new Set(
        attachments.map(a => a.publicId || extractPublicIdFromUrl(a.url)).filter(Boolean)
      )];
      // A duplicated task shares the SAME Cloudinary asset as its original, so an
      // asset may only be purged once no attachment outside this subtree points at it.
      const sharedRows = publicIds.length > 0
        ? await prisma.attachment.findMany({
            where: {
              taskId: { notIn: allTaskIds },
              OR: [
                { publicId: { in: publicIds } },
                { url: { in: attachments.map(a => a.url).filter(Boolean) } }
              ]
            },
            select: { publicId: true, url: true },
          })
        : [];
      const stillReferenced = new Set(
        sharedRows.map(a => a.publicId || extractPublicIdFromUrl(a.url)).filter(Boolean)
      );
      const deletableIds = publicIds.filter(id => !stillReferenced.has(id));
      if (deletableIds.length > 0) {
        cloudinary.api.delete_resources(deletableIds, { resource_type: 'image' })
          .catch(err => console.warn('[delete task] Cloudinary bulk cleanup failed (non-fatal):', err.message));
      }
    }

    // Capture assignees before deleting (for My Tasks notification)
    const taskAssignees = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
    const assigneeIds = taskAssignees.map(a => a.userId);

    await prisma.task.delete({ where: { id: taskId } });
    emitToProject(projectId, 'task_deleted', taskId, excludeSocketId);
    // Notify My Tasks pages
    if (assigneeIds.length) {
      emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds: assigneeIds, action: 'deleted', taskId });
    }
    return true;
  },

  // Move task — EDITOR or workspace Admin
  // Reshuffles sibling positions in a single transaction so that:
  //   • the moved task lands at the EXACT requested index in the destination container
  //   • all sibling positions are dense, unique, and stable across reloads
  //   • cross-container moves clean up the source container too
  async moveTask(taskId, userId, moveData, excludeSocketId, ruleContext = {}) {
    const { listId, position, parentId } = moveData;
    const targetIndex = Number.isFinite(position) ? Math.max(0, Math.floor(position)) : 0;
    const newParentId = parentId === undefined ? undefined : (parentId || null);
    console.log('[moveTask v2/transactional]', { taskId, listId, targetIndex, parentId: newParentId });

    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'task.move')) {
      throw ApiError.forbidden('You do not have permission to move tasks');
    }

    // Guard: prevent setting a task as its own ancestor (direct cycle)
    if (newParentId && newParentId === taskId) {
      throw ApiError.badRequest('A task cannot be its own parent');
    }

    // Capture source container BEFORE the move so we can reshuffle it too
    const sourceListId = task.listId;
    const sourceParentId = task.parentId || null;
    const destinationParentId = newParentId === undefined ? sourceParentId : newParentId;
    const sameContainer = sourceListId === listId && sourceParentId === destinationParentId;

    // Deeper cycle guard: walk up the destination parent chain to ensure
    // we're not nesting a task inside one of its own descendants.
    if (destinationParentId) {
      let cursor = destinationParentId;
      const visited = new Set();
      while (cursor && !visited.has(cursor)) {
        if (cursor === taskId) {
          throw ApiError.badRequest('Cannot move a task inside its own subtree');
        }
        visited.add(cursor);
        const parent = await prisma.task.findUnique({ where: { id: cursor }, select: { parentId: true } });
        cursor = parent?.parentId || null;
      }
    }

    // Helper: rewrite an ordered list of task IDs to dense positions.
    // Uses sequential prisma.task.update inside the transaction — slow for very
    // large lists but bulletproof. The 15s transaction timeout below covers it.
    const STEP = 1024;
    const bulkRepositioned = async (tx, idsInOrder) => {
      for (let i = 0; i < idsInOrder.length; i++) {
        await tx.task.update({
          where: { id: idsInOrder[i] },
          data: { position: (i + 1) * STEP },
        });
      }
    };

    const updated = await prisma.$transaction(
      async (tx) => {
        // 1. Detach the moved task: update its listId/parentId and park it at sentinel position -1.
        await tx.task.update({
          where: { id: taskId },
          data: {
            listId,
            position: -1,
            ...(newParentId !== undefined && { parentId: newParentId }),
          },
        });

        // 2. Fetch destination siblings (excluding the moved task) in current order.
        const destSiblings = await tx.task.findMany({
          where: { listId, parentId: destinationParentId, NOT: { id: taskId } },
          orderBy: { position: 'asc' },
          select: { id: true },
        });

        // 3. Splice the moved task in at the requested index.
        const destOrderedIds = destSiblings.map((s) => s.id);
        const insertAt = Math.min(targetIndex, destOrderedIds.length);
        destOrderedIds.splice(insertAt, 0, taskId);

        // 4. Single-statement bulk reposition of the destination container.
        await bulkRepositioned(tx, destOrderedIds);

        // 5. If the source container changed, re-densify it too in one statement.
        if (!sameContainer) {
          const sourceSiblings = await tx.task.findMany({
            where: { listId: sourceListId, parentId: sourceParentId },
            orderBy: { position: 'asc' },
            select: { id: true },
          });
          await bulkRepositioned(tx, sourceSiblings.map((s) => s.id));
        }

        // 6. Record the rule event. Only a genuine container change counts as a
        //    move — reordering within the same section is not a trigger.
        if (!sameContainer) {
          await recordEvent(tx, buildEvent({
            type: EVENT_TYPES.TASK_MOVED,
            workspaceId,
            projectId,
            taskId,
            actorId: userId,
            ...ruleContext,
            data: {
              fromListId: sourceListId,
              toListId: listId,
              fromParentId: sourceParentId,
              toParentId: destinationParentId,
              position: targetIndex
            }
          }));
        }

        // 7. Return the moved task with its joined data.
        return tx.task.findUnique({
          where: { id: taskId },
          include: {
            list: { select: { id: true, name: true } },
            assignees: { include: { user: { select: { id: true, name: true, avatar: true } } } },
          },
        });
      },
      { timeout: 15000, maxWait: 5000 }
    ).catch((err) => {
      console.error('[moveTask] transaction failed', {
        taskId, listId, targetIndex, parentId: newParentId,
        sourceListId, sourceParentId, sameContainer,
        error: err?.message,
        code: err?.code,
        meta: err?.meta,
      });
      throw err;
    });

    // Activity log is non-critical — never let it fail the move.
    try {
      await prisma.activityLog.create({
        data: { action: 'TASK_MOVED', details: { fromList: task.listId, toList: listId }, userId, taskId },
      });
    } catch (logErr) {
      console.warn('[moveTask] activityLog write failed (non-fatal)', logErr?.message);
    }

    emitToProject(
      projectId,
      'task_moved',
      { taskId, fromList: task.listId, toList: listId, position: targetIndex, parentId: destinationParentId },
      excludeSocketId
    );
    return updated;
  },

  // Assign user
  async assignUser(taskId, userId, assigneeId, excludeSocketId, ruleContext = {}) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'task.assign')) {
      throw ApiError.forbidden('You do not have permission to assign users');
    }

    const existing = await prisma.taskAssignee.findUnique({
      where: { userId_taskId: { userId: assigneeId, taskId } }
    });
    if (existing) throw ApiError.conflict('User is already assigned to this task');

    const assignee = await prisma.$transaction(async (tx) => {
      const created = await tx.taskAssignee.create({
        data: { userId: assigneeId, taskId },
        include: { user: true }
      });

      await recordEvent(tx, buildEvent({
        type: EVENT_TYPES.TASK_ASSIGNED,
        workspaceId,
        projectId,
        taskId,
        actorId: userId,
        ...ruleContext,
        data: { assigneeId, taskTitle: task.title }
      }));

      return created;
    });

    emitToProject(projectId, 'user_assigned', { taskId, assignee }, excludeSocketId);
    // Board/list views only listen for the generic 'task_updated' event, not the
    // specific ones above — without this, an assignment made from outside the
    // viewer's own tab (another user, or a rule running in the worker process)
    // never shows up live, only after a manual refresh.
    emitToProject(projectId, 'task_updated', { id: taskId, assignees: await getAssigneesForBroadcast(taskId) }, excludeSocketId);
    // Notify workspace so My Tasks pages refresh
    emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds: [assigneeId], action: 'assigned', taskId, assignedUserId: assigneeId, taskTitle: task.title });
    return assignee;
  },

  // Reassign — remove all current assignees and assign a single new one
  async reassignUser(taskId, userId, newAssigneeId, excludeSocketId, ruleContext = {}) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'task.assign')) {
      throw ApiError.forbidden('You do not have permission to assign users');
    }

    // Get current assignees before removing (for socket notification)
    const currentAssignees = await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } });
    const oldUserIds = currentAssignees.map(a => a.userId);

    const eventBase = { workspaceId, projectId, taskId, actorId: userId, ...ruleContext };

    // Remove all current assignees, add the new one, and record both sides of the
    // swap as events — all in one transaction.
    const assignee = await prisma.$transaction(async (tx) => {
      await tx.taskAssignee.deleteMany({ where: { taskId } });
      await tx.taskAssignee.create({ data: { userId: newAssigneeId, taskId } });

      await recordEvents(tx, [
        // The replaced assignee was genuinely unassigned; re-adding the same person
        // is a no-op and records nothing.
        ...oldUserIds
          .filter(id => id !== newAssigneeId)
          .map(id => buildEvent({ ...eventBase, type: EVENT_TYPES.TASK_UNASSIGNED, data: { assigneeId: id } })),
        ...(oldUserIds.includes(newAssigneeId) ? [] : [
          buildEvent({
            ...eventBase,
            type: EVENT_TYPES.TASK_ASSIGNED,
            data: { assigneeId: newAssigneeId, taskTitle: task.title, replaced: oldUserIds }
          })
        ])
      ]);

      return tx.taskAssignee.findUnique({
        where: { userId_taskId: { userId: newAssigneeId, taskId } },
        include: { user: true },
      });
    });

    emitToProject(projectId, 'task_reassigned', { taskId, assignee, removedUserIds: oldUserIds }, excludeSocketId);
    emitToProject(projectId, 'task_updated', { id: taskId, assignees: await getAssigneesForBroadcast(taskId) }, excludeSocketId);
    // Notify all affected users (old + new) so My Tasks pages refresh
    const allAffected = Array.from(new Set([...oldUserIds, newAssigneeId]));
    emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds: allAffected, action: 'reassigned', taskId, assignedUserId: newAssigneeId, taskTitle: task.title });
    return assignee;
  },

  // Remove assignee
  async removeAssignee(taskId, userId, assigneeId, excludeSocketId, ruleContext = {}) {
    const { task, workspaceMember, projectRole, customPermissions, projectId, workspaceId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'task.assign')) {
      throw ApiError.forbidden('You do not have permission to remove assignees');
    }

    await prisma.$transaction(async (tx) => {
      await tx.taskAssignee.delete({ where: { userId_taskId: { userId: assigneeId, taskId } } });
      await recordEvent(tx, buildEvent({
        type: EVENT_TYPES.TASK_UNASSIGNED,
        workspaceId,
        projectId,
        taskId,
        actorId: userId,
        ...ruleContext,
        data: { assigneeId }
      }));
    });

    emitToProject(projectId, 'user_removed', { taskId, assigneeId }, excludeSocketId);
    emitToProject(projectId, 'task_updated', { id: taskId, assignees: await getAssigneesForBroadcast(taskId) }, excludeSocketId);
    // Notify workspace so My Tasks pages refresh
    emitToWorkspace(workspaceId, 'my_tasks_changed', { affectedUserIds: [assigneeId], action: 'unassigned', taskId });
    return true;
  },

  // Add attachment
  async addAttachment(taskId, userId, fileData) {
    const { task, workspaceMember, projectRole, customPermissions, projectId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'attachment.add')) {
      throw ApiError.forbidden('You do not have permission to add attachments');
    }

    const attachment = await prisma.attachment.create({
      data: { ...fileData, taskId, userId },
      include: { user: { select: { id: true, name: true } } }
    });

    const signed = signAttachment(attachment);
    emitToProject(projectId, 'attachment_added', { taskId, attachment: signed });
    return signed;
  },

  // Remove attachment — deletes from Cloudinary CDN first, then removes the DB row.
  async removeAttachment(taskId, userId, attachmentId) {
    const { task, workspaceMember, projectRole, customPermissions, projectId } = await getContextFromTask(taskId, userId);

    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'attachment.delete')) {
      throw ApiError.forbidden('You do not have permission to remove attachments');
    }

    // Always fetch the attachment — needed for both ownership check and Cloudinary delete.
    const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    if (!attachment) throw ApiError.notFound('Attachment not found');

    // Who can delete: workspace admin OR has attachment.delete permission OR owns the attachment
    const canDeleteAny = isWorkspaceAdmin(workspaceMember.role) || hasPermission(workspaceMember.role, projectRole, customPermissions, 'attachment.delete');
    if (!canDeleteAny && attachment.userId !== userId) {
      throw ApiError.forbidden('You can only remove your own attachments');
    }

    // 1. Delete from Cloudinary CDN (best-effort — don't block DB delete on CDN failure).
    const publicId = attachment.publicId || extractPublicIdFromUrl(attachment.url);
    if (publicId) {
      // Determine resource_type from mimeType — Cloudinary requires exact type for deletion
      const mime = (attachment.mimeType || '').toLowerCase();
      const resourceType = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : 'raw';
      try {
        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      } catch (err) {
        console.warn('[removeAttachment] Cloudinary delete failed (non-fatal):', err.message);
      }
    }

    // 2. Delete from DB.
    await prisma.attachment.delete({ where: { id: attachmentId } });
    emitToProject(projectId, 'attachment_removed', { taskId, attachmentId });
    return true;
  },

  // Search tasks — any workspace member (read-only)
  async search(workspaceId, userId, query) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId }
    });
    if (!membership) throw ApiError.forbidden('You are not a member of this workspace');

    const isAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
    const isGuest = membership.role === 'GUEST';

    // Build project-level filter based on role
    let projectFilter = { workspaceId };
    if (!isAdmin) {
      // Members: see tasks from PUBLIC projects + projects they're added to
      // Guests: see tasks ONLY from projects they're added to
      projectFilter = {
        workspaceId,
        OR: [
          ...(isGuest ? [] : [{ visibility: 'PUBLIC' }]),
          { members: { some: { userId } } }
        ]
      };
    }

    // Build search conditions
    const searchConditions = query?.trim()
      ? [
          { title: { contains: query.trim(), mode: 'insensitive' } },
          { description: { contains: query.trim(), mode: 'insensitive' } }
        ]
      : [];

    const where = {
      list: { board: { project: projectFilter } },
      ...(searchConditions.length > 0 && { OR: searchConditions })
    };

    return prisma.task.findMany({
      where,
      include: {
        list: {
          select: {
            id: true,
            name: true,
            board: {
              select: {
                id: true,
                project: { select: { id: true, name: true, color: true } }
              }
            }
          }
        },
        assignees: {
          include: { user: { select: { id: true, name: true, avatar: true } } }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 20
    });
  },

  // My Tasks
  // - OWNER/ADMIN: { myTasks: [...], teamTasks: [...] } (own + all member tasks in workspace)
  // - MEMBER: { myTasks: [...] } (own tasks in PUBLIC projects + projects they're a member of)
  // - GUEST: { myTasks: [...] } (own tasks only in projects they're explicitly added to)
  async getMyTasks(workspaceId, userId) {
    const membership = await prisma.workspaceMember.findFirst({
      where: { workspaceId, userId }
    });
    if (!membership) throw ApiError.forbidden('You are not a member of this workspace');

    const isAdmin = membership.role === 'OWNER' || membership.role === 'ADMIN';
    const isGuest = membership.role === 'GUEST';

    const taskInclude = {
      list: {
        select: {
          id: true,
          name: true,
          board: {
            select: {
              id: true,
              projectId: true,
              project: { select: { id: true, name: true, color: true } }
            }
          }
        }
      },
      assignees: {
        include: { user: { select: { id: true, name: true, avatar: true } } }
      }
    };

    // Build project visibility filter for non-admin users
    let projectFilter = { workspaceId };
    if (!isAdmin) {
      projectFilter = {
        workspaceId,
        OR: [
          ...(isGuest ? [] : [{ visibility: 'PUBLIC' }]),
          { members: { some: { userId } } }
        ]
      };
    }

    // My own tasks — only where the user is the PRIMARY assignee (first assigned).
    // We fetch tasks where the user is ANY assignee, then filter server-side to
    // keep only those where the user is the first assignee (earliest createdAt).
    const myCandidates = await prisma.task.findMany({
      where: {
        assignees: { some: { userId } },
        list: { board: { project: projectFilter } },
      },
      include: {
        ...taskInclude,
        assignees: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Keep only tasks where the user is the FIRST (primary) assignee
    const myTasks = myCandidates.filter(t => {
      const firstAssignee = t.assignees?.[0];
      return firstAssignee?.userId === userId || firstAssignee?.user?.id === userId;
    });

    // For OWNER/ADMIN: also fetch all tasks across workspace that have at least one assignee
    // (excluding tasks already in myTasks). Shows who is working on what.
    if (isAdmin) {
      const allAssignedTasks = await prisma.task.findMany({
        where: {
          assignees: { some: {} },
          list: { board: { project: { workspaceId } } },
        },
        include: {
          ...taskInclude,
          assignees: {
            include: { user: { select: { id: true, name: true, avatar: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Team tasks = tasks whose primary assignee is NOT the current user
      const myTaskIds = new Set(myTasks.map(t => t.id));
      const teamTasks = allAssignedTasks.filter(t => !myTaskIds.has(t.id));

      return { myTasks, teamTasks };
    }

    return { myTasks, teamTasks: [] };
  },

  // ── Multi-project milestones ────────────────────────────────────────────────

  /**
   * Get all projects a milestone is linked to (including its home project).
   * Returns: [{ projectId, projectName, projectColor, taskId }]
   */
  async getMilestoneProjects(taskId, userId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        list: { include: { board: { include: { project: { select: { id: true, name: true, color: true } } } } } },
        milestoneLinks: {
          include: {
            list: { include: { board: { include: { project: { select: { id: true, name: true, color: true } } } } } },
          },
        },
      },
    });
    if (!task) throw ApiError.notFound('Task not found');

    // Home project
    const results = [{
      projectId: task.list.board.project.id,
      projectName: task.list.board.project.name,
      projectColor: task.list.board.project.color,
      taskId: task.id,
      isHome: true,
    }];

    // Linked copies in other projects
    for (const link of task.milestoneLinks) {
      results.push({
        projectId: link.list.board.project.id,
        projectName: link.list.board.project.name,
        projectColor: link.list.board.project.color,
        taskId: link.id,
        isHome: false,
      });
    }

    // Also check if THIS task is itself a linked copy — include the original's project
    if (task.linkedMilestoneId) {
      const original = await prisma.task.findUnique({
        where: { id: task.linkedMilestoneId },
        include: {
          list: { include: { board: { include: { project: { select: { id: true, name: true, color: true } } } } } },
          milestoneLinks: {
            where: { id: { not: taskId } },
            include: {
              list: { include: { board: { include: { project: { select: { id: true, name: true, color: true } } } } } },
            },
          },
        },
      });
      if (original) {
        // Original's home project
        results.length = 0; // rebuild to avoid duplicates
        results.push({
          projectId: original.list.board.project.id,
          projectName: original.list.board.project.name,
          projectColor: original.list.board.project.color,
          taskId: original.id,
          isHome: true,
        });
        // All links including current task
        for (const link of original.milestoneLinks) {
          results.push({
            projectId: link.list.board.project.id,
            projectName: link.list.board.project.name,
            projectColor: link.list.board.project.color,
            taskId: link.id,
            isHome: false,
          });
        }
        // Also add current task
        results.push({
          projectId: task.list.board.project.id,
          projectName: task.list.board.project.name,
          projectColor: task.list.board.project.color,
          taskId: task.id,
          isHome: false,
        });
      }
    }

    return results;
  },

  /**
   * Add a milestone to another project. Creates a new task with just the title
   * in the target project's first section. Links back via linkedMilestoneId.
   */
  async addMilestoneToProject(taskId, userId, targetProjectId) {
    // Permission check — user must have milestone.multiproject permission in the source project
    const { workspaceMember, projectRole, customPermissions } = await getContextFromTask(taskId, userId);
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'milestone.multiproject')) {
      throw ApiError.forbidden('You do not have permission to add milestones to other projects');
    }

    // Get the original milestone
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { include: { board: true } } },
    });
    if (!task) throw ApiError.notFound('Task not found');
    if (task.taskType !== 'MILESTONE') throw ApiError.badRequest('Only milestones can be added to multiple projects');

    // Resolve the original milestone (in case this is already a linked copy)
    const originalId = task.linkedMilestoneId || task.id;

    // Check user has access to the target project
    const targetProject = await prisma.project.findUnique({
      where: { id: targetProjectId },
      include: {
        board: { include: { lists: { orderBy: { position: 'asc' }, take: 1 } } },
        workspace: { include: { members: { where: { userId } } } },
      },
    });
    if (!targetProject) throw ApiError.notFound('Target project not found');
    if (!targetProject.workspace.members[0]) throw ApiError.forbidden('You do not have access to the target project');

    const firstList = targetProject.board?.lists?.[0];
    if (!firstList) throw ApiError.badRequest('Target project has no sections');

    // Check if already linked to this project
    const existingLink = await prisma.task.findFirst({
      where: { linkedMilestoneId: originalId, list: { board: { project: { id: targetProjectId } } } },
    });
    if (existingLink) throw ApiError.conflict('This milestone is already in that project');

    // Also check if the original itself is in the target project
    const originalTask = await prisma.task.findUnique({
      where: { id: originalId },
      include: { list: { include: { board: true } } },
    });
    if (originalTask?.list.board.projectId === targetProjectId) {
      throw ApiError.conflict('This milestone is already in that project');
    }

    // Create the linked copy — name only, everything else empty
    const linkedTask = await prisma.task.create({
      data: {
        title: task.title,
        taskType: 'MILESTONE',
        status: 'TODO',
        priority: 'LOW',
        position: 0,
        listId: firstList.id,
        linkedMilestoneId: originalId,
        createdById: userId,
      },
      include: {
        list: { include: { board: { include: { project: { select: { id: true, name: true, color: true } } } } } },
      },
    });

    const result = {
      projectId: targetProjectId,
      projectName: targetProject.name,
      projectColor: targetProject.color,
      taskId: linkedTask.id,
      isHome: false,
    };

    // Emit to the SOURCE project room so other users viewing this milestone see the update live
    const sourceProjectId = originalTask?.list.board.projectId || task.list?.board?.projectId;
    if (sourceProjectId) {
      emitToProject(sourceProjectId, 'milestone_project_added', {
        milestoneId: originalId,
        linkedProject: result,
      });
    }
// Also emit to the TARGET project so users there see the new milestone appear
    // NOTE: commented out - frontend instant_change handles real-time
    // emitToProject(targetProjectId, 'task_created', { task: linkedTask, listId: firstList.id });
    
    return result;
  },

  /**
   * Remove a milestone from a project. Deletes the linked copy task.
   * Cannot remove from the home project (the original milestone).
   */
  async removeMilestoneFromProject(taskId, userId, projectId) {
    // Permission check on the source task's project
    const { workspaceMember, projectRole, customPermissions } = await getContextFromTask(taskId, userId);
    if (!hasPermission(workspaceMember.role, projectRole, customPermissions, 'milestone.remove')) {
      throw ApiError.forbidden('You do not have permission to remove milestones from projects');
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { list: { include: { board: true } } },
    });
    if (!task) throw ApiError.notFound('Task not found');

    // Resolve the original milestone
    const originalId = task.linkedMilestoneId || task.id;

    // Find the linked copy in the target project
    const linkedCopy = await prisma.task.findFirst({
      where: {
        linkedMilestoneId: originalId,
        list: { board: { projectId } },
      },
      include: { list: { include: { board: true } } },
    });

    // Maybe the task itself IS the copy in that project
    const isOriginalInProject = task.list.board.projectId === projectId && !task.linkedMilestoneId;
    if (isOriginalInProject) {
      throw ApiError.badRequest('Cannot remove a milestone from its home project');
    }

    const taskToDelete = linkedCopy || (task.list.board.projectId === projectId ? task : null);
    if (!taskToDelete) throw ApiError.notFound('Milestone not found in that project');

    await prisma.task.delete({ where: { id: taskToDelete.id } });

    // Emit to source project for live update of the Projects list in detail panel
    const sourceProjectId = task.list.board.projectId;
    emitToProject(sourceProjectId, 'milestone_project_removed', {
      milestoneId: originalId,
      removedProjectId: projectId,
    });
    // Emit to target project so the task disappears from the list view
    emitToProject(projectId, 'task_deleted', taskToDelete.id);

    return { message: 'Milestone removed from project' };
  },
};

export default taskService;
