import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applyRuleTemplate } from '../../store/slices/ruleSlice';

const TEMPLATE_ICONS = {
  'claim-new-tasks': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  ),
  'flag-blocked-work': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2z" />
  ),
  'file-completed-work': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  ),
  'start-on-assignment': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  ),
  'triage-new-in-section': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2M5 21h2m5-5v.01M9 17h6" />
  ),
  'unassign-on-hold': (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  ),
};

function RuleTemplateGallery({ isOpen, onClose, templates, schema, workspaceId, projectId, onCreateCustom }) {
  const dispatch = useAppDispatch();
  const { saving } = useAppSelector((s) => s.rule);
  const [selected, setSelected] = useState(null); // template needing params
  const [paramValues, setParamValues] = useState({});
  const [applyError, setApplyError] = useState(null);

  if (!isOpen) return null;

  const apply = async (template, params) => {
    setApplyError(null);
    const result = await dispatch(applyRuleTemplate({ key: template.key, workspaceId, projectId, params }));
    if (!result.error) {
      onClose();
    } else {
      setApplyError(typeof result.payload === 'string' ? result.payload : 'Failed to apply template');
    }
  };

  const handlePick = (template) => {
    if (!template.params?.length) {
      apply(template, {});
    } else {
      setSelected(template);
      setParamValues({});
      setApplyError(null);
    }
  };

  const sections = schema?.sources?.section || [];

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-karya-lg shadow-2xl border border-karya-border dark:border-gray-700 w-full max-w-2xl my-6 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--karya-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--karya-text-primary)]">
              {selected ? selected.name : 'Start from a template'}
            </h2>
            <p className="text-xs text-[var(--karya-text-secondary)] mt-0.5">
              {selected ? selected.description : 'Ready-made rules for common workflows — customize afterward if you need to.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-[var(--karya-text-secondary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {!selected ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => handlePick(t)}
                    disabled={saving}
                    className="text-left p-4 rounded-karya border border-[var(--karya-border)] hover:border-karya-blue hover:shadow-karya-hover transition-all disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-karya-blue/10 text-karya-blue flex items-center justify-center mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {TEMPLATE_ICONS[t.key] || <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />}
                      </svg>
                    </div>
                    <h3 className="text-sm font-bold text-[var(--karya-text-primary)] mb-1">{t.name}</h3>
                    <p className="text-xs text-[var(--karya-text-secondary)] leading-relaxed">{t.description}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={onCreateCustom}
                className="w-full mt-4 flex items-center justify-center gap-2 p-3 text-sm font-medium text-karya-blue border-2 border-dashed border-karya-blue/30 hover:border-karya-blue rounded-karya transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Build a custom rule instead
              </button>
            </>
          ) : (
            <div className="space-y-4">
              {selected.params.map((p) => (
                <div key={p.key}>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-[var(--karya-text-secondary)] mb-1">{p.label}</label>
                  {p.type === 'section' ? (
                    <select
                      value={paramValues[p.key] || ''}
                      onChange={(e) => setParamValues((v) => ({ ...v, [p.key]: e.target.value }))}
                      className="karya-input w-full text-sm"
                    >
                      <option value="">Choose a section…</option>
                      {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={paramValues[p.key] || ''}
                      onChange={(e) => setParamValues((v) => ({ ...v, [p.key]: e.target.value }))}
                      className="karya-input w-full text-sm"
                    />
                  )}
                </div>
              ))}

              {applyError && <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-karya px-3 py-2">{applyError}</p>}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setSelected(null)}
                  className="text-xs font-medium text-[var(--karya-text-secondary)] px-3 py-2 hover:text-[var(--karya-text-primary)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => apply(selected, paramValues)}
                  disabled={saving || selected.params.some((p) => !paramValues[p.key])}
                  className="karya-button-primary text-xs py-2 px-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Creating…' : 'Create rule'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RuleTemplateGallery;
