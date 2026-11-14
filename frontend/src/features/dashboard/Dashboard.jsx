import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createWorkspace, setCurrentWorkspace } from '../../store/slices/workspaceSlice';
import { fetchMyTasks } from '../../store/slices/taskSlice';
import CreateProjectWizard from '../projects/CreateProjectWizard';
import TaskDetail from '../tasks/TaskDetail';
import StatTile, { CARD_CLASS, STAT_ICONS } from '../../components/StatTile';
import DueChip from '../../components/DueChip';
import EmptyState from '../../components/EmptyState';
import { dueState, isDoneStatus } from '../../utils/dueDate';

const PRIORITY_DOT = {
  HIGH: 'bg-red-500',
  MEDIUM: 'bg-yellow-400',
  LOW: 'bg-gray-300 dark:bg-gray-600',
};

const HERO_GRADIENT = 'linear-gradient(120deg, #4F46E5 0%, #6D28D9 60%, #7C3AED 100%)';

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// Uses the shared day-based due rules so Home, My Tasks and the List view agree.
function summarizeMyTasks(tasks, now) {
  const STATE_ORDER = { overdue: 0, today: 1, upcoming: 2, none: 3 };
  const open = tasks.filter((t) => !isDoneStatus(t.status));

  return {
    overdue: open.filter((t) => dueState(t, now) === 'overdue').length,
    dueToday: open.filter((t) => dueState(t, now) === 'today').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => isDoneStatus(t.status)).length,
    // Overdue → due today → upcoming → no date; earliest first inside each group.
    upNext: [...open]
      .sort((a, b) =>
        STATE_ORDER[dueState(a, now)] - STATE_ORDER[dueState(b, now)] ||
        new Date(a.dueDate || 0) - new Date(b.dueDate || 0))
      .slice(0, 6),
  };
}

