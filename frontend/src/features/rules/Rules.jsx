import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { useRole } from '../../hooks/useRole';
import { useConfirm } from '../../hooks/useConfirm';
import api from '../../services/api';
import {
  fetchRuleSchema, fetchRuleTemplates, fetchRules,
  toggleRuleEnabled, deleteRule, clearError,
} from '../../store/slices/ruleSlice';
import { describeTrigger, describeCondition, describeAction } from './ruleConstants';
import RuleBuilder from './RuleBuilder';
import RuleTemplateGallery from './RuleTemplateGallery';
import RuleRunHistory from './RuleRunHistory';

function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-slide-in-right">
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium ${
        toast.type === 'error'
          ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          : 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
      }`}>
        <span>{toast.message}</span>
        <button onClick={onDismiss} className="opacity-60 hover:opacity-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
  );
}

function RuleCard({ rule, schema, canManage, groupLabel, editLoading, onEdit, onHistory, onToggle, onDelete }) {
  const actionSummaries = (rule.actions || []).map((a) => describeAction(a, schema));
  const conditionItems = rule.conditions?.items || [];

  return (
    <div className="karya-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">{rule.name}</h3>
            {groupLabel && (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[var(--karya-text-secondary)]">
                {groupLabel}
              </span>
            )}
            {!rule.enabled && rule.autoDisabledAt ? (
              <span
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                title={`Automatically turned off after ${rule.consecutiveFailCount || 'repeated'} failures in a row`}
              >
                Auto-disabled
              </span>
            ) : !rule.enabled ? (
              <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[var(--karya-text-secondary)]">Off</span>
            ) : null}
          </div>
          {rule.description && <p className="text-xs text-[var(--karya-text-secondary)] mt-0.5">{rule.description}</p>}
          {!rule.enabled && rule.autoDisabledAt && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Turned off after repeated failures — check run history, then re-enable once fixed.
            </p>
          )}
        </div>

        {/* Enabled toggle */}
        <label className="relative flex items-center cursor-pointer flex-shrink-0" title={canManage ? 'Turn rule on/off' : 'No permission'}>
          <input
            type="checkbox"
            checked={rule.enabled}
            disabled={!canManage}
            onChange={(e) => onToggle(rule, e.target.checked)}
            className="sr-only peer"
          />
          <span className="w-9 h-5 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-karya-blue transition-colors peer-disabled:opacity-50" />
          <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
        </label>
      </div>

      {/* When / If / Then summary */}
      <div className="mt-3 space-y-1.5 text-xs">
        <p className="text-[var(--karya-text-secondary)]"><span className="font-semibold text-[var(--karya-text-primary)]">When</span> {describeTrigger(rule.trigger, schema)}</p>
        {conditionItems.length > 0 && (
          <p className="text-[var(--karya-text-secondary)]">
            <span className="font-semibold text-[var(--karya-text-primary)]">If</span> {conditionItems.map((c) => describeCondition(c, schema)).join(rule.conditions?.match === 'ANY' ? ' OR ' : ' AND ')}
          </p>
        )}
        <p className="text-[var(--karya-text-secondary)]"><span className="font-semibold text-[var(--karya-text-primary)]">Then</span> {actionSummaries.join('; ')}</p>
      </div>

      {/* Footer: stats + actions */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--karya-border)]">
        <button onClick={() => onHistory(rule)} className="text-[11px] text-[var(--karya-text-secondary)] hover:text-karya-blue transition-colors">
          {rule.runCount || 0} run{rule.runCount === 1 ? '' : 's'}{rule.failCount ? ` · ${rule.failCount} failed` : ''}
        </button>
        {canManage && (
          <div className="flex items-center gap-1">
            <button onClick={() => onEdit(rule)} disabled={editLoading} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-[var(--karya-text-secondary)] hover:text-karya-blue transition-colors disabled:opacity-50" title="Edit">
              {editLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              )}
            </button>
            <button onClick={() => onDelete(rule)} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-[var(--karya-text-secondary)] hover:text-red-500 transition-colors" title="Delete">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Rules() {
  const dispatch = useAppDispatch();
  const { currentWorkspace } = useAppSelector((s) => s.workspace);
  const { projects, projectsLoaded, projectsForWorkspaceId } = useAppSelector((s) => s.project);
  const { user } = useAppSelector((s) => s.auth);
  const { rules, rulesLoading, schema, templates, error } = useAppSelector((s) => s.rule);
  const { isWorkspaceAdmin } = useRole();
  const { confirm, ConfirmDialog } = useConfirm();

  const workspaceId = currentWorkspace?.id;
  const [searchParams] = useSearchParams();
  const requestedProjectId = searchParams.get('projectId');
  const navigate = useNavigate();

  const [selectedScope, setSelectedScope] = useState(null); // projectId, or '__workspace__'
  const [toast, setToast] = useState(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [builderProjectId, setBuilderProjectId] = useState(null);
  const [overrideSchema, setOverrideSchema] = useState(null);
  const [schemaLoadingFor, setSchemaLoadingFor] = useState(null); // ruleId being opened for edit
  const [historyRule, setHistoryRule] = useState(null);

  // Default scope: the project we were opened from (?projectId=...) if it's one
  // we can see, else the first accessible project, else workspace-wide for admins.
  // Must wait for the real project list before deciding — right after a page
  // refresh `projects` is still [] for one render (the fetch hasn't resolved
  // yet), and without this guard that empty list gets mistaken for "no
  // projects", permanently locking the scope to workspace-wide.
  const projectsReady = projectsLoaded && projectsForWorkspaceId === workspaceId;
  useEffect(() => {
    if (selectedScope !== null || !projectsReady) return;
    if (requestedProjectId && projects.some((p) => p.id === requestedProjectId)) {
      setSelectedScope(requestedProjectId);
    } else if (projects.length > 0) {
      setSelectedScope(projects[0].id);
    } else if (isWorkspaceAdmin) {
      setSelectedScope('__workspace__');
    }
  }, [projects, projectsReady, isWorkspaceAdmin, selectedScope, requestedProjectId]);

  const effectiveScopeProjectId = selectedScope === '__workspace__' ? null : selectedScope;

  useEffect(() => {
    if (!workspaceId || selectedScope === null) return;
    dispatch(fetchRuleSchema({ workspaceId, projectId: effectiveScopeProjectId }));
    dispatch(fetchRules({ workspaceId, projectId: effectiveScopeProjectId }));
  }, [workspaceId, selectedScope, effectiveScopeProjectId, dispatch]);

  useEffect(() => {
    if (templates.length === 0) dispatch(fetchRuleTemplates());
  }, [templates.length, dispatch]);

  useEffect(() => {
    if (error) {
      setToast({ type: 'error', message: error });
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const canManageRule = (rule) => {
    if (isWorkspaceAdmin) return true;
    if (rule.projectId === null) return false;
    const proj = projects.find((p) => p.id === rule.projectId);
    const membership = proj?.members?.find((m) => m.userId === user?.id);
    const legacyRole = membership?.projectRole ?? null;
    return legacyRole === 'EDITOR' || legacyRole === 'CUSTOM';
  };

  const canManageScope = isWorkspaceAdmin || (
    effectiveScopeProjectId
      ? (() => {
          const proj = projects.find((p) => p.id === effectiveScopeProjectId);
          const membership = proj?.members?.find((m) => m.userId === user?.id);
          return membership?.projectRole === 'EDITOR' || membership?.projectRole === 'CUSTOM';
        })()
      : false
  );

  const groupLabel = (rule) => {
    if (selectedScope === '__workspace__') {
      if (rule.projectId === null) return 'Workspace-wide';
      return projects.find((p) => p.id === rule.projectId)?.name || null;
    }
    return rule.projectId === null ? 'Workspace-wide' : null;
  };

  const openCreate = () => {
    setEditingRule(null);
    setBuilderProjectId(effectiveScopeProjectId);
    setOverrideSchema(null);
    setGalleryOpen(true);
  };

  const openEdit = async (rule) => {
    setEditingRule(rule);
    setBuilderProjectId(rule.projectId);
    if (rule.projectId === effectiveScopeProjectId) {
      setOverrideSchema(null);
      setBuilderOpen(true);
      return;
    }
    setSchemaLoadingFor(rule.id);
    try {
      const res = await api.get('/api/v1/rules/schema', { params: { workspaceId, projectId: rule.projectId || undefined } });
      setOverrideSchema(res.data.data);
      setBuilderOpen(true);
    } catch {
      setToast({ type: 'error', message: 'Failed to load rule for editing' });
    } finally {
      setSchemaLoadingFor(null);
    }
  };

  const handleToggle = (rule, enabled) => {
    dispatch(toggleRuleEnabled({ id: rule.id, enabled }));
  };

  const handleDelete = async (rule) => {
    const ok = await confirm({
      title: 'Delete rule?',
      message: `"${rule.name}" will stop running immediately. This cannot be undone.`,
      confirmText: 'Delete Rule',
      variant: 'danger',
    });
    if (!ok) return;
    const result = await dispatch(deleteRule(rule.id));
    if (!result.error) setToast({ type: 'success', message: 'Rule deleted' });
  };

  const activeSchema = builderOpen && overrideSchema ? overrideSchema : schema;

  const groupedRules = useMemo(() => {
    if (selectedScope !== '__workspace__') {
      const own = rules.filter((r) => r.projectId === effectiveScopeProjectId);
      const wide = rules.filter((r) => r.projectId === null);
      return [
        ...(own.length ? [{ label: 'This project', items: own }] : []),
        ...(wide.length ? [{ label: 'Workspace-wide', items: wide }] : []),
      ];
    }
    return [{ label: null, items: rules }];
  }, [rules, selectedScope, effectiveScopeProjectId]);

  if (!workspaceId) return null;

  return (
    <div className="flex flex-col h-full bg-[var(--karya-bg)]">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-[var(--karya-border)] bg-[var(--karya-surface)]">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <button
              onClick={() => (requestedProjectId ? navigate(`/project/${requestedProjectId}`) : navigate(-1))}
              className="flex items-center gap-1 text-xs text-[var(--karya-text-secondary)] hover:text-[var(--karya-text-primary)] transition-colors mb-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to project
            </button>
            <h1 className="text-xl font-bold text-[var(--karya-text-primary)]">Rules</h1>
            <p className="text-xs text-[var(--karya-text-secondary)] mt-0.5">
              Automate your workflow: when something happens, do something automatically.
            </p>
          </div>
          {canManageScope && selectedScope !== null && (
            <button onClick={openCreate} className="karya-button-primary flex items-center text-xs px-3 py-2">
              <svg className="w-3.5 h-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Rule
            </button>
          )}
        </div>

        {/* Scope label — read-only. Rules is always opened from a specific
            project's toolbar now, so there's nothing to switch here; this just
            shows which project's rules you're looking at. */}
        {selectedScope !== null && (
          <div className="inline-flex items-center gap-2 text-sm text-[var(--karya-text-primary)] bg-gray-100 dark:bg-gray-800 rounded-md px-3 py-2 max-w-xs">
            <svg className="w-4 h-4 text-[var(--karya-text-secondary)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
            <span className="truncate">
              {selectedScope === '__workspace__'
                ? 'All rules (workspace admin view)'
                : projects.find((p) => p.id === selectedScope)?.name || 'Project'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {selectedScope === null && !projectsReady ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-karya" />)}
          </div>
        ) : selectedScope === null ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--karya-text-secondary)]">Ask a workspace admin to add you to a project to see its rules.</p>
          </div>
        ) : rulesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-karya" />)}
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-full bg-karya-blue/10 text-karya-blue flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-sm font-bold text-[var(--karya-text-primary)] mb-1">No rules yet</h2>
            <p className="text-xs text-[var(--karya-text-secondary)] mb-5 max-w-sm mx-auto">
              Automate the busywork — auto-assign new tasks, flag blocked work, move completed tasks into Done, and more.
            </p>
            {canManageScope && (
              <button onClick={openCreate} className="karya-button-primary text-xs px-4 py-2">Create your first rule</button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {groupedRules.map((group, gi) => (
              <div key={gi}>
                {group.label && (
                  <h2 className="text-[11px] font-bold uppercase tracking-wide text-[var(--karya-text-secondary)] mb-2">{group.label}</h2>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      schema={schema}
                      canManage={canManageRule(rule)}
                      groupLabel={selectedScope === '__workspace__' ? groupLabel(rule) : null}
                      editLoading={schemaLoadingFor === rule.id}
                      onEdit={openEdit}
                      onHistory={setHistoryRule}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Template gallery */}
      <RuleTemplateGallery
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        templates={templates}
        schema={schema}
        workspaceId={workspaceId}
        projectId={builderProjectId}
        onCreateCustom={() => { setGalleryOpen(false); setBuilderOpen(true); }}
      />

      {/* Rule builder (create / edit) */}
      <RuleBuilder
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
        schema={activeSchema}
        workspaceId={workspaceId}
        projectId={builderProjectId}
        rule={editingRule}
      />

      {/* Run history */}
      <RuleRunHistory
        isOpen={!!historyRule}
        onClose={() => setHistoryRule(null)}
        rule={historyRule}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      {ConfirmDialog}
    </div>
  );
}

export default Rules;
