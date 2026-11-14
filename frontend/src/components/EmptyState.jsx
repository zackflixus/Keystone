import Logo from './Logo';

/** Branded empty state: Keystone mark, a title and an optional message/action. */
export default function EmptyState({ title, message, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      <Logo size={44} className="rounded-xl mb-4 shadow-karya-card opacity-95" />
      <p className="text-sm font-semibold text-[var(--karya-text-primary)]">{title}</p>
      {message && (
        <p className="text-xs text-[var(--karya-text-secondary)] mt-1 max-w-xs">{message}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
