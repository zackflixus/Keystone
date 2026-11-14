import { useState, useMemo, useId } from 'react';

import { useEffect } from 'react';
import api from '../../services/api';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import StatTile, { CARD_CLASS, STAT_ICONS } from '../../components/StatTile';
import { isOverdue } from '../../utils/dueDate';

/* ═══════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════ */
const BAR_COLORS = ['#4F46E5', '#FC636B', '#37A169', '#D69E2E', '#6A67CE', '#3BE8B0', '#F97316', '#EC4899'];

// Keystone chart palette — one source for every chart, tile and legend.
// Statuses keep their meaning (blue = in progress, emerald = done); neutral
// metrics (totals, hours, billable, trends) use the brand indigo.
const CHART = {
  brand: '#4F46E5',
  violet: '#7C3AED',
  todo: '#94A3B8',
  inProgress: '#3B82F6',
  review: '#F59E0B',
  done: '#10B981',
  overdue: '#EF4444',
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#3B82F6',
  billable: '#4F46E5',
  nonBillable: '#C7D2FE',     // bars / pie slices
  nonBillableLine: '#A5B4FC', // lines need a little more contrast
  nonBillableText: '#64748B', // numbers on tiles
};

function getAllTasks(lists) {
  return (lists || []).flatMap(l => l.tasks || []);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// `gradient` (any CSS background) overrides the flat `color` fill.
function ProgressBar({ value, max, color = '#4F46E5', height = 8, gradient }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-[#ECEEF7] dark:bg-white/10 rounded-full overflow-hidden" style={{ height }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient || color }} />
    </div>
  );
}

const BRAND_GRADIENT = 'linear-gradient(90deg, #4F46E5 0%, #7C3AED 100%)';
const OVERVIEW_CARD = CARD_CLASS;

/* ═══════════════════════════════════════════════════════════
   OVERVIEW VIEW
   ═══════════════════════════════════════════════════════════ */
export function OverviewView({ project, lists, members }) {
  const tasks = getAllTasks(lists);
  const done = tasks.filter(t => t.status === 'DONE').length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  const total = tasks.length;

  return (
    <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8 items-start">
    <div className="lg:col-span-2 space-y-6">
      {/* Project info */}
      <div className={`${OVERVIEW_CARD} p-6`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--karya-text-primary)]">{project.name}</h2>
            <p className="text-sm text-[var(--karya-text-secondary)] mt-1">{project.description || 'Add a project description...'}</p>
          </div>
          <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${project.visibility === 'PRIVATE' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
            {project.visibility}
          </span>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: 'Total tasks', value: total, color: CHART.brand, icon: STAT_ICONS.total },
          { label: 'Completed', value: done, color: CHART.done, icon: STAT_ICONS.done },
          { label: 'In progress', value: tasks.filter(t => t.status === 'IN_PROGRESS').length, color: CHART.inProgress, icon: STAT_ICONS.progress },
          { label: 'Overdue', value: overdue, color: CHART.overdue, icon: STAT_ICONS.overdue },
        ].map((stat) => (
          <StatTile key={stat.label} {...stat} />
        ))}
      </div>

      {/* Progress */}
      <div className={`${OVERVIEW_CARD} p-6`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">Project progress</h3>
          <span className="text-sm font-bold text-karya-blue">{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
        </div>
        <ProgressBar value={done} max={total} gradient={BRAND_GRADIENT} height={10} />
        <p className="text-xs text-[var(--karya-text-secondary)] mt-2">{done} of {total} tasks completed</p>
      </div>

      {/* Sections breakdown */}
      <div className={`${OVERVIEW_CARD} p-6`}>
        <h3 className="text-sm font-bold text-[var(--karya-text-primary)] mb-4">Sections</h3>
        <div className="space-y-3">
          {(lists || []).map((list, i) => {
            const lt = list.tasks?.length || 0;
            const ld = list.tasks?.filter(t => t.status === 'DONE').length || 0;
            return (
              <div key={list.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--karya-text-primary)]">{list.name}</span>
                  <span className="text-[10px] text-[var(--karya-text-secondary)]">{ld}/{lt}</span>
                </div>
                <ProgressBar value={ld} max={lt} color={BAR_COLORS[i % BAR_COLORS.length]} />
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Members — right column on wide screens */}
      <div className={`${OVERVIEW_CARD} p-6`}>
        <h3 className="text-sm font-bold text-[var(--karya-text-primary)] mb-4">Project members</h3>
        <div className="space-y-2.5">
          {(members || []).map(m => (
            <div key={m.userId || m.id} className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: `hsl(${(m.user?.name?.charCodeAt(0) || 0) * 15}, 60%, 50%)` }}>
                {m.user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--karya-text-primary)] truncate">{m.user?.name}</p>
                <p className="text-[10px] text-[var(--karya-text-secondary)] truncate">{m.user?.email}</p>
              </div>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[var(--karya-text-secondary)]">{m.projectRole}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TIMELINE VIEW
   ═══════════════════════════════════════════════════════════ */
export function TimelineView({ lists, onTaskClick }) {
  const tasks = getAllTasks(lists);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate date range — include both createdAt and dueDate so all bars fit
  const allDates = [];
  allDates.push(today.getTime());
  tasks.forEach(t => {
    if (t.createdAt) allDates.push(new Date(t.createdAt).getTime());
    if (t.dueDate) allDates.push(new Date(t.dueDate).getTime());
  });
  const minDate = new Date(Math.min(...allDates));
  const maxDate = allDates.length > 1
    ? new Date(Math.max(...allDates, addDays(today, 14).getTime()))
    : addDays(today, 30);

  const startDate = addDays(minDate, -3);
  const endDate = addDays(maxDate, 7);
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const dayWidth = 40;

  const getPosition = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const days = Math.ceil((d - startDate) / (1000 * 60 * 60 * 24));
    return days * dayWidth;
  };

  // Generate week headers
  const weeks = [];
  let d = new Date(startDate);
  while (d <= endDate) {
    weeks.push(new Date(d));
    d = addDays(d, 7);
  }

  // Generate day columns
  const days = [];
  d = new Date(startDate);
  while (d <= endDate) {
    days.push(new Date(d));
    d = addDays(d, 1);
  }

  return (
    <div className="h-full overflow-auto bg-[var(--karya-surface)] rounded-lg border border-[var(--karya-border)]">
      <div className="min-w-max">
        {/* Header — week labels */}
        <div className="flex border-b border-[var(--karya-border)] sticky top-0 bg-[var(--karya-surface)] z-10">
          <div className="w-52 flex-shrink-0 px-3 py-2 border-r border-[var(--karya-border)]">
            <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase">Task</span>
          </div>
          <div className="flex">
            {days.map((day, i) => {
              const isToday = day.toDateString() === today.toDateString();
              const isMonday = day.getDay() === 1;
              return (
                <div key={i} className={`flex flex-col items-center justify-center border-r border-[var(--karya-border)]/30 ${isToday ? 'bg-karya-blue/5' : ''}`}
                  style={{ width: dayWidth }}>
                  {isMonday && <span className="text-[9px] font-medium text-[var(--karya-text-secondary)]">{formatDate(day)}</span>}
                  <span className={`text-[9px] ${isToday ? 'font-bold text-karya-blue' : 'text-[var(--karya-text-secondary)]'}`}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][day.getDay()]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Task rows */}
        {(lists || []).map((list, li) => (
          <div key={list.id}>
            {/* Section header */}
            <div className="flex border-b border-[var(--karya-border)]">
              <div className="w-52 flex-shrink-0 px-3 py-1.5 bg-gray-50/50 dark:bg-gray-800/30">
                <span className="text-xs font-bold text-[var(--karya-text-primary)]">{list.name}</span>
              </div>
              <div style={{ width: totalDays * dayWidth }} className="bg-gray-50/50 dark:bg-gray-800/30" />
            </div>

            {(list.tasks || []).map((task, ti) => {
              const color = BAR_COLORS[(li * 5 + ti) % BAR_COLORS.length];
              const hasDue = !!task.dueDate;
              const isMilestone = task.taskType === 'MILESTONE';

              // Calculate bar position from createdAt → dueDate
              const taskStart = new Date(task.createdAt || today);
              taskStart.setHours(0, 0, 0, 0);
              const taskEnd = hasDue ? new Date(task.dueDate) : addDays(taskStart, 1);
              taskEnd.setHours(0, 0, 0, 0);

              const daySpan = Math.max(1, Math.ceil((taskEnd - taskStart) / (1000 * 60 * 60 * 24)));
              const barLeft = isMilestone && hasDue ? getPosition(task.dueDate) : getPosition(taskStart);
              const barWidth = isMilestone ? 0 : daySpan * dayWidth;

              return (
                <div key={task.id} className="flex border-b border-[var(--karya-border)]/50 hover:bg-gray-50/50 dark:hover:bg-gray-800/20 group">
                  <div className="w-52 flex-shrink-0 px-3 py-2 flex items-center space-x-2 border-r border-[var(--karya-border)] cursor-pointer"
                    onClick={() => onTaskClick(task.id)}>
                    {isMilestone ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" className="flex-shrink-0">
                        <rect x="6" y="0" width="7" height="7" rx="1" transform="rotate(45 6 0)"
                          className={task.status === 'DONE' ? 'fill-green-500' : 'fill-transparent stroke-gray-400'} strokeWidth="1.5" />
                      </svg>
                    ) : (
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${task.status === 'DONE' ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600'}`} />
                    )}
                    <span className={`text-xs truncate ${isMilestone ? 'font-bold' : ''} ${task.status === 'DONE' ? 'line-through text-[var(--karya-text-secondary)]' : 'text-[var(--karya-text-primary)]'}`}>{task.title}</span>
                  </div>
                  <div className="relative" style={{ width: totalDays * dayWidth, height: 32 }}>
                    <div className="absolute top-0 bottom-0 w-px bg-karya-blue/40 z-10" style={{ left: getPosition(today) }} />
                    {isMilestone ? (
                      /* Diamond marker for milestones */
                      <svg width="16" height="16" viewBox="0 0 16 16" className="absolute cursor-pointer hover:scale-125 transition-transform"
                        style={{ left: barLeft - 8, top: 8 }} onClick={() => onTaskClick(task.id)}>
                        <rect x="8" y="1" width="9" height="9" rx="1" transform="rotate(45 8 1)"
                          fill={color + (task.status === 'DONE' ? '80' : 'ff')} />
                      </svg>
                    ) : (
                      <div className="absolute top-1.5 h-5 rounded-full cursor-pointer hover:opacity-80 transition-opacity flex items-center px-2"
                        style={{ left: Math.max(0, barLeft), width: barWidth, backgroundColor: color + (task.status === 'DONE' ? '60' : 'cc') }}
                        onClick={() => onTaskClick(task.id)}>
                        <span className="text-[9px] text-white font-medium truncate">{task.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   DASHBOARD VIEW
   ═══════════════════════════════════════════════════════════ */
const DASHBOARD_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This week' },
  { value: 'last_week', label: 'Last week' },
  { value: 'month', label: 'Monthly' },
  { value: 'year', label: 'Year' },
];

function getDashboardPeriodRange(period) {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  if (period === 'this_week' || period === 'last_week') {
    const daysSinceMonday = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - daysSinceMonday - (period === 'last_week' ? 7 : 0));
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'month') {
    start.setDate(1);
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  } else if (period === 'year') {
    start.setMonth(0, 1);
    end.setMonth(11, 31);
    end.setHours(23, 59, 59, 999);
  }

  return { start, end };
}

function isDateInPeriod(date, range) {
  if (!date) return false;
  const value = new Date(date);
  return value >= range.start && value <= range.end;
}

function PeriodSelect({ value, onChange, label }) {
  return (
    <select
      value={value}
      onChange={event => onChange(event.target.value)}
      aria-label={label}
      className="rounded-md border border-[var(--karya-border)] bg-[var(--karya-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--karya-text-primary)] outline-none transition-colors hover:border-karya-blue focus:border-karya-blue focus:ring-1 focus:ring-karya-blue"
    >
      {DASHBOARD_PERIODS.map(period => (
        <option key={period.value} value={period.value}>{period.label}</option>
      ))}
    </select>
  );
}

const TASK_STATUS_CHART = [
  { key: 'TODO', label: 'To do', color: CHART.todo },
  { key: 'IN_PROGRESS', label: 'In progress', color: CHART.inProgress },
  { key: 'REVIEW', label: 'Review', color: CHART.review },
  { key: 'DONE', label: 'Completed', color: CHART.done },
];

// "X% Completed" for the donut centre of a status breakdown.
function completedCenter(statusData) {
  const total = statusData.reduce((sum, item) => sum + item.value, 0);
  const done = statusData.find(item => item.key === 'DONE' || item.label === 'Completed')?.value || 0;
  return { value: `${total > 0 ? Math.round((done / total) * 100) : 0}%`, label: 'Completed' };
}

function TaskStatusPie({ tasks }) {
  const data = TASK_STATUS_CHART.map(status => ({
    ...status,
    value: tasks.filter(task => task.status === status.key).length,
  }));
  return <SummaryPieChart data={data} center={completedCenter(data)} ariaLabel={`Task status distribution for ${tasks.length} tasks`} />;
}

// Brand bar fill: indigo at the top fading into violet.
const BILLABLE_BAR = `linear-gradient(180deg, ${CHART.brand}, ${CHART.violet})`;

// Donut ring: the conic gradient is masked to a ring so the centre can hold a headline number.
const DONUT_MASK = 'radial-gradient(farthest-side, transparent 62%, #000 63%)';

function SummaryPieChart({ data, ariaLabel, center }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let position = 0;
  const segments = data.filter(item => item.value > 0).map(item => {
    const start = position;
    position += (item.value / total) * 100;
    return `${item.color} ${start}% ${position}%`;
  });
  const background = total > 0 ? `conic-gradient(${segments.join(', ')})` : 'var(--karya-border)';

  return (
    <div className="grid h-full grid-cols-2 items-center gap-6" role="img" aria-label={ariaLabel}>
      <div className="flex h-full items-center justify-center">
        <div className="relative aspect-square w-44 max-w-[85%]">
          <div className="absolute inset-0 rounded-full" style={{ background, WebkitMask: DONUT_MASK, mask: DONUT_MASK }} />
          {center && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-extrabold leading-none text-[var(--karya-text-primary)]">{center.value}</span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-wider text-[var(--karya-text-secondary)]">{center.label}</span>
            </div>
          )}
        </div>
      </div>
      <div className="w-full space-y-3 border-l border-[var(--karya-border)] pl-6">
        {data.map(item => (
          <div key={item.label} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 flex-1 truncate text-[var(--karya-text-secondary)]">{item.label}</span>
            <span className="font-bold text-[var(--karya-text-primary)]">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildBillingTrend(tasks, period) {
  const range = getDashboardPeriodRange(period);
  const buckets = [];

  if (period === 'year') {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(range.start.getFullYear(), month, 1);
      const end = new Date(range.start.getFullYear(), month + 1, 0, 23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString('en-US', { month: 'short' }), start, end });
    }
  } else {
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }), start, end });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return buckets.map(bucket => {
    let billableMinutes = 0;
    let nonBillableMinutes = 0;
    tasks.forEach(task => {
      (task.timeEntries || []).forEach(entry => {
        if (!isDateInPeriod(entry.date, bucket)) return;
        if (task.billable === true) billableMinutes += Number(entry.minutes) || 0;
        else nonBillableMinutes += Number(entry.minutes) || 0;
      });
    });
    return {
      ...bucket,
      billable: +(billableMinutes / 60).toFixed(1),
      nonBillable: +(nonBillableMinutes / 60).toFixed(1),
    };
  });
}

function BillingBarChart({ tasks, period }) {
  const data = buildBillingTrend(tasks, period);
  const max = Math.max(...data.flatMap(item => [item.billable, item.nonBillable]), 1);
  const axisMax = max <= 5 ? Math.ceil(max) : Math.ceil(max / 5) * 5;
  const axisTicks = [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0];
  const formatTick = value => Number.isInteger(value) ? value : value.toFixed(1);

  return (
    <div>
      <div className="mb-3 flex items-center gap-5 text-[10px] text-[var(--karya-text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BILLABLE_BAR }} />Billable</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART.nonBillable }} />Non-billable</span>
      </div>
      <div className="flex w-full">
        <div className="relative mt-5 h-[185px] w-11 flex-shrink-0 border-r border-[var(--karya-border)] pr-2">
          <span className="absolute -left-1 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-semibold uppercase tracking-wider text-[var(--karya-text-secondary)]">Hours</span>
          <div className="flex h-full flex-col justify-between text-right text-[9px] text-[var(--karya-text-secondary)]">
            {axisTicks.map((tick, index) => <span key={index}>{formatTick(tick)}</span>)}
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-5 flex h-[185px] flex-col justify-between">
            {axisTicks.map((_, index) => <span key={index} className="block border-t border-[var(--karya-border)]" />)}
          </div>
          <div
            className="relative grid h-64 w-full items-end px-2 pt-5"
            style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}
          >
          {data.map((item, index) => (
            <div key={item.label} className="flex h-full min-w-0 flex-col items-center justify-end">
              <div className="flex h-[185px] w-full items-end justify-center gap-[2px] px-[2px]">
                <div title={`${item.billable} billable hours`} className="w-1/3 max-w-5 rounded-t-md transition-all duration-500" style={{ height: `${item.billable > 0 ? Math.max((item.billable / axisMax) * 100, 4) : 1}%`, background: BILLABLE_BAR }} />
                <div title={`${item.nonBillable} non-billable hours`} className="w-1/3 max-w-5 rounded-t-md transition-all duration-500" style={{ height: `${item.nonBillable > 0 ? Math.max((item.nonBillable / axisMax) * 100, 4) : 1}%`, backgroundColor: CHART.nonBillable }} />
              </div>
              <span className="h-10 origin-top-left -rotate-45 whitespace-nowrap pt-1 text-[8px] text-[var(--karya-text-secondary)]">
                {data.length > 20 ? (index % 2 === 0 ? item.label : '') : item.label}
              </span>
            </div>
          ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const ADD_WIDGET_OPTIONS = [
  { type: 'summary', title: 'Task Summary', description: 'Total, completed, in-progress and overdue tasks' },
  { type: 'priority', title: 'Task Priority', description: 'High, medium and low priority task totals' },
  { type: 'billing', title: 'Time Summary', description: 'Total, billable and non-billable hours together in one card' },
  { type: 'status', title: 'Task Status', description: 'To do, in-progress, review and completed task totals' },
];

const BAR_WIDGET_OPTIONS = [
  { type: 'billing', title: 'Billable and Non-billable', description: 'Grouped billable and non-billable hours by date' },
  { type: 'priority', title: 'Task Priority', description: 'High, medium and low priority task bars' },
  { type: 'total_hours', title: 'Total Hours', description: 'Total tracked hours by date' },
  { type: 'status', title: 'Task Status', description: 'Multiple bars for each task status' },
];

const PIE_WIDGET_OPTIONS = [
  { type: 'billing', title: 'Billable and Non-billable', description: 'Pie distribution of billable and non-billable hours' },
  { type: 'priority', title: 'Task Priority', description: 'Pie distribution of high, medium and low tasks' },
  { type: 'status', title: 'Task Status', description: 'Pie distribution of tasks by status' },
];

const LINE_WIDGET_OPTIONS = [
  { type: 'completion', title: 'Task Completion', description: 'Completed and incomplete percentage trends' },
  { type: 'billing', title: 'Billable and Non-billable', description: 'Billable and non-billable hour trends by date' },
  { type: 'priority', title: 'Task Priority', description: 'High, medium and low priority trends by date' },
  { type: 'total_hours', title: 'Total Hours', description: 'Total tracked-hour trend by date' },
  { type: 'status', title: 'Task Status', description: 'Multiple task-status trends by date' },
];

const DEFAULT_DASHBOARD_WIDGETS = [
  { id: 'default-task-summary', kind: 'card', type: 'summary', width: 'half', period: 'month' },
  { id: 'default-task-status', kind: 'pie', type: 'status', width: 'half', period: 'month' },
  { id: 'default-billing', kind: 'bar', type: 'billing', width: 'half', period: 'month' },
  { id: 'default-completion', kind: 'line', type: 'completion', width: 'half', period: 'month' },
];

function SimpleBarChart({ data }) {
  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <div className="flex h-60 items-end justify-around gap-3 border-b border-[var(--karya-border)] px-4 pt-6">
      {data.map(item => (
        <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <span className="text-xs font-bold text-[var(--karya-text-primary)]">{item.displayValue ?? item.value}</span>
          <div
            className="w-1/2 max-w-16 rounded-t-lg transition-all duration-500"
            style={{
              height: `${item.value > 0 ? Math.max((item.value / max) * 75, 5) : 1}%`,
              backgroundColor: item.color,
              // Lighter top edge for a softer, modern bar
              backgroundImage: `linear-gradient(180deg, color-mix(in srgb, ${item.color} 70%, white), ${item.color})`,
            }}
          />
          <span className="h-8 text-center text-[9px] font-semibold uppercase text-[var(--karya-text-secondary)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function TotalHoursBarChart({ tasks, period }) {
  const data = buildBillingTrend(tasks, period).map(item => ({
    label: item.label,
    value: item.billable + item.nonBillable,
    displayValue: `${(item.billable + item.nonBillable).toFixed(1)}h`,
    color: CHART.brand,
  }));
  return <SimpleBarChart data={data} />;
}

function MultiLineChart({ data, series, valueSuffix = '' }) {
  const width = 600;
  const height = 210;
  const padX = 42;
  const padY = 24;
  const max = Math.max(...data.flatMap(item => series.map(line => Number(item[line.key]) || 0)), 1);
  const axisMax = max <= 5 ? Math.ceil(max) : Math.ceil(max / 5) * 5;
  const yFor = value => height - padY - ((Number(value) || 0) / axisMax) * (height - padY * 2);
  const xFor = index => data.length <= 1 ? width / 2 : padX + (index / (data.length - 1)) * (width - padX * 2);
  // A single series gets a soft gradient area underneath; with several series
  // overlapping fills get muddy, so they stay as plain lines.
  const areaId = `line-area-${useId().replace(/:/g, '')}`;
  const single = series.length === 1 && data.length > 1 ? series[0] : null;
  const singleArea = single
    ? `${xFor(0)},${height - padY} ${data.map((item, index) => `${xFor(index)},${yFor(item[single.key])}`).join(' ')} ${xFor(data.length - 1)},${height - padY}`
    : '';

  return (
    <div className="pt-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 px-3 text-[10px] text-[var(--karya-text-secondary)]">
        {series.map(line => <span key={line.key} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: line.color }} />{line.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Line chart">
        {single && (
          <defs>
            <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={single.color} stopOpacity="0.3" />
              <stop offset="1" stopColor={single.color} stopOpacity="0" />
            </linearGradient>
          </defs>
        )}
        {single && <polygon points={singleArea} fill={`url(#${areaId})`} />}
        {[1, 0.75, 0.5, 0.25, 0].map(fraction => {
          const value = axisMax * fraction;
          const y = yFor(value);
          return <g key={fraction}><line x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--karya-border)" strokeWidth="1" /><text x={padX - 7} y={y + 3} textAnchor="end" fill="var(--karya-text-secondary)" fontSize="9">{Number.isInteger(value) ? value : value.toFixed(1)}{valueSuffix}</text></g>;
        })}
        {series.map(line => {
          const points = data.map((item, index) => ({ x: xFor(index), y: yFor(item[line.key]) }));
          if (points.length === 1) return <line key={line.key} x1={padX} y1={points[0].y} x2={width - padX} y2={points[0].y} stroke={line.color} strokeWidth="3" strokeLinecap="round" />;
          return <polyline key={line.key} points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={line.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />;
        })}
      </svg>
      <div className="flex justify-between px-10 text-[9px] text-[var(--karya-text-secondary)]"><span>{data[0]?.label}</span>{data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}{data.length > 1 && <span>{data[data.length - 1]?.label}</span>}</div>
    </div>
  );
}

function AddedDashboardWidget({ widget, tasks, onRemove, onEdit, onUpdate, dragHandleProps }) {
  const period = widget.period || 'month';
  const range = getDashboardPeriodRange(period);
  const periodTasks = tasks.filter(task => isDateInPeriod(task.createdAt, range));
  const optionList = widget.kind === 'bar' ? BAR_WIDGET_OPTIONS : widget.kind === 'pie' ? PIE_WIDGET_OPTIONS : widget.kind === 'line' ? LINE_WIDGET_OPTIONS : ADD_WIDGET_OPTIONS;
  const option = optionList.find(item => item.type === widget.type);
  const completed = periodTasks.filter(task => task.status === 'DONE').length;
  const inProgress = periodTasks.filter(task => task.status === 'IN_PROGRESS').length;
  const overdue = periodTasks.filter(task => isOverdue(task)).length;
  const periodEntries = tasks.flatMap(task => (task.timeEntries || [])
    .filter(entry => isDateInPeriod(entry.date, range))
    .map(entry => ({ ...entry, billable: task.billable === true })));
  const totalMinutes = periodEntries.reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const billableMinutes = periodEntries.filter(entry => entry.billable).reduce((sum, entry) => sum + (Number(entry.minutes) || 0), 0);
  const cardData = widget.type === 'summary' ? [
    { label: 'Total tasks', value: periodTasks.length, color: CHART.brand },
    { label: 'Completed tasks', value: completed, color: CHART.done },
    { label: 'In progress tasks', value: inProgress, color: CHART.inProgress },
    { label: 'Overdue tasks', value: overdue, color: CHART.overdue },
  ] : widget.type === 'priority' ? [
    { label: 'High priority', value: periodTasks.filter(task => task.priority === 'HIGH').length, color: CHART.high },
    { label: 'Medium priority', value: periodTasks.filter(task => task.priority === 'MEDIUM').length, color: CHART.medium },
    { label: 'Low priority', value: periodTasks.filter(task => task.priority === 'LOW').length, color: CHART.low },
  ] : widget.type === 'billing' ? [
    { label: 'Total hours', value: `${(totalMinutes / 60).toFixed(1)}h`, color: CHART.brand },
    { label: 'Billable hours', value: `${(billableMinutes / 60).toFixed(1)}h`, color: CHART.billable },
    { label: 'Non-billable hours', value: `${((totalMinutes - billableMinutes) / 60).toFixed(1)}h`, color: CHART.nonBillableText },
  ] : [
    { label: 'To do', value: periodTasks.filter(task => task.status === 'TODO').length, color: CHART.todo },
    { label: 'In progress', value: inProgress, color: CHART.inProgress },
    { label: 'Review', value: periodTasks.filter(task => task.status === 'REVIEW').length, color: CHART.review },
    { label: 'Completed', value: completed, color: CHART.done },
  ];
  const priorityBarData = [
    { label: 'High', value: periodTasks.filter(task => task.priority === 'HIGH').length, color: CHART.high },
    { label: 'Medium', value: periodTasks.filter(task => task.priority === 'MEDIUM').length, color: CHART.medium },
    { label: 'Low', value: periodTasks.filter(task => task.priority === 'LOW').length, color: CHART.low },
  ];
  const statusBarData = [
    { label: 'To do', value: periodTasks.filter(task => task.status === 'TODO').length, color: CHART.todo },
    { label: 'In progress', value: inProgress, color: CHART.inProgress },
    { label: 'Review', value: periodTasks.filter(task => task.status === 'REVIEW').length, color: CHART.review },
    { label: 'Completed', value: completed, color: CHART.done },
  ];
  const billingPieData = [
    { label: 'Billable', value: billableMinutes, color: CHART.billable },
    { label: 'Non-billable', value: totalMinutes - billableMinutes, color: CHART.nonBillable },
  ];
  const billingBuckets = buildBillingTrend(tasks, period);
  const lineData = billingBuckets.map(bucket => {
    const bucketTasks = tasks.filter(task => isDateInPeriod(task.createdAt, bucket));
    return {
      label: bucket.label,
      billable: bucket.billable,
      nonBillable: bucket.nonBillable,
      totalHours: bucket.billable + bucket.nonBillable,
      high: bucketTasks.filter(task => task.priority === 'HIGH').length,
      medium: bucketTasks.filter(task => task.priority === 'MEDIUM').length,
      low: bucketTasks.filter(task => task.priority === 'LOW').length,
      todo: bucketTasks.filter(task => task.status === 'TODO').length,
      inProgress: bucketTasks.filter(task => task.status === 'IN_PROGRESS').length,
      review: bucketTasks.filter(task => task.status === 'REVIEW').length,
      done: bucketTasks.filter(task => task.status === 'DONE').length,
    };
  });
  const lineSeries = widget.type === 'billing' ? [
    { key: 'billable', label: 'Billable', color: CHART.billable },
    { key: 'nonBillable', label: 'Non-billable', color: CHART.nonBillableLine },
  ] : widget.type === 'total_hours' ? [
    { key: 'totalHours', label: 'Total hours', color: '#4F46E5' },
  ] : widget.type === 'priority' ? [
    { key: 'high', label: 'High', color: CHART.high },
    { key: 'medium', label: 'Medium', color: CHART.medium },
    { key: 'low', label: 'Low', color: CHART.low },
  ] : [
    { key: 'todo', label: 'To do', color: CHART.todo },
    { key: 'inProgress', label: 'In progress', color: CHART.inProgress },
    { key: 'review', label: 'Review', color: CHART.review },
    { key: 'done', label: 'Completed', color: CHART.done },
  ];

  return (
    <section className="h-full bg-[var(--karya-surface)] rounded-karya-lg border border-[var(--karya-border)] shadow-karya-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[var(--karya-text-primary)]">{option.title}</h3>
          <p className="mt-0.5 text-xs text-[var(--karya-text-secondary)]">{option.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button {...dragHandleProps} aria-label={`Drag ${option.title}`} title="Drag to reorder" className="cursor-grab rounded-md p-1.5 text-[var(--karya-text-secondary)] hover:bg-gray-100 hover:text-[var(--karya-text-primary)] active:cursor-grabbing dark:hover:bg-gray-800">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" /></svg>
          </button>
          <PeriodSelect value={period} onChange={value => onUpdate(widget.id, { period: value })} label={`${option.title} period`} />
          <button onClick={() => onEdit(widget)} aria-label={`Edit ${option.title}`} className="rounded-md p-1.5 text-[var(--karya-text-secondary)] hover:bg-gray-100 hover:text-karya-blue dark:hover:bg-gray-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-8.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 7.5-7.5z" /></svg>
          </button>
          <button onClick={() => onRemove(widget.id)} aria-label={`Remove ${option.title}`} className="rounded-md p-1.5 text-[var(--karya-text-secondary)] hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>
      {widget.kind === 'card' || !widget.kind ? (
        <div className={`grid gap-3 ${cardData.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {cardData.map(item => (
            // Tinted by the metric's own colour; lightened in dark mode so it stays readable.
            <div
              key={item.label}
              style={{ '--stat': item.color }}
              className="rounded-xl p-4 border border-[color-mix(in_srgb,var(--stat)_18%,transparent)] bg-[color-mix(in_srgb,var(--stat)_7%,transparent)] dark:bg-[color-mix(in_srgb,var(--stat)_14%,transparent)]"
            >
              <p className="text-2xl font-bold text-[var(--stat)] dark:text-[color-mix(in_srgb,var(--stat)_60%,white)]">{item.value}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--karya-text-secondary)]">{item.label}</p>
            </div>
          ))}
        </div>
      ) : widget.kind === 'pie' ? (
        <SummaryPieChart
          data={widget.type === 'billing' ? billingPieData : widget.type === 'priority' ? priorityBarData : statusBarData}
          center={
            widget.type === 'billing'
              ? { value: `${(totalMinutes / 60).toFixed(1)}h`, label: 'Logged' }
              : widget.type === 'priority'
                ? { value: periodTasks.length, label: periodTasks.length === 1 ? 'Task' : 'Tasks' }
                : completedCenter(statusBarData)
          }
          ariaLabel={`${option.title} pie chart`}
        />
      ) : widget.kind === 'line' ? (
        widget.type === 'completion' ? <TaskTrendLineChart tasks={tasks} period={period} /> : <MultiLineChart data={lineData} series={lineSeries} valueSuffix={widget.type === 'billing' || widget.type === 'total_hours' ? 'h' : ''} />
      ) : widget.type === 'billing' ? (
        <BillingBarChart tasks={tasks} period={period} />
      ) : widget.type === 'total_hours' ? (
        <TotalHoursBarChart tasks={tasks} period={period} />
      ) : widget.type === 'priority' ? (
        <SimpleBarChart data={priorityBarData} />
      ) : (
        <SimpleBarChart data={statusBarData} />
      )}
    </section>
  );
}

function buildTaskTrend(tasks, period) {
  const range = getDashboardPeriodRange(period);
  const buckets = [];

  if (period === 'year') {
    for (let month = 0; month < 12; month += 1) {
      const start = new Date(range.start.getFullYear(), month, 1);
      const end = new Date(range.start.getFullYear(), month + 1, 0, 23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString('en-US', { month: 'short' }), start, end });
    }
  } else {
    const cursor = new Date(range.start);
    while (cursor <= range.end) {
      const start = new Date(cursor);
      const end = new Date(cursor);
      end.setHours(23, 59, 59, 999);
      buckets.push({ label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), start, end });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let completed = 0;
  let incomplete = 0;
  return buckets.map(bucket => {
    const bucketTasks = tasks.filter(task => isDateInPeriod(task.createdAt, bucket));
    completed += bucketTasks.filter(task => task.status === 'DONE').length;
    incomplete += bucketTasks.filter(task => task.status !== 'DONE').length;
    return { label: bucket.label, completed, incomplete };
  });
}

function TaskTrendLineChart({ tasks, period }) {
  // Gradient ids are document-global — keep each chart's own.
  const areaId = `trend-area-${useId().replace(/:/g, '')}`;
  const data = buildTaskTrend(tasks, period).map(item => {
    const total = item.completed + item.incomplete;
    return {
      ...item,
      completedPercent: total > 0 ? (item.completed / total) * 100 : 0,
      incompletePercent: total > 0 ? (item.incomplete / total) * 100 : 0,
    };
  });
  const max = 100;
  const width = 600;
  const height = 190;
  const padX = 44;
  const padY = 22;
  const toPoints = key => data.map((item, index) => ({
    ...item,
    x: data.length === 1 ? width / 2 : padX + (index / (data.length - 1)) * (width - padX * 2),
    y: height - padY - (item[key] / max) * (height - padY * 2),
  }));
  const completedPoints = toPoints('completedPercent');
  const incompletePoints = toPoints('incompletePercent');
  const completedArea = completedPoints.length > 0
    ? `${padX},${height - padY} ${completedPoints.map(point => `${point.x},${point.y}`).join(' ')} ${completedPoints[completedPoints.length - 1].x},${height - padY}`
    : '';

  return (
    <div className="pt-4">
      <div className="mb-2 flex items-center gap-5 px-3 text-[10px] text-[var(--karya-text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: CHART.brand }} />Completed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border border-[var(--karya-text-secondary)]" />Incomplete</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label="Completed and incomplete tasks over time">
        <defs>
          <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={CHART.brand} stopOpacity="0.35" />
            <stop offset="1" stopColor={CHART.violet} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[100, 75, 50, 25, 0].map(value => {
          const y = height - padY - (value / 100) * (height - padY * 2);
          return (
            <g key={value}>
              <line x1={padX} y1={y} x2={width - padX} y2={y} stroke="var(--karya-border)" strokeWidth="1" />
              <text x={padX - 8} y={y + 3} textAnchor="end" fill="var(--karya-text-secondary)" fontSize="9">{value}%</text>
            </g>
          );
        })}
        {completedArea && <polygon points={completedArea} fill={`url(#${areaId})`} />}
        {completedPoints.length > 1 && (
          <polyline points={completedPoints.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke={CHART.brand} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {completedPoints.length === 1 && <line x1={padX} y1={completedPoints[0].y} x2={width - padX} y2={completedPoints[0].y} stroke={CHART.brand} strokeWidth="3" strokeLinecap="round" />}
        {incompletePoints.length > 1 && (
          <polyline points={incompletePoints.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="var(--karya-text-secondary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {incompletePoints.length === 1 && <line x1={padX} y1={incompletePoints[0].y} x2={width - padX} y2={incompletePoints[0].y} stroke="var(--karya-text-secondary)" strokeWidth="2" strokeLinecap="round" />}
      </svg>
      <div className="flex justify-between px-5 text-[9px] text-[var(--karya-text-secondary)]">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        {data.length > 1 && <span>{data[data.length - 1]?.label}</span>}
      </div>
    </div>
  );
}

export function DashboardView({ lists, members, projectId }) {
  const tasks = getAllTasks(lists);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [addedWidgets, setAddedWidgets] = useState(DEFAULT_DASHBOARD_WIDGETS);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [editingWidgetId, setEditingWidgetId] = useState(null);
  const [newWidgetKind, setNewWidgetKind] = useState('card');
  const [newWidgetType, setNewWidgetType] = useState('summary');
  const [newWidgetWidth, setNewWidgetWidth] = useState('half');
  const availableWidgetDetails = newWidgetKind === 'bar' ? BAR_WIDGET_OPTIONS : newWidgetKind === 'pie' ? PIE_WIDGET_OPTIONS : newWidgetKind === 'line' ? LINE_WIDGET_OPTIONS : ADD_WIDGET_OPTIONS;

  useEffect(() => {
    let active = true;
    setPreferencesLoaded(false);
    api.get(`/api/v1/view-prefs/${projectId}`).then(response => {
      if (!active) return;
      const saved = response.data?.dashboardWidgets;
      setAddedWidgets(Array.isArray(saved) ? saved : DEFAULT_DASHBOARD_WIDGETS);
      setPreferencesLoaded(true);
    }).catch(() => {
      if (!active) return;
      setAddedWidgets(DEFAULT_DASHBOARD_WIDGETS);
      setPreferencesLoaded(true);
    });
    return () => { active = false; };
  }, [projectId]);

  useEffect(() => {
    if (!preferencesLoaded || !projectId) return;
    const timer = setTimeout(() => {
      api.put(`/api/v1/view-prefs/${projectId}`, { dashboardWidgets: addedWidgets }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [addedWidgets, preferencesLoaded, projectId]);

  const openAddWidget = () => {
    setEditingWidgetId(null);
    setNewWidgetKind('card');
    setNewWidgetType('summary');
    setNewWidgetWidth('half');
    setShowAddWidget(true);
  };

  const openEditWidget = widget => {
    setEditingWidgetId(widget.id);
    setNewWidgetKind(widget.kind || 'card');
    setNewWidgetType(widget.type);
    setNewWidgetWidth(widget.width || 'half');
    setShowAddWidget(true);
  };

  const updateWidget = (id, changes) => setAddedWidgets(current => current.map(widget => widget.id === id ? { ...widget, ...changes } : widget));
  const handleWidgetDragEnd = result => {
    if (!result.destination || result.destination.index === result.source.index) return;
    setAddedWidgets(current => {
      const reordered = [...current];
      const [moved] = reordered.splice(result.source.index, 1);
      reordered.splice(result.destination.index, 0, moved);
      return reordered;
    });
  };

  return (
    <div className="w-full pb-8">
      <div className="mb-4 flex justify-end">
        <button onClick={openAddWidget} className="karya-button-primary flex items-center gap-2 px-4 py-2 text-sm font-semibold">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Add widget
        </button>
      </div>
      <DragDropContext onDragEnd={handleWidgetDragEnd}>
        <Droppable droppableId="dashboard-widgets" direction="vertical">
          {provided => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="grid w-full grid-cols-2 items-start gap-4 md:gap-6">
              {addedWidgets.map((widget, index) => (
                <Draggable key={widget.id} draggableId={widget.id} index={index}>
                  {(dragProvided, snapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      className={`${widget.width === 'full' ? 'col-span-2' : 'col-span-1'} ${snapshot.isDragging ? 'z-50 opacity-95 shadow-2xl' : ''}`}
                      style={dragProvided.draggableProps.style}
                    >
                      <AddedDashboardWidget
                        widget={widget}
                        tasks={tasks}
                        onRemove={id => setAddedWidgets(current => current.filter(item => item.id !== id))}
                        onEdit={openEditWidget}
                        onUpdate={updateWidget}
                        dragHandleProps={dragProvided.dragHandleProps}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {showAddWidget && (
        <div className="karya-modal-overlay" onClick={event => event.target === event.currentTarget && setShowAddWidget(false)}>
          <div className="karya-modal max-w-lg p-6 animate-fade-in">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-lg font-bold text-[var(--karya-text-primary)]">{editingWidgetId ? 'Edit widget' : 'Add widget'}</h2><p className="mt-1 text-sm text-[var(--karya-text-secondary)]">{editingWidgetId ? 'Update this widget configuration.' : 'Choose a widget to add to this dashboard.'}</p></div>
              <button onClick={() => setShowAddWidget(false)} className="rounded-full p-1.5 text-[var(--karya-text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"><svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="space-y-5">
              <div>
                <label htmlFor="new-widget-kind" className="mb-1.5 block text-sm font-semibold text-[var(--karya-text-primary)]">Widget type</label>
                <select
                  id="new-widget-kind"
                  value={newWidgetKind}
                  onChange={event => {
                    const kind = event.target.value;
                    setNewWidgetKind(kind);
                    setNewWidgetType(kind === 'bar' ? BAR_WIDGET_OPTIONS[0].type : kind === 'pie' ? PIE_WIDGET_OPTIONS[0].type : kind === 'line' ? LINE_WIDGET_OPTIONS[0].type : ADD_WIDGET_OPTIONS[0].type);
                  }}
                  className="karya-input w-full"
                >
                  <option value="card">Card</option>
                  <option value="pie">Pie Chart</option>
                  <option value="line">Line Chart</option>
                  <option value="bar">Bar Chart</option>
                </select>
              </div>
              <div>
                <label htmlFor="new-widget-type" className="mb-1.5 block text-sm font-semibold text-[var(--karya-text-primary)]">{newWidgetKind === 'bar' ? 'Bar chart details' : newWidgetKind === 'pie' ? 'Pie chart details' : newWidgetKind === 'line' ? 'Line chart details' : 'Card details'}</label>
                <select id="new-widget-type" value={newWidgetType} onChange={event => setNewWidgetType(event.target.value)} className="karya-input w-full">
                  {availableWidgetDetails.map(option => <option key={option.type} value={option.type}>{option.title}</option>)}
                </select>
                <p className="mt-1.5 text-xs text-[var(--karya-text-secondary)]">{availableWidgetDetails.find(option => option.type === newWidgetType)?.description}</p>
              </div>
              <div>
                <label htmlFor="new-widget-width" className="mb-1.5 block text-sm font-semibold text-[var(--karya-text-primary)]">Widget width</label>
                <select id="new-widget-width" value={newWidgetWidth} onChange={event => setNewWidgetWidth(event.target.value)} className="karya-input w-full">
                  <option value="half">Half width (50%)</option>
                  <option value="full">Full width (100%)</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 border-t border-[var(--karya-border)] pt-4">
                <button onClick={() => setShowAddWidget(false)} className="rounded-karya border border-[var(--karya-border)] px-4 py-2 text-sm font-medium text-[var(--karya-text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800">Cancel</button>
                <button
                  onClick={() => {
                    if (editingWidgetId) {
                      updateWidget(editingWidgetId, { kind: newWidgetKind, type: newWidgetType, width: newWidgetWidth });
                    } else {
                      setAddedWidgets(current => [...current, { id: `${newWidgetType}-${Date.now()}`, kind: newWidgetKind, type: newWidgetType, width: newWidgetWidth, period: 'month' }]);
                    }
                    setShowAddWidget(false);
                  }}
                  className="karya-button-primary px-4 py-2 text-sm font-semibold"
                >
                  {editingWidgetId ? 'Save changes' : 'Add widget'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   GANTT VIEW
   ═══════════════════════════════════════════════════════════ */
export function GanttView({ lists, onTaskClick }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Date range: 2 months
  const startDate = addDays(today, -14);
  const endDate = addDays(today, 60);
  const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const dayWidth = 28;

  const getLeft = (date) => {
    const days = Math.ceil((new Date(date) - startDate) / (1000 * 60 * 60 * 24));
    return days * dayWidth;
  };

  // Month headers
  const months = [];
  let m = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  while (m <= endDate) {
    months.push({ date: new Date(m), left: getLeft(m) });
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
  }

  return (
    <div className="h-full overflow-auto bg-[var(--karya-surface)] rounded-lg border border-[var(--karya-border)]">
      <div style={{ minWidth: totalDays * dayWidth + 220 }}>
        {/* Month headers */}
        <div className="flex border-b border-[var(--karya-border)] sticky top-0 bg-[var(--karya-surface)] z-10 h-8">
          <div className="w-[220px] flex-shrink-0 border-r border-[var(--karya-border)]" />
          <div className="relative flex-1" style={{ width: totalDays * dayWidth }}>
            {months.map((mo, i) => (
              <span key={i} className="absolute text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase top-2"
                style={{ left: mo.left }}>
                {mo.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
            ))}
          </div>
        </div>

        {/* Rows */}
        {(lists || []).map((list, li) => (
          <div key={list.id}>
            <div className="flex border-b border-[var(--karya-border)] bg-gray-50/50 dark:bg-gray-800/20">
              <div className="w-[220px] flex-shrink-0 px-3 py-1.5 border-r border-[var(--karya-border)]">
                <span className="text-xs font-bold text-[var(--karya-text-primary)]">{list.name}</span>
              </div>
              <div style={{ width: totalDays * dayWidth }} />
            </div>
            {(list.tasks || []).map((task, ti) => {
              const color = BAR_COLORS[(li + ti) % BAR_COLORS.length];
              const isMilestone = task.taskType === 'MILESTONE';
              const due = task.dueDate ? new Date(task.dueDate) : null;
              const taskStart = isMilestone ? (due || today) : (task.createdAt ? new Date(new Date(task.createdAt).setHours(0,0,0,0)) : (due ? addDays(due, -1) : today));
              const taskEnd = due || addDays(today, 2);
              const left = getLeft(taskStart);
              const width = isMilestone ? 0 : Math.max(getLeft(taskEnd) - left, dayWidth * 2);

              return (
                <div key={task.id} className="flex border-b border-[var(--karya-border)]/40 hover:bg-gray-50/50 dark:hover:bg-gray-800/10">
                  <div className="w-[220px] flex-shrink-0 px-3 py-2 flex items-center space-x-2 border-r border-[var(--karya-border)] cursor-pointer"
                    onClick={() => onTaskClick(task.id)}>
                    {isMilestone ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" className="flex-shrink-0">
                        <rect x="6" y="0" width="7" height="7" rx="1" transform="rotate(45 6 0)"
                          className={task.status === 'DONE' ? 'fill-green-500' : 'fill-transparent stroke-gray-400'} strokeWidth="1.5" />
                      </svg>
                    ) : (
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${task.status === 'DONE' ? 'bg-green-500' : 'border-2 border-gray-300 dark:border-gray-600'}`} />
                    )}
                    <span className={`text-[11px] truncate ${isMilestone ? 'font-bold' : ''} ${task.status === 'DONE' ? 'line-through text-[var(--karya-text-secondary)]' : 'text-[var(--karya-text-primary)]'}`}>{task.title}</span>
                    {due && <span className="text-[9px] text-[var(--karya-text-secondary)] ml-auto flex-shrink-0">{formatDate(due)}</span>}
                  </div>
                  <div className="relative flex items-center" style={{ width: totalDays * dayWidth, height: 32 }}>
                    <div className="absolute top-0 bottom-0 w-px bg-red-400/30" style={{ left: getLeft(today) }} />
                    {isMilestone ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" className="absolute cursor-pointer hover:scale-125 transition-transform"
                        style={{ left: left - 7, top: 9 }} onClick={() => onTaskClick(task.id)}>
                        <rect x="7" y="0.5" width="8" height="8" rx="1" transform="rotate(45 7 0.5)"
                          fill={color + (task.status === 'DONE' ? '80' : 'ff')} />
                      </svg>
                    ) : (
                      <div className="absolute h-4 rounded cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ left: Math.max(0, left), width, backgroundColor: color + (task.status === 'DONE' ? '50' : 'bb'), top: 8 }}
                        onClick={() => onTaskClick(task.id)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WORKLOAD VIEW
   ═══════════════════════════════════════════════════════════ */
export function WorkloadView({ lists, members }) {
  const tasks = getAllTasks(lists);

  // Build per-member data
  const memberData = useMemo(() => {
    const data = {};

    // Initialize all members
    (members || []).forEach(m => {
      const name = m.user?.name || 'Unknown';
      data[name] = { name, email: m.user?.email, total: 0, done: 0, inProgress: 0, overdue: 0, estimatedMins: 0, actualMins: 0, tasks: [] };
    });
    data['Unassigned'] = { name: 'Unassigned', email: '', total: 0, done: 0, inProgress: 0, overdue: 0, estimatedMins: 0, actualMins: 0, tasks: [] };

    tasks.forEach(t => {
      const assignees = t.assignees?.length > 0 ? t.assignees.map(a => a.user?.name || 'Unknown') : ['Unassigned'];
      assignees.forEach(name => {
        if (!data[name]) data[name] = { name, email: '', total: 0, done: 0, inProgress: 0, overdue: 0, estimatedMins: 0, actualMins: 0, tasks: [] };
        data[name].total++;
        data[name].tasks.push(t);
        if (t.status === 'DONE') data[name].done++;
        if (t.status === 'IN_PROGRESS') data[name].inProgress++;
        if (isOverdue(t)) data[name].overdue++;
        if (t.estimatedTime) data[name].estimatedMins += t.estimatedTime;
        if (t.actualTime) data[name].actualMins += t.actualTime;
      });
    });

    return Object.values(data).filter(d => d.name !== 'Unassigned' || d.total > 0).sort((a, b) => b.total - a.total);
  }, [tasks, members]);

  const maxTasks = Math.max(...memberData.map(d => d.total), 1);

  const fmtTime = (mins) => {
    if (!mins) return '0h';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-4 max-w-5xl pb-8">
      <div className="bg-[var(--karya-surface)] rounded-lg border border-[var(--karya-border)] overflow-x-auto">
        {/* Header */}
        <div className="grid grid-cols-[200px_1fr_80px_80px_80px_100px] border-b border-[var(--karya-border)] bg-gray-50/50 dark:bg-gray-800/30 px-4 py-2">
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase">Member</span>
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase">Workload</span>
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase text-center">Tasks</span>
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase text-center">Done</span>
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase text-center">Overdue</span>
          <span className="text-[10px] font-bold text-[var(--karya-text-secondary)] uppercase text-center">Est. time</span>
        </div>

        {memberData.map((d, i) => {
          const pct = maxTasks > 0 ? (d.total / maxTasks) * 100 : 0;
          const isOverloaded = d.total > 10;
          return (
            <div key={d.name} className="grid grid-cols-[200px_1fr_80px_80px_80px_100px] items-center border-b border-[var(--karya-border)] px-4 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
              <div className="flex items-center space-x-2.5">
                {d.name !== 'Unassigned' ? (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }}>
                    {d.name.charAt(0).toUpperCase()}
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full border border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
                    <span className="text-[10px] text-[var(--karya-text-secondary)]">?</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--karya-text-primary)] truncate">{d.name}</p>
                  {d.email && <p className="text-[9px] text-[var(--karya-text-secondary)] truncate">{d.email}</p>}
                </div>
              </div>
              <div className="px-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-5 overflow-hidden relative">
                  <div className="h-full rounded-full transition-all duration-500 flex items-center"
                    style={{ width: `${pct}%`, backgroundColor: isOverloaded ? CHART.overdue : d.overdue > 0 ? CHART.review : CHART.done }}>
                  </div>
                  {d.inProgress > 0 && (
                    <div className="absolute top-0 h-full rounded-full opacity-30"
                      style={{ width: `${(d.inProgress / maxTasks) * 100}%`, backgroundColor: CHART.inProgress }} />
                  )}
                </div>
              </div>
              <p className="text-xs font-bold text-[var(--karya-text-primary)] text-center">{d.total}</p>
              <p className="text-xs font-bold text-green-500 text-center">{d.done}</p>
              <p className={`text-xs font-bold text-center ${d.overdue > 0 ? 'text-red-500' : 'text-[var(--karya-text-secondary)]'}`}>{d.overdue}</p>
              <p className="text-xs text-[var(--karya-text-secondary)] text-center">{fmtTime(d.estimatedMins)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