function ProjectCard({ project }) {
  const color = project.color || '#4F46E5';

  // Use pre-computed stats from backend (or fallback to legacy board.lists.tasks)
  const stats = project.stats;
  const sections = stats?.sections ?? project.board?.lists?.length ?? 0;
  const tasks = stats?.tasks ?? (project.board?.lists?.flatMap(l => l.tasks || []).filter(t => !t.parentId && t.taskType !== 'MILESTONE').length ?? 0);
  const milestones = stats?.milestones ?? 0;
  const subtasks = stats?.subtasks ?? 0;
  const total = stats?.total ?? 0;

  return (
    <Link
      to={`/project/${project.id}`}
      className="group block bg-[var(--karya-surface)] border border-[var(--karya-border)] rounded-karya-lg overflow-hidden shadow-karya-card hover:shadow-karya-hover hover:-translate-y-0.5 transition-all duration-200"
    >
      {/* Color strip */}
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-base shadow-sm"
            style={{
              backgroundColor: color,
              // Soft highlight so the tile reads like an app icon
              backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 60%)',
            }}
          >
            {project.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-[var(--karya-text-secondary)] uppercase tracking-wider">
            {project.visibility?.toLowerCase() || 'private'}
          </span>
        </div>

        <h3 className="font-semibold text-[var(--karya-text-primary)] text-sm leading-snug group-hover:text-karya-blue transition-colors mb-1">
          {project.name}
        </h3>
        {project.description && (
          <p className="text-xs text-[var(--karya-text-secondary)] line-clamp-2 mb-3">{project.description}</p>
        )}

        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-3 border-t border-[var(--karya-border)]">
          <span className="text-[11px] text-[var(--karya-text-secondary)] flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            {tasks} task{tasks !== 1 ? 's' : ''}
          </span>
          {sections > 0 && (
            <span className="text-[11px] text-[var(--karya-text-secondary)] flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              {sections} section{sections !== 1 ? 's' : ''}
            </span>
          )}
          {milestones > 0 && (
            <span className="text-[11px] text-[var(--karya-text-secondary)] flex items-center">
              <svg className="w-3 h-3 mr-1" viewBox="0 0 12 12"><rect x="6" y="0" width="7" height="7" rx="1" transform="rotate(45 6 0)" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
              {milestones} milestone{milestones !== 1 ? 's' : ''}
            </span>
          )}
          {subtasks > 0 && (
            <span className="text-[11px] text-[var(--karya-text-secondary)] flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
              {subtasks} subtask{subtasks !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, loading } = useAppSelector((state) => state.workspace);
  const { projects, projectsLoading, projectsLoaded } = useAppSelector((state) => state.project);

  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [wsCreating, setWsCreating] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const { user } = useAppSelector((state) => state.auth);
  const { myTasks, myTasksLoading } = useAppSelector((state) => state.task);

  useEffect(() => {
    if (currentWorkspace?.id) {
      dispatch(fetchMyTasks({ workspaceId: currentWorkspace.id }));
    }
  }, [currentWorkspace?.id, dispatch]);

  const now = new Date();
  const summary = useMemo(() => summarizeMyTasks(myTasks || [], new Date()), [myTasks]);

  const closeTask = () => {
    setSelectedTaskId(null);
    // The panel can change status/due dates — refresh so Home's numbers stay right.
    if (currentWorkspace?.id) dispatch(fetchMyTasks({ workspaceId: currentWorkspace.id }));
  };

  // Workspaces and projects are fetched centrally by Layout.jsx — no duplicate fetch here

  const handleCreateWorkspace = (e) => {
    e.preventDefault();
    setWsCreating(true);
    dispatch(createWorkspace(newWorkspace)).then((result) => {
      setWsCreating(false);
      if (result.payload) {
        dispatch(setCurrentWorkspace(result.payload));
        setShowCreateWorkspace(false);
        setNewWorkspace({ name: '', description: '' });
      }
    });
  };

  if (loading && !currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-karya-blue" />
        <p className="text-[var(--karya-text-secondary)] text-sm">Loading workspace...</p>
      </div>
    );
  }

  /* ── No workspace state ── */
  if (!currentWorkspace && workspaces.length === 0) {
    return (
      <>
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="w-20 h-20 rounded-2xl bg-karya-blue/10 dark:bg-karya-blue/20 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-karya-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-[var(--karya-text-primary)] mb-3">Welcome to Keystone</h1>
          <p className="text-[var(--karya-text-secondary)] mb-8 max-w-md mx-auto">
            Create a workspace to start managing your projects and collaborating with your team.
          </p>
          <button
            onClick={() => setShowCreateWorkspace(true)}
            className="karya-button-primary px-8 py-3 text-sm font-semibold shadow-lg shadow-karya-blue/20"
          >
            Create your first workspace
          </button>
        </div>

        {showCreateWorkspace && (
          <div className="karya-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreateWorkspace(false)}>
            <div className="karya-modal p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-[var(--karya-text-primary)]">Create Workspace</h2>
                <button onClick={() => setShowCreateWorkspace(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-[var(--karya-text-secondary)] transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <form onSubmit={handleCreateWorkspace} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5">Workspace name <span className="text-karya-red">*</span></label>
                  <input type="text" value={newWorkspace.name} onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })} placeholder="e.g. Acme Inc." className="karya-input w-full" required autoFocus />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--karya-text-primary)] mb-1.5">Description</label>
                  <textarea value={newWorkspace.description} onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })} placeholder="What does your team work on?" rows={2} className="karya-input w-full resize-none" />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button type="button" onClick={() => setShowCreateWorkspace(false)} className="flex-1 py-2 text-sm font-medium border border-[var(--karya-border)] rounded-karya text-[var(--karya-text-primary)] hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancel</button>
                  <button type="submit" disabled={wsCreating} className="flex-1 py-2 text-sm font-medium karya-button-primary disabled:opacity-50">{wsCreating ? 'Creating...' : 'Create Workspace'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </>
    );
  }

  if (!currentWorkspace) return null;

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
      {/* ── Greeting hero ── */}
      <div
        className="relative overflow-hidden rounded-karya-lg p-6 sm:p-8 mb-6 text-white shadow-karya-pop"
        style={{ background: HERO_GRADIENT }}
      >
        {/* Brand watermark: the Keystone arch */}
        <svg className="absolute -right-8 -bottom-12 w-64 h-64 pointer-events-none" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M16 56V36a16 16 0 0 1 32 0v20" fill="none" stroke="#FFFFFF" strokeOpacity="0.12" strokeWidth="10" />
          <path d="M25.05 14.6A22.5 22.5 0 0 1 38.95 14.6L35.24 26.01A10.5 10.5 0 0 0 28.76 26.01Z" fill="#F59E0B" fillOpacity="0.55" />
        </svg>

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 truncate">
              {currentWorkspace.name}
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              {greetingFor(now.getHours())}, {user?.name?.split(' ')[0] || 'there'}
            </h1>
            <p className="text-sm text-white/80 mt-1.5">
              {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {!(myTasksLoading && myTasks.length === 0) && (
                <>
                  {' · '}
                  {summary.dueToday || summary.overdue
                    ? [
                        summary.dueToday && `${summary.dueToday} due today`,
                        summary.overdue && `${summary.overdue} overdue`,
                      ].filter(Boolean).join(' · ')
                    : 'Nothing due today'}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Link
              to={`/workspace/${currentWorkspace.id}`}
              className="px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-karya transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Members</span>
            </Link>
            <button
              onClick={() => setShowCreateWizard(true)}
              className="px-4 py-1.5 text-sm font-semibold text-karya-blue bg-white hover:bg-white/90 rounded-karya shadow-sm transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── My task stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {myTasksLoading && myTasks.length === 0
          ? [0, 1, 2, 3].map((i) => (
              <div key={i} className={`${CARD_CLASS} h-[118px] animate-pulse`} />
            ))
          : [
              { label: 'Due today', value: summary.dueToday, color: '#4F46E5', icon: STAT_ICONS.today },
              { label: 'Overdue', value: summary.overdue, color: '#EF4444', icon: STAT_ICONS.overdue },
              { label: 'In progress', value: summary.inProgress, color: '#3B82F6', icon: STAT_ICONS.progress },
              { label: 'Completed', value: summary.completed, color: '#22C55E', icon: STAT_ICONS.done },
            ].map((stat) => <StatTile key={stat.label} {...stat} />)}
      </div>

      {/* ── Up next ── */}
      <div className={`${CARD_CLASS} mb-8 overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--karya-border)]">
          <h2 className="text-sm font-bold text-[var(--karya-text-primary)]">Up next</h2>
          <Link to="/my-tasks" className="text-xs font-semibold text-karya-blue hover:underline">
            View all →
          </Link>
        </div>
        {myTasksLoading && myTasks.length === 0 ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-karya bg-gray-100 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : summary.upNext.length === 0 ? (
          <EmptyState title="You're all caught up" message="No open tasks assigned to you." className="py-10" />
        ) : (
          <ul className="divide-y divide-[var(--karya-border)]">
            {summary.upNext.map((task) => {
              const project = task.list?.board?.project;
              return (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-primary-50/60 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || PRIORITY_DOT.LOW}`} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[var(--karya-text-primary)] truncate">{task.title}</span>
                      {project && (
                        <span className="flex items-center gap-1.5 text-[11px] text-[var(--karya-text-secondary)] mt-0.5 min-w-0">
                          <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: project.color || '#4F46E5' }} />
                          <span className="truncate">{project.name}</span>
                        </span>
                      )}
                    </span>
                    <DueChip task={task} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>


      {/* ── Workspace switcher if multiple ── */}
      {workspaces.length > 1 && (
        <div className="flex items-center space-x-2 mb-6 overflow-x-auto pb-1">
          {workspaces.map((ws) => {
            const isActive = ws.id === currentWorkspace?.id;
            // Use an anchor with target="_blank" so:
            //  • clicking opens the workspace in a new tab (Layout's URL bootstrap reads ?workspace=)
            //  • middle-click and Cmd/Ctrl+click work natively
            //  • the active workspace stays put in this tab
            // The active workspace is rendered as a non-link button so it doesn't open a duplicate tab.
            if (isActive) {
              return (
                <button
                  key={ws.id}
                  className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-karya-blue text-white cursor-default"
                >
                  {ws.name}
                </button>
              );
            }
            return (
              <a
                key={ws.id}
                href={`/dashboard?workspace=${ws.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors bg-gray-100 dark:bg-gray-700 text-[var(--karya-text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {ws.name}
              </a>
            );
          })}
        </div>
      )}

      {/* ── Projects ── */}
      <h2 className="text-sm font-bold text-[var(--karya-text-primary)] mb-3">
        Projects
        {projectsLoaded && (
          <span className="ml-2 text-xs font-medium text-[var(--karya-text-secondary)]">{projects.length}</span>
        )}
      </h2>
      {projectsLoading || !projectsLoaded ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-karya-blue" />
          <p className="text-[var(--karya-text-secondary)] text-sm mt-3">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[var(--karya-border)] rounded-karya-lg">
          <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-[var(--karya-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-[var(--karya-text-primary)] font-medium mb-1">No projects yet</p>
          <p className="text-sm text-[var(--karya-text-secondary)] mb-5">Create your first project to get started</p>
          <button onClick={() => setShowCreateWizard(true)} className="karya-button-primary text-sm px-5 py-2">
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
          {/* Add project tile */}
          <button
            onClick={() => setShowCreateWizard(true)}
            className="border-2 border-dashed border-[var(--karya-border)] rounded-karya-lg p-5 flex flex-col items-center justify-center text-[var(--karya-text-secondary)] hover:border-karya-blue/40 hover:text-karya-blue hover:bg-karya-blue/5 transition-all group min-h-[140px]"
          >
            <div className="w-10 h-10 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span className="text-sm font-medium">New Project</span>
          </button>
        </div>
      )}

      {/* ── Create Project Wizard ── */}
      <CreateProjectWizard
        isOpen={showCreateWizard}
        onClose={() => setShowCreateWizard(false)}
      />

      {/* ── Task detail panel (same pattern as My Tasks) ── */}
      {selectedTaskId && createPortal(
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in" onClick={closeTask} />
          <div className="w-full max-w-2xl bg-[var(--karya-surface)] shadow-2xl relative animate-slide-in-right h-full overflow-y-auto border-l border-[var(--karya-border)]">
            <TaskDetail taskId={selectedTaskId} isEmbedded onClose={closeTask} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default Dashboard;
