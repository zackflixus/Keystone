// Shared stat tile used by the project Overview and the Home page.

export const CARD_CLASS =
  'bg-[var(--karya-surface)] rounded-karya-lg border border-[var(--karya-border)] shadow-karya-card';

// Heroicons-style outline paths (24×24, stroke).
export const STAT_ICONS = {
  total: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
  today: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  done: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  progress: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  overdue: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

/**
 * `color` is the accent (any CSS colour). In dark mode it is mixed toward white
 * so saturated hues like indigo stay readable on dark cards.
 */
export default function StatTile({ label, value, color, icon }) {
  const accent = 'text-[var(--stat)] dark:text-[color-mix(in_srgb,var(--stat)_60%,white)]';
  return (
    <div className={`${CARD_CLASS} p-4`} style={{ '--stat': color }}>
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center mb-3 bg-[color-mix(in_srgb,var(--stat)_12%,transparent)] dark:bg-[color-mix(in_srgb,var(--stat)_22%,transparent)] ${accent}`}
      >
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
        </svg>
      </div>
      <p className={`text-3xl font-bold leading-none ${accent}`}>{value}</p>
      <p className="text-[10px] font-bold uppercase text-[var(--karya-text-secondary)] tracking-wider mt-2">{label}</p>
    </div>
  );
}
