/**
 * Project-level permission system.
 *
 * Standard roles (EDITOR / COMMENTER / VIEWER) map to predefined permission sets.
 * CUSTOM roles read granular boolean flags from ProjectMember.customPermissions JSON.
 *
 * Permission keys — every atomic action in a project:
 */
export const PROJECT_PERMISSION_KEYS = [
  // Tasks
  { key: 'task.create',      group: 'Tasks',    label: 'Create tasks' },
  { key: 'task.edit',        group: 'Tasks',    label: 'Edit tasks (title, description, status, priority, dates)' },
  { key: 'task.delete',      group: 'Tasks',    label: 'Delete tasks' },
  { key: 'task.move',        group: 'Tasks',    label: 'Move tasks between sections' },
  { key: 'task.assign',      group: 'Tasks',    label: 'Assign / unassign members' },
  { key: 'task.complete',    group: 'Tasks',    label: 'Mark tasks complete / incomplete' },
  { key: 'task.contextMenu', group: 'Tasks',    label: 'Access right-click context menu on tasks' },
  // Subtasks
  { key: 'subtask.create', group: 'Subtasks', label: 'Create subtasks' },
  { key: 'subtask.delete', group: 'Subtasks', label: 'Delete subtasks' },
  // Sections
  { key: 'section.create', group: 'Sections', label: 'Create sections' },
  { key: 'section.edit',   group: 'Sections', label: 'Rename sections' },
  { key: 'section.delete', group: 'Sections', label: 'Delete sections' },
  // Custom fields / columns
  { key: 'field.create',   group: 'Fields',   label: 'Add custom field columns' },
  { key: 'field.delete',   group: 'Fields',   label: 'Delete custom field columns' },
  { key: 'field.edit',     group: 'Fields',   label: 'Edit custom field values' },
  // Comments
  { key: 'comment.create', group: 'Comments', label: 'Add comments' },
  { key: 'comment.delete', group: 'Comments', label: 'Delete own comments' },
  // Project settings
  { key: 'project.edit',        group: 'Project',  label: 'Edit project name, description, color' },
  { key: 'project.delete',      group: 'Project',  label: 'Delete the project' },
  { key: 'project.invite',      group: 'Project',  label: 'Invite / remove project members' },
  { key: 'project.changeRole',  group: 'Project',  label: 'Change member roles' },
  { key: 'project.viewPrivate', group: 'Project',  label: 'View all private projects in workspace' },
  // Attachments
  { key: 'attachment.add',    group: 'Attachments', label: 'Add attachments' },
  { key: 'attachment.delete', group: 'Attachments', label: 'Delete attachments' },
  // Milestones
  { key: 'milestone.multiproject', group: 'Milestones', label: 'Add milestones to other projects' },
  { key: 'milestone.remove',       group: 'Milestones', label: 'Remove milestones from projects' },
  // Time tracking
  { key: 'time.track',     group: 'Time',     label: 'Log and edit time entries' },
  // Reports
  { key: 'report.viewTeam', group: 'Reports', label: 'View team reports (all members\' time & tasks)' },
  { key: 'report.manageRecipients', group: 'Reports', label: 'Manage own saved report recipients' },
  // Rules (automation)
  { key: 'rule.view',   group: 'Rules', label: 'View automation rules and run history' },
  { key: 'rule.manage', group: 'Rules', label: 'Create, edit, enable and delete automation rules' },
];

/**
 * Predefined permission sets for standard roles.
 * EDITOR gets everything. COMMENTER gets view + comment + time. VIEWER gets nothing writable.
 */
// Exported so modules/projects/projectRoleService.js (which seeds the same
// three roles as persisted CustomProjectRole rows) can reuse these directly
// instead of keeping its own copy — two hardcoded lists claiming to describe
// the same role is exactly how rule.view ended up missing from one of them.
export const EDITOR_PERMISSIONS = Object.fromEntries(
  PROJECT_PERMISSION_KEYS.map(p => [p.key, true])
);

export const COMMENTER_PERMISSIONS = {
  'comment.create': true,
  'comment.delete': true,
  'time.track': true,
  'rule.view': true,
};

export const VIEWER_PERMISSIONS = {};

/**
 * Resolve the effective permissions for a project member.
 * @param {string} projectRole - EDITOR | COMMENTER | VIEWER | CUSTOM
 * @param {object|null} customPermissions - JSON from ProjectMember.customPermissions (only used when CUSTOM)
 * @returns {object} - { 'task.create': true, 'task.delete': false, ... } for every key
 */
export function resolveProjectPermissions(projectRole, customPermissions) {
  let base;
  switch (projectRole) {
    case 'EDITOR':    base = EDITOR_PERMISSIONS; break;
    case 'COMMENTER': base = COMMENTER_PERMISSIONS; break;
    case 'VIEWER':    base = VIEWER_PERMISSIONS; break;
    case 'CUSTOM':    base = (typeof customPermissions === 'object' && customPermissions) ? customPermissions : {}; break;
    default:          base = {};
  }
  // Return a full map with false for any missing keys so callers can do `perms['task.delete']` safely.
  const result = {};
  for (const p of PROJECT_PERMISSION_KEYS) {
    result[p.key] = !!base[p.key];
  }
  return result;
}

/**
 * Check a single permission for a project member.
 * Workspace admins (OWNER/ADMIN) bypass all checks and always return true.
 */
export function hasProjectPermission(workspaceRole, projectRole, customPermissions, permissionKey) {
  if (workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') return true;
  const perms = resolveProjectPermissions(projectRole, customPermissions);
  return !!perms[permissionKey];
}

/**
 * Convenience: check if the member can "edit" (equivalent to the old canEditProject).
 * Used as a drop-in replacement in task/list/project services.
 */
export function canEditProject(workspaceRole, projectRole, customPermissions) {
  return hasProjectPermission(workspaceRole, projectRole, customPermissions, 'task.edit');
}

/**
 * Convenience: check if the member can "comment".
 */
export function canCommentProject(workspaceRole, projectRole, customPermissions) {
  return hasProjectPermission(workspaceRole, projectRole, customPermissions, 'comment.create');
}
