import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, TrendingUp } from 'lucide-react';
import type { WorkspaceKpiSummary } from '../../services/analyticsApi';

interface KpiCardsProps {
  kpis: WorkspaceKpiSummary;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Completion Rate */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-all hover:border-emerald-500/30 hover:bg-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Completion Rate
          </span>
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white">
            {kpis.completion_rate}%
          </span>
          <span className="text-xs text-neutral-400">
            ({kpis.completed_tasks}/{kpis.total_tasks} done)
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, kpis.completion_rate))}%` }}
          />
        </div>
      </div>

      {/* 2. On-Time Delivery */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-all hover:border-indigo-500/30 hover:bg-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            On-Time Delivery
          </span>
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <TrendingUp className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white">
            {kpis.on_time_completion_rate}%
          </span>
          <span className="text-xs text-neutral-400">
            {kpis.on_time_completions} on-time vs {kpis.late_completions} late
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-400 transition-all duration-500"
            style={{ width: `${Math.min(100, Math.max(0, kpis.on_time_completion_rate))}%` }}
          />
        </div>
      </div>

      {/* 3. Currently Overdue */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-all hover:border-rose-500/30 hover:bg-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Overdue Tasks
          </span>
          <div className="flex size-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Clock className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={`text-3xl font-bold tracking-tight ${kpis.currently_overdue > 0 ? 'text-rose-400' : 'text-white'}`}>
            {kpis.currently_overdue}
          </span>
          <span className="text-xs text-neutral-400">
            missed deadline
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
          <span className={`inline-block size-1.5 rounded-full ${kpis.currently_overdue > 0 ? 'bg-rose-400 animate-pulse' : 'bg-neutral-600'}`} />
          {kpis.currently_overdue > 0 ? 'Requires attention' : 'All deadlines healthy'}
        </div>
      </div>

      {/* 4. Blocked Bottlenecks */}
      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-sm transition-all hover:border-amber-500/30 hover:bg-white/[0.05]">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Blocked Tasks
          </span>
          <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          <span className={`text-3xl font-bold tracking-tight ${kpis.currently_blocked > 0 ? 'text-amber-400' : 'text-white'}`}>
            {kpis.currently_blocked}
          </span>
          <span className="text-xs text-neutral-400">
            waiting on dependencies
          </span>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
          {kpis.avg_cycle_time_hours ? (
            <span>Avg turnaround: {kpis.avg_cycle_time_hours} hrs</span>
          ) : (
            <span>Turnaround tracking active</span>
          )}
        </div>
      </div>
    </div>
  );
};
