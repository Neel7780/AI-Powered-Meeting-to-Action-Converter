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
    <div className="space-y-3">
      {/* 4 Clean Minimal Metric Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Metric 1: Sprint Velocity */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Sprint Velocity</span>
            <div className={`flex size-6 items-center justify-center rounded-md ${
              isHealthyVelocity ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
            }`}>
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">{velocityScore}%</span>
            <span className="inline-flex items-center text-[11px] font-medium text-emerald-400">
              <ArrowUpRight className="size-3" />
              On Track
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400">Commitments delivered</p>
        </div>

        {/* Metric 2: Spillover Rate */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Carryover Rate</span>
            <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/10 text-amber-400">
              <AlertTriangle className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-400">{spilloverRate}%</span>
            <span className="text-xs font-mono text-neutral-400">({spilloverCount} tasks)</span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400">Rolled to next meeting</p>
        </div>

        {/* Metric 3: Delivered vs New */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Throughput</span>
            <div className="flex size-6 items-center justify-center rounded-md bg-indigo-500/10 text-indigo-400">
              <CheckCircle2 className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">{completedCount}</span>
            <span className="text-xs text-neutral-400">Done · <span className="font-semibold text-indigo-400">+{newTasksCount}</span> New</span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400">Net items completed vs added</p>
        </div>

        {/* Metric 4: Cadence Interval */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/15">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Sprint Interval</span>
            <div className="flex size-6 items-center justify-center rounded-md bg-blue-500/10 text-blue-400">
              <CalendarDays className="size-3.5" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-white">{days}</span>
            <span className="text-xs font-mono text-neutral-400">Days</span>
          </div>
          <p className="mt-0.5 text-[11px] text-neutral-400">Between selected meetings</p>
        </div>
      </div>

      {/* Visual Velocity Ratio Split Bar (Quick glance summary) */}
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.01] px-4 py-2.5">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1.5 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span>{completedCount} Completed ({velocityScore}%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-400" />
            <span>{spilloverCount} Carried Over ({spilloverRate}%)</span>
          </div>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800 flex">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${velocityScore}%` }}
          />
          <div
            className="h-full bg-amber-500 transition-all duration-500"
            style={{ width: `${spilloverRate}%` }}
          />
        </div>
      </div>
    </div>
  );
};
