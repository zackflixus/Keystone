import { dueState } from '../utils/dueDate';

const TONE = {
  overdue: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  today: 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
  neutral: 'text-[var(--karya-text-secondary)] bg-gray-100 dark:bg-white/5',
};

/** Pill showing a task's due date: red when overdue, amber when due today. */
export default function DueChip({ task, className = '' }) {
  if (!task?.dueDate) return null;
  const state = dueState(task);
  const date = new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const tone = state === 'overdue' || state === 'today' ? TONE[state] : TONE.neutral;
  const label = state === 'overdue' ? `Overdue · ${date}` : state === 'today' ? 'Today' : date;

  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${tone} ${className}`}>
      {label}
    </span>
  );
}
