import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { socketProjectAdded, socketProjectUpdated, socketProjectRemoved, socketRoleUpdated, socketRoleDeleted, fetchProjects, filterPrivateProjects } from '../store/slices/projectSlice';
import { socketWorkspaceMemberRoleChanged, socketWorkspaceRoleUpdated } from '../store/slices/workspaceSlice';

/**
 * Workspace-level socket — listens for project CRUD events
 * so the sidebar updates live when someone creates/deletes/renames a project.
 */
export const useWorkspaceSocket = ({ onMyTasksChanged } = {}) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentWorkspace } = useAppSelector((state) => state.workspace);
  const { user: currentUser } = useAppSelector((state) => state.auth);
  const { currentProject } = useAppSelector((state) => state.project);
  const workspaceId = currentWorkspace?.id;

  // Derive canViewAllPrivate from the most authoritative available source.
  // currentWorkspace.members[userId].customRole is populated after fetchWorkspace (getById).
  // currentWorkspace.customRole (flat) is populated after fetchWorkspaces (getAll) — now
  // that getAll includes permissions. We check members first, then fall back to the flat
  // field, so the value is correct regardless of which fetch has run.
  const myWsMember = currentWorkspace?.members?.find(m => m.userId === currentUser?.id);
  const myPermissions =
    myWsMember?.customRole?.permissions ??
    currentWorkspace?.customRole?.permissions ??
    {};
  const wsRole = currentWorkspace?.role;
  const isAdmin = wsRole === 'OWNER' || wsRole === 'ADMIN';
  const canViewAllPrivate = isAdmin || !!(myPermissions['project.viewPrivate']);

  const socketRef = useRef(null);
  const onMyTasksChangedRef = useRef(onMyTasksChanged);
  onMyTasksChangedRef.current = onMyTasksChanged;
  // Refs so socket callbacks always read fresh values without re-subscribing the effect.
  // currentWorkspace is intentionally NOT in the dependency array (it would reconnect
  // on every permission change), so any callback that reads workspace/user/project
  // data must go through these refs instead of the closed-over variables.
  const currentWorkspaceRef = useRef(currentWorkspace);
  currentWorkspaceRef.current = currentWorkspace;
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  // Watch canViewAllPrivate for changes and update the project list accordingly.
  // Using a ref that tracks { workspaceId, value } so workspace switches don't
  // mis-trigger (a cross-workspace permission difference is not a real change).
  const canViewAllPrivatePrevRef = useRef({ workspaceId, value: canViewAllPrivate });
  useEffect(() => {
    const prev = canViewAllPrivatePrevRef.current;
    canViewAllPrivatePrevRef.current = { workspaceId, value: canViewAllPrivate };

    // Workspace changed — treat as a fresh start, don't act on the diff
    if (prev.workspaceId !== workspaceId) return;
    // Permission unchanged — nothing to do
    if (prev.value === canViewAllPrivate) return;

    if (canViewAllPrivate) {
      // GRANT — fetch from server to discover newly visible private projects
      if (workspaceId) dispatch(fetchProjects(workspaceId));
    } else {
      // REVOKE — remove inaccessible private projects from state instantly
      const userId = currentUser?.id;
      if (userId) {
        dispatch(filterPrivateProjects({ userId }));
        // Navigate away if currently viewing a private project we lost access to
        const proj = currentProjectRef.current;
        if (proj?.visibility === 'PRIVATE') {
          const isMember = (proj.members ?? []).some(m => m.userId === userId);
          if (!isMember) navigate('/dashboard');
        }
      }
    }
  }, [canViewAllPrivate, workspaceId, dispatch, navigate, currentUser?.id]);

  useEffect(() => {
    if (!workspaceId) return;

    const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

    const socket = io(SOCKET_URL, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 3000,
      timeout: 5000,
      transports: ['polling', 'websocket'],
      upgrade: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join_workspace', workspaceId);
    });

    socket.on('connect_error', () => {});

    // Project created — add to sidebar without a full reload.
    // Private projects are only visible to workspace admins and project members;
    // skip unauthorized users so they never see a project they shouldn't.
    socket.on('project_created', (data) => {
      if (!data?.project?.id) return;
      const project = data.project;
      const wsRole = currentWorkspaceRef.current?.role;
      const isAdmin = wsRole === 'OWNER' || wsRole === 'ADMIN';
      if (project.visibility === 'PRIVATE' && !isAdmin) {
        const isMember = project.members?.some(m => m.userId === currentUserRef.current?.id);
        if (!isMember) return;
      }
      dispatch(socketProjectAdded(project));
    });

    // Project updated (renamed, visibility changed) — patch in place
    socket.on('project_updated', (data) => {
      if (data?.project?.id) dispatch(socketProjectUpdated(data.project));
    });

    // Project deleted — remove from sidebar
    socket.on('project_deleted', (data) => {
      if (data?.projectId) dispatch(socketProjectRemoved(data.projectId));
    });

    // A member was added to a project in this workspace. If the added member
    // is the CURRENT user, add the project to our sidebar instantly. Critical
    // for private projects that weren't visible before being invited.
    socket.on('project_member_added', (data) => {
      if (data?.userId === currentUserRef.current?.id && data?.project?.id) {
        dispatch(socketProjectAdded(data.project));
      }
    });

    // A member was removed from a project. If it's us, remove the project
    // from sidebar (we lost access to a private project).
    socket.on('project_member_removed', (data) => {
      if (data?.userId === currentUserRef.current?.id && data?.projectId) {
        dispatch(socketProjectRemoved(data.projectId));
      }
    });

    // Role permissions updated — admin changed a role's checkboxes.
    // Patch both project members and workspace members so useRole() re-derives instantly.
    // project.viewPrivate changes are handled by the canViewAllPrivate useEffect above.
    socket.on('project_role_updated', (data) => {
      if (!data?.roleId) return;
      dispatch(socketRoleUpdated(data));
      dispatch(socketWorkspaceRoleUpdated(data));
    });

    // Workspace member's role/customRole was changed — patch their entry so
    // canWorkspace() (e.g. report.viewTeam) reflects the new role immediately.
    socket.on('workspace_member_role_changed', (data) => {
      if (data?.member) dispatch(socketWorkspaceMemberRoleChanged({ ...data, currentUserId: currentUserRef.current?.id }));
    });

    // Role deleted — affected members reassigned to Viewer.
    socket.on('project_role_deleted', (data) => {
      if (data?.roleId) dispatch(socketRoleDeleted(data));
    });

    // Inbox notifications — task assigned/reassigned to current user
    socket.on('my_tasks_changed', (data) => {
      onMyTasksChangedRef.current?.(data);
    });

    return () => {
      socket.emit('leave_workspace', workspaceId);
      socket.off('connect');
      socket.off('connect_error');
      socket.off('project_created');
      socket.off('project_updated');
      socket.off('project_deleted');
      socket.off('project_member_added');
      socket.off('project_member_removed');
      socket.off('project_role_updated');
      socket.off('project_role_deleted');
      socket.off('workspace_member_role_changed');
      socket.off('my_tasks_changed');
      socket.disconnect();
    };
  }, [workspaceId, currentUser?.id, dispatch]);

  return socketRef.current;
};
