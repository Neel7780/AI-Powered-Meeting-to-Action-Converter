import React from 'react';
import { TrendingUp, AlertTriangle, CheckCircle2, CalendarDays, ArrowUpRight } from 'lucide-react';
import type { MeetingProgressDiff, SprintVelocityData } from '../../types/velocity';

interface VelocityKpiCardsProps {
  diff: MeetingProgressDiff | null;
  overallKpis: SprintVelocityData['kpis'];
}

export const VelocityKpiCards: React.FC<VelocityKpiCardsProps> = ({ diff, overallKpis }) => {
  const velocityScore = diff ? diff.velocity_score : overallKpis.average_velocity;
  const spilloverRate = diff ? diff.spillover_rate : overallKpis.overall_spillover_rate;
  const completedCount = diff ? diff.completed_tasks.length : overallKpis.total_completed_tasks;
  const spilloverCount = diff ? diff.carried_over_tasks.length : 0;
  const newTasksCount = diff ? diff.new_action_items.length : 0;
  const days = diff ? diff.days_between_meetings : overallKpis.avg_turnaround_days;

  const isHealthyVelocity = velocityScore >= 70;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Sprint Velocity Rate */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-sm transition-all hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
            Sprint Velocity
          </span>
          <div className={`flex size-7 items-center justify-center rounded-lg ${
            isHealthyVelocity ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <TrendingUp className="size-3.5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">{velocityScore}%</span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400">
            <ArrowUpRight className="size-3" />
            +4.2%
          </span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          Tasks completed between consecutive meetings
        </p>
      </div>

      {/* KPI 2: Carryover / Spillover Rate */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-sm transition-all hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
            Spillover Rate
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
            <AlertTriangle className="size-3.5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-amber-400">{spilloverRate}%</span>
          <span className="text-xs text-neutral-400 font-mono">({spilloverCount} tasks)</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          Unfinished tasks carried forward to next sprint
        </p>
      </div>

      {/* KPI 3: Meeting Delivery Yield */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-sm transition-all hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
            Delivered vs New
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <CheckCircle2 className="size-3.5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">{completedCount}</span>
          <span className="text-xs text-neutral-400">Done / <span className="text-indigo-400 font-semibold">+{newTasksCount}</span> New</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          Net throughput across selected meeting cycle
        </p>
      </div>

      {/* KPI 4: Cycle Cadence */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4.5 backdrop-blur-sm transition-all hover:border-white/20">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
            Sprint Interval
          </span>
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
            <CalendarDays className="size-3.5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-white">{days}</span>
          <span className="text-xs text-neutral-400 font-mono">Days</span>
        </div>
        <p className="mt-1 text-[11px] text-neutral-400">
          Turnaround window between selected meetings
        </p>
      </div>
    </div>
  );
};
