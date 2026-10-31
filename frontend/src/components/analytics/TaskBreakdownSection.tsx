import React from 'react';
import { Layers, CalendarCheck2 } from 'lucide-react';
import type { TaskStatusBreakdown, TaskPriorityBreakdown, MeetingYieldItem } from '../../services/analyticsApi';

interface TaskBreakdownSectionProps {
  statusBreakdown: TaskStatusBreakdown;
  priorityBreakdown: TaskPriorityBreakdown;
  meetingYield: MeetingYieldItem[];
}

export const TaskBreakdownSection: React.FC<TaskBreakdownSectionProps> = ({
  statusBreakdown,
  priorityBreakdown,
  meetingYield,
}) => {
  const total = statusBreakdown.total || 1;

  const statuses = [
    { label: 'Completed', count: statusBreakdown.done, color: 'bg-emerald-400', textColor: 'text-emerald-400' },
    { label: 'In Progress', count: statusBreakdown.in_progress, color: 'bg-blue-400', textColor: 'text-blue-400' },
    { label: 'Blocked', count: statusBreakdown.blocked, color: 'bg-amber-400', textColor: 'text-amber-400' },
    { label: 'To Do', count: statusBreakdown.todo, color: 'bg-neutral-400', textColor: 'text-neutral-400' },
  ];

  const priorities = [
    { label: 'Urgent', count: priorityBreakdown.urgent, dot: 'bg-red-500' },
    { label: 'High', count: priorityBreakdown.high, dot: 'bg-amber-500' },
    { label: 'Normal', count: priorityBreakdown.normal, dot: 'bg-blue-400' },
    { label: 'Low', count: priorityBreakdown.low, dot: 'bg-neutral-400' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Status & Priority Distribution */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm space-y-5">
        <div className="flex items-center gap-2">
          <Layers className="size-4 text-indigo-400" />
          <h3 className="text-base font-semibold text-white">Task Status & Priority Distribution</h3>
        </div>

        {/* Segmented Status Bar */}
        <div>
          <div className="flex justify-between text-xs text-neutral-400 mb-2">
            <span>Workflow Status</span>
            <span>{statusBreakdown.total} Total Tasks</span>
          </div>
          <div className="h-3 w-full rounded-full bg-neutral-800 flex overflow-hidden p-0.5 gap-0.5">
            {statuses.map((s) => {
              const pct = (s.count / total) * 100;
              if (pct <= 0) return null;
              return (
                <div
                  key={s.label}
                  className={`h-full rounded-sm ${s.color} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                  title={`${s.label}: ${s.count} (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {statuses.map((s) => (
              <div key={s.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-2 text-center">
                <span className="text-[11px] text-neutral-400 block">{s.label}</span>
                <span className={`text-base font-bold ${s.textColor}`}>{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Priorities */}
        <div className="pt-2 border-t border-white/5">
          <span className="text-xs font-medium text-neutral-400 block mb-2">Priority Breakdown</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {priorities.map((p) => (
              <div key={p.label} className="flex items-center gap-2 rounded-lg bg-white/[0.02] px-3 py-2 border border-white/5">
                <span className={`size-2 rounded-full ${p.dot}`} />
                <span className="text-xs text-neutral-300">{p.label}:</span>
                <span className="text-xs font-bold text-white ml-auto">{p.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Meeting-to-Action Item Yield */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarCheck2 className="size-4 text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Meeting-to-Action Follow-Through</h3>
          </div>
          <span className="text-xs text-neutral-400">Recent Meetings</span>
        </div>

        {meetingYield.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No meeting records found for this timeframe.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {meetingYield.map((m) => (
              <div key={m.meeting_id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div className="truncate max-w-[220px]">
                  <p className="font-medium text-neutral-200 truncate">{m.meeting_title}</p>
                  <p className="text-[11px] text-neutral-500">
                    {m.starts_at ? new Date(m.starts_at).toLocaleDateString() : 'Scheduled'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-neutral-400">
                    {m.completed_tasks}/{m.total_tasks} done
                  </span>
                  <div className="w-14 text-right font-medium text-emerald-400">
                    {m.completion_rate}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

