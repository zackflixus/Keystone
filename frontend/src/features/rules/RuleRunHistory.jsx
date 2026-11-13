import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchRuleRuns, clearRuns } from '../../store/slices/ruleSlice';

const STATUS_META = {
  SUCCESS: { label: 'Success', cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  FAILED: { label: 'Failed', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
  SKIPPED_CONDITION: { label: 'Skipped — conditions not met', cls: 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300' },
  SKIPPED_DEPTH: { label: 'Skipped — cascade limit reached', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  SKIPPED_CHAIN: { label: 'Skipped — already ran for this change', cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
};

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function RuleRunHistory({ isOpen, onClose, rule }) {
  const dispatch = useAppDispatch();
  const { runs, runsLoading } = useAppSelector((s) => s.rule);

  useEffect(() => {
    if (!isOpen || !rule?.id) return;
    dispatch(clearRuns());
    dispatch(fetchRuleRuns({ id: rule.id }));
  }, [isOpen, rule?.id, dispatch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-start justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-gray-800 rounded-karya-lg shadow-2xl border border-karya-border dark:border-gray-700 w-full max-w-xl my-6 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--karya-border)]">
          <div>
            <h2 className="text-base font-bold text-[var(--karya-text-primary)]">Run history</h2>
            <p className="text-xs text-[var(--karya-text-secondary)] mt-0.5 truncate max-w-md">{rule?.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-[var(--karya-text-secondary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-4 max-h-[65vh] overflow-y-auto">
          {runsLoading && runs.items.length === 0 ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-karya" />)}
            </div>
          ) : runs.items.length === 0 ? (
            <div className="text-center py-10">
              <svg className="w-8 h-8 mx-auto text-[var(--karya-text-secondary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-[var(--karya-text-secondary)]">This rule hasn't run yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {runs.items.map((run) => {
                const meta = STATUS_META[run.status] || { label: run.status, cls: 'bg-gray-100 text-gray-600' };
                return (
                  <div key={run.id} className="rounded-karya border border-[var(--karya-border)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>
                      <span className="text-[11px] text-[var(--karya-text-secondary)]">{formatWhen(run.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      {run.taskId ? (
                        <Link to={`/task/${run.taskId}`} onClick={onClose} className="text-xs text-karya-blue hover:underline">
                          View task
                        </Link>
                      ) : <span />}
                      {run.durationMs != null && (
                        <span className="text-[11px] text-[var(--karya-text-secondary)]">{run.durationMs}ms</span>
                      )}
                    </div>
                    {run.error && (
                      <p className="text-xs text-red-500 mt-1.5 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">{run.error}</p>
                    )}
                  </div>
                );
              })}

              {runs.hasMore && (
                <button
                  onClick={() => dispatch(fetchRuleRuns({ id: rule.id, cursor: runs.nextCursor }))}
                  disabled={runsLoading}
                  className="w-full text-xs font-medium text-karya-blue hover:underline py-2 disabled:opacity-50"
                >
                  {runsLoading ? 'Loading…' : 'Load more'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RuleRunHistory;
