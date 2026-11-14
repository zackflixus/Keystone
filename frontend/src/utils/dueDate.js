// Due dates are date-only (stored as midnight UTC), so compare calendar days,
// not instants — otherwise a task due today turns "overdue" early in the
// morning. Same rule the project List view already uses.

export const isDoneStatus = (status) => status === 'DONE' || status === 'VERIFIED';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Whole days from today to the due date (negative = in the past). */
export function dueDayDiff(dueDate, now = new Date()) {
  return Math.round((startOfDay(new Date(dueDate)) - startOfDay(now)) / 86400000);
}

/** 'overdue' | 'today' | 'upcoming' | 'none' (no date, or already done). */
export function dueState(task, now = new Date()) {
  if (!task?.dueDate || isDoneStatus(task.status)) return 'none';
  const diff = dueDayDiff(task.dueDate, now);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  return 'upcoming';
}

export const isOverdue = (task, now) => dueState(task, now) === 'overdue';
export const isDueToday = (task, now) => dueState(task, now) === 'today';
