import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createRule, updateRule, dryRunRule, clearDryRunResult } from '../../store/slices/ruleSlice';
import api from '../../services/api';
import { STATUS_LABEL, PRIORITY_LABEL, TASK_TYPE_LABEL, DUE_DATE_PRESETS } from './ruleConstants';

const emptyCondition = (schema) => ({
  field: 'status',
  operator: 'is',
  value: schema?.sources?.taskStatus?.[0]?.value || '',
});

const defaultActionValue = (type, schema) => {
  switch (type) {
    case 'ASSIGN_TO': return 'ruleCreator';
    case 'SET_STATUS': return schema?.sources?.taskStatus?.[0]?.value || 'TODO';
    case 'SET_PRIORITY': return schema?.sources?.priority?.[0]?.value || 'MEDIUM';
    case 'SET_BILLABLE': return 'true';
    case 'SET_TASK_TYPE': return schema?.sources?.taskType?.[0]?.value || 'DEFAULT_TASK';
    case 'SET_DUE_DATE': return 'today';
    case 'MOVE_TO_SECTION': return schema?.sources?.section?.[0]?.id || '';
    case 'ADD_COMMENT': return '';
    default: return undefined;
  }
};

const newAction = (type, schema) => {
  const action = { type };
  const value = defaultActionValue(type, schema);
  if (value !== undefined) action.value = value;
  return action;
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--karya-text-secondary)] mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[var(--karya-text-secondary)] mt-1">{hint}</p>}
    </div>
  );
}

function RuleBuilder({ isOpen, onClose, schema, workspaceId, projectId, rule }) {
  const dispatch = useAppDispatch();
  const { saving, dryRunResult, dryRunLoading, error } = useAppSelector((s) => s.rule);
  const isEdit = !!rule?.id;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [trigger, setTrigger] = useState({ type: '' });
  const [matchMode, setMatchMode] = useState('ALL');
  const [conditions, setConditions] = useState([]);
  const [actions, setActions] = useState([]);
  const [formError, setFormError] = useState(null);

  const [taskQuery, setTaskQuery] = useState('');
  const [taskResults, setTaskResults] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (rule) {
      setName(rule.name || '');
      setDescription(rule.description || '');
      setEnabled(rule.enabled !== false);
      setTrigger(rule.trigger || { type: '' });
      setMatchMode(rule.conditions?.match || 'ALL');
      setConditions(rule.conditions?.items || []);
      setActions(rule.actions?.length ? rule.actions : [newAction('SET_STATUS', schema)]);
    } else {
      setName('');
      setDescription('');
      setEnabled(true);
      setTrigger({ type: '' });
      setMatchMode('ALL');
      setConditions([]);
      const firstType = Object.entries(schema?.actions || {}).find(([, def]) => def.implemented)?.[0] || 'SET_STATUS';
      setActions([newAction(firstType, schema)]);
    }
    setFormError(null);
    setSelectedTask(null);
    setTaskQuery('');
    setTaskResults([]);
    dispatch(clearDryRunResult());
  }, [isOpen, rule, schema, dispatch]);

  const triggerDef = schema?.triggers?.[trigger.type];
  const implementedActions = useMemo(
    () => Object.entries(schema?.actions || {}).filter(([, def]) => def.implemented),
    [schema]
  );

  if (!isOpen) return null;

  const updateTriggerParam = (key, value) => {
    setTrigger((t) => {
      const next = { ...t };
      if (value === '') delete next[key];
      else next[key] = value;
      return next;
    });
  };

  const updateCondition = (index, patch) => {
    setConditions((items) => items.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };
  const removeCondition = (index) => setConditions((items) => items.filter((_, i) => i !== index));
  const addCondition = () => setConditions((items) => [...items, emptyCondition(schema)]);

  const updateAction = (index, patch) => {
    setActions((items) => items.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  };
  const removeAction = (index) => setActions((items) => items.filter((_, i) => i !== index));
  const addAction = () => {
    const firstType = implementedActions[0]?.[0];
    if (firstType) setActions((items) => [...items, newAction(firstType, schema)]);
  };

  const handleTaskSearch = async (q) => {
    setTaskQuery(q);
    if (!q.trim() || !workspaceId) { setTaskResults([]); return; }
    try {
      const res = await api.get(`/api/v1/tasks/workspace/${workspaceId}/search?q=${encodeURIComponent(q)}`);
      setTaskResults((res.data.data || []).filter((t) => !projectId || t.list?.board?.project?.id === projectId).slice(0, 8));
    } catch {
      setTaskResults([]);
    }
  };

  const handleDryRun = () => {
    if (!selectedTask || !rule?.id) return;
    dispatch(dryRunRule({ id: rule.id, taskId: selectedTask.id }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) return setFormError('Give this rule a name.');
    if (!trigger.type) return setFormError('Choose a trigger — "When" can\'t be empty.');
    if (!actions.length) return setFormError('Add at least one action — "Then" can\'t be empty.');

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      enabled,
      trigger,
      conditions: { match: matchMode, items: conditions },
      actions,
    };

    let result;
    if (isEdit) {
      result = await dispatch(updateRule({ id: rule.id, data: payload }));
    } else {
      result = await dispatch(createRule({ ...payload, workspaceId, projectId }));
    }
    if (!result.error) onClose();
    else setFormError(typeof result.payload === 'string' ? result.payload : 'Failed to save rule');
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-karya-lg shadow-2xl border border-karya-border dark:border-gray-700 w-full max-w-2xl my-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--karya-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--karya-text-primary)]">
              {isEdit ? 'Edit rule' : 'Create custom rule'}
            </h2>
            <p className="text-xs text-[var(--karya-text-secondary)] mt-0.5">
              {projectId ? 'Applies to this project only' : 'Applies workspace-wide, across every project'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-[var(--karya-text-secondary)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Name / description */}
          <div className="space-y-3">
            <Field label="Rule name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Claim my new tasks"
                className="karya-input w-full text-sm"
                autoFocus
              />
            </Field>
            <Field label="Description (optional)">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this rule do?"
                className="karya-input w-full text-sm"
              />
            </Field>
          </div>

          {/* WHEN */}
          <div className="rounded-karya border border-[var(--karya-border)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-karya-blue/10 text-karya-blue text-[11px] font-bold flex items-center justify-center">1</span>
              <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">When</h3>
            </div>
            <select
              value={trigger.type}
              onChange={(e) => setTrigger({ type: e.target.value })}
              className="karya-input w-full text-sm"
            >
              <option value="">Choose a trigger…</option>
              {Object.entries(schema?.triggers || {}).map(([type, def]) => (
                <option key={type} value={type}>{def.label}</option>
              ))}
            </select>

            {triggerDef?.params?.length > 0 && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {triggerDef.params.map((p) => (
                  <Field key={p.key} label={p.label}>
                    <ParamSelect type={p.type} value={trigger[p.key] || ''} schema={schema} allowAny onChange={(v) => updateTriggerParam(p.key, v)} />
                  </Field>
                ))}
              </div>
            )}
          </div>

          {/* IF */}
          <div className="rounded-karya border border-[var(--karya-border)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-karya-blue/10 text-karya-blue text-[11px] font-bold flex items-center justify-center">2</span>
                <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">If <span className="font-normal text-[var(--karya-text-secondary)]">(optional)</span></h3>
              </div>
              {conditions.length > 1 && (
                <div className="flex items-center text-xs bg-gray-100 dark:bg-gray-700 rounded-full p-0.5">
                  {['ALL', 'ANY'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMatchMode(m)}
                      className={`px-2.5 py-1 rounded-full font-medium transition-colors ${matchMode === m ? 'bg-white dark:bg-gray-800 text-karya-blue shadow-sm' : 'text-[var(--karya-text-secondary)]'}`}
                    >
                      Match {m === 'ALL' ? 'all' : 'any'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {conditions.length === 0 && (
              <p className="text-xs text-[var(--karya-text-secondary)] italic">No conditions — this rule runs for every matching trigger.</p>
            )}

            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <ConditionRow
                  key={i}
                  condition={cond}
                  schema={schema}
                  onChange={(patch) => updateCondition(i, patch)}
                  onRemove={() => removeCondition(i)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addCondition}
              className="text-xs font-medium text-karya-blue hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add condition
            </button>
          </div>

          {/* THEN */}
          <div className="rounded-karya border border-[var(--karya-border)] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-karya-blue/10 text-karya-blue text-[11px] font-bold flex items-center justify-center">3</span>
              <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">Then</h3>
            </div>

            <div className="space-y-2">
              {actions.map((action, i) => (
                <ActionRow
                  key={i}
                  action={action}
                  schema={schema}
                  implementedActions={implementedActions}
                  onChange={(patch) => updateAction(i, patch)}
                  onRemove={() => actions.length > 1 && removeAction(i)}
                  canRemove={actions.length > 1}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addAction}
              className="text-xs font-medium text-karya-blue hover:underline flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add action
            </button>
          </div>

          {/* Enabled toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <span className="relative inline-flex items-center">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="sr-only peer" />
              <span className="w-9 h-5 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-karya-blue transition-colors" />
              <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="text-sm text-[var(--karya-text-primary)]">Turn this rule on immediately</span>
          </label>

          {/* Test this rule — only for an already-saved rule */}
          {isEdit && (
            <div className="rounded-karya border border-dashed border-[var(--karya-border)] p-4 space-y-3">
              <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">Test this rule</h3>
              <p className="text-xs text-[var(--karya-text-secondary)]">
                Preview what this rule would do to a real task, without actually running it.
              </p>
              <div className="relative">
                <input
                  type="text"
                  value={taskQuery}
                  onChange={(e) => handleTaskSearch(e.target.value)}
                  placeholder="Search a task by title…"
                  className="karya-input w-full text-sm"
                />
                {taskResults.length > 0 && !selectedTask && (
                  <div className="absolute top-full left-0 right-0 mt-1 karya-popover rounded-karya z-10 max-h-48 overflow-y-auto">
                    {taskResults.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setSelectedTask(t); setTaskQuery(t.title); setTaskResults([]); }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors truncate"
                      >
                        {t.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!selectedTask || dryRunLoading}
                onClick={handleDryRun}
                className="karya-button-primary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dryRunLoading ? 'Testing…' : 'Run test'}
              </button>

              {dryRunResult && (
                <div className="rounded-karya bg-gray-50 dark:bg-gray-900/40 p-3 text-xs space-y-1.5">
                  <p className="font-semibold text-[var(--karya-text-primary)]">
                    {dryRunResult.conditionsMet ? 'Conditions met — these actions would run:' : 'Conditions not met — this rule would not run.'}
                  </p>
                  {dryRunResult.conditionsMet && dryRunResult.actions.map((a, i) => (
                    <p key={i} className={a.noop ? 'text-[var(--karya-text-secondary)]' : 'text-[var(--karya-text-primary)]'}>
                      • {a.summary}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {(formError || error) && (
            <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-karya px-3 py-2">{formError || error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--karya-border)]">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-[var(--karya-text-secondary)] px-3 py-2 hover:text-[var(--karya-text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="karya-button-primary text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared source-typed <select> for trigger params & condition/action values ──
function ParamSelect({ type, value, schema, onChange, allowAny }) {
  const cls = 'karya-input w-full text-sm';
  if (type === 'taskStatus') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {allowAny && <option value="">Any</option>}
        {(schema?.sources?.taskStatus || []).map((s) => (
          <option key={s.value} value={s.value}>{STATUS_LABEL[s.value] || s.value}</option>
        ))}
      </select>
    );
  }
  if (type === 'priority') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {allowAny && <option value="">Any</option>}
        {(schema?.sources?.priority || []).map((p) => (
          <option key={p.value} value={p.value}>{PRIORITY_LABEL[p.value] || p.value}</option>
        ))}
      </select>
    );
  }
  if (type === 'taskType') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {allowAny && <option value="">Any</option>}
        {(schema?.sources?.taskType || []).map((t) => (
          <option key={t.value} value={t.value}>{t.value}</option>
        ))}
      </select>
    );
  }
  if (type === 'section') {
    const sections = schema?.sources?.section || [];
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls} disabled={!sections.length}>
        {allowAny && <option value="">Any</option>}
        {sections.length === 0 && <option value="">No sections available</option>}
        {sections.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
    );
  }
  if (type === 'member') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {allowAny && <option value="">Any</option>}
        {(schema?.sources?.member || []).map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    );
  }
  if (type === 'boolean') {
    return (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cls}>
        {allowAny && <option value="">Any</option>}
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
  );
}

function ConditionRow({ condition, schema, onChange, onRemove }) {
  const fieldDef = schema?.conditionFields?.[condition.field];
  const operators = Object.entries(schema?.operators || {}).filter(([, def]) => def.appliesTo.includes(fieldDef?.type));
  const needsNoValue = ['is_empty', 'is_not_empty'].includes(condition.operator);
  const isMulti = condition.operator === 'one_of';

  const handleFieldChange = (field) => {
    const newFieldDef = schema?.conditionFields?.[field];
    const firstOp = Object.entries(schema?.operators || {}).find(([, def]) => def.appliesTo.includes(newFieldDef?.type));
    onChange({ field, operator: firstOp?.[0] || 'is', value: '' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 bg-gray-50 dark:bg-gray-900/30 rounded-karya p-2">
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="karya-input text-xs py-1.5 px-2 flex-shrink-0"
      >
        {Object.entries(schema?.conditionFields || {}).map(([key, def]) => (
          <option key={key} value={key}>{def.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => onChange({ operator: e.target.value, value: e.target.value === 'one_of' ? [] : '' })}
        className="karya-input text-xs py-1.5 px-2 flex-shrink-0"
      >
        {operators.map(([key, def]) => (
          <option key={key} value={key}>{def.label}</option>
        ))}
      </select>

      {!needsNoValue && (
        fieldDef?.type === 'text' ? (
          <input
            type="text"
            value={condition.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="Value"
            className="karya-input text-xs py-1.5 px-2 flex-1 min-w-[100px]"
          />
        ) : fieldDef?.type === 'date' ? (
          <input
            type="date"
            value={condition.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            className="karya-input text-xs py-1.5 px-2 flex-shrink-0"
          />
        ) : isMulti ? (
          <MultiPicker type={fieldDef?.type} schema={schema} value={condition.value || []} onChange={(v) => onChange({ value: v })} />
        ) : (
          <div className="flex-shrink-0 min-w-[120px]">
            <ParamSelect type={fieldDef?.type} value={condition.value ?? ''} schema={schema} onChange={(v) => onChange({ value: v })} />
          </div>
        )
      )}

      <button type="button" onClick={onRemove} className="ml-auto p-1 text-[var(--karya-text-secondary)] hover:text-red-500 transition-colors flex-shrink-0">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  );
}

function MultiPicker({ type, schema, value, onChange }) {
  const options =
    type === 'taskStatus' ? (schema?.sources?.taskStatus || []).map((s) => ({ id: s.value, label: STATUS_LABEL[s.value] || s.value })) :
    type === 'priority' ? (schema?.sources?.priority || []).map((p) => ({ id: p.value, label: PRIORITY_LABEL[p.value] || p.value })) :
    type === 'section' ? (schema?.sources?.section || []).map((s) => ({ id: s.id, label: s.name })) :
    type === 'userList' ? (schema?.sources?.member || []).map((m) => ({ id: m.id, label: m.name })) : [];

  const toggle = (id) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="flex flex-wrap gap-1 flex-1 min-w-[140px]">
      {options.map((o) => (
        <button
          type="button"
          key={o.id}
          onClick={() => toggle(o.id)}
          className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${value.includes(o.id) ? 'bg-karya-blue text-white border-karya-blue' : 'border-[var(--karya-border)] text-[var(--karya-text-secondary)] hover:border-karya-blue'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ActionRow({ action, schema, implementedActions, onChange, onRemove, canRemove }) {
  const handleTypeChange = (type) => {
    onChange({ type, value: defaultActionValue(type, schema) });
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900/30 rounded-karya p-2 space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={action.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="karya-input text-xs py-1.5 px-2 flex-1"
        >
          {implementedActions.map(([type, def]) => (
            <option key={type} value={type}>{def.label}</option>
          ))}
        </select>
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-1 text-[var(--karya-text-secondary)] hover:text-red-500 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
      </div>

      <ActionValueEditor action={action} schema={schema} onChange={onChange} />
    </div>
  );
}

function ActionValueEditor({ action, schema, onChange }) {
  switch (action.type) {
    case 'ASSIGN_TO':
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2">
          <option value="ruleCreator">Rule creator (you)</option>
          <option value="taskCreator">Task creator (whoever made the task)</option>
          {(schema?.sources?.member || []).map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      );
    case 'SET_STATUS':
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2">
          {(schema?.sources?.taskStatus || []).map((s) => (
            <option key={s.value} value={s.value}>{STATUS_LABEL[s.value] || s.value}</option>
          ))}
        </select>
      );
    case 'SET_PRIORITY':
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2">
          {(schema?.sources?.priority || []).map((p) => (
            <option key={p.value} value={p.value}>{PRIORITY_LABEL[p.value] || p.value}</option>
          ))}
        </select>
      );
    case 'SET_BILLABLE':
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2">
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      );
    case 'SET_TASK_TYPE':
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2">
          {(schema?.sources?.taskType || []).map((t) => (
            <option key={t.value} value={t.value}>{TASK_TYPE_LABEL[t.value] || t.value}</option>
          ))}
        </select>
      );
    case 'SET_DUE_DATE': {
      const isCustom = !DUE_DATE_PRESETS.some((p) => p.value === action.value);
      return (
        <div className="flex items-center gap-2">
          <select
            value={isCustom ? 'custom' : action.value}
            onChange={(e) => onChange({ value: e.target.value === 'custom' ? new Date().toISOString().slice(0, 10) : e.target.value })}
            className="karya-input text-xs py-1.5 px-2 flex-1"
          >
            {DUE_DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            <option value="custom">Custom date…</option>
          </select>
          {isCustom && (
            <input
              type="date"
              value={action.value?.slice(0, 10) || ''}
              onChange={(e) => onChange({ value: e.target.value })}
              className="karya-input text-xs py-1.5 px-2"
            />
          )}
        </div>
      );
    }
    case 'MOVE_TO_SECTION': {
      const sections = schema?.sources?.section || [];
      return (
        <select value={action.value} onChange={(e) => onChange({ value: e.target.value })} className="karya-input w-full text-xs py-1.5 px-2" disabled={!sections.length}>
          {sections.length === 0 && <option value="">No sections available in this scope</option>}
          {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      );
    }
    case 'ADD_COMMENT':
      return (
        <div>
          <textarea
            value={action.value || ''}
            onChange={(e) => onChange({ value: e.target.value })}
            placeholder="e.g. This task is blocked — {{task.title}} needs attention."
            rows={2}
            className="karya-input w-full text-xs py-1.5 px-2 resize-none"
          />
          <p className="text-[10px] text-[var(--karya-text-secondary)] mt-1">Use <code>{'{{task.title}}'}</code> to insert the task's title.</p>
        </div>
      );
    case 'UNASSIGN_ALL':
      return <p className="text-[11px] text-[var(--karya-text-secondary)] italic">Removes every assignee from the task.</p>;
    default:
      return null;
  }
}

export default RuleBuilder;
