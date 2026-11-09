import React from 'react';
import { TrendingUp, BarChart2, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import type { VelocityTrendPoint } from '../../types/velocity';

interface VelocityTrendChartProps {
  trendHistory: VelocityTrendPoint[];
}

export const VelocityTrendChart: React.FC<VelocityTrendChartProps> = ({ trendHistory }) => {
  if (!trendHistory || trendHistory.length === 0) {
    return null;
  }

  // Find max tasks count to normalize bar heights
  const maxTasks = Math.max(...trendHistory.map((p) => p.planned_tasks), 10);

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <BarChart2 className="size-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Sprint Velocity & Carryover Trend</h3>
            <p className="text-[11px] text-neutral-400">
              Meeting-by-meeting delivery throughput and spillover trendline
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-emerald-400" />
            <span className="text-neutral-300">Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-amber-400" />
            <span className="text-neutral-300">Carried Over</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-indigo-400" />
            <span className="text-neutral-300">Velocity %</span>
          </div>
        </div>
      </div>

      {/* Main Bar Chart Container */}
      <div className="pt-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4 items-end min-h-[220px] pb-2">
          {trendHistory.map((point) => {
            const completedHeightPct = Math.round((point.completed_tasks / maxTasks) * 100);
            const carriedHeightPct = Math.round((point.carried_over / maxTasks) * 100);

            return (
              <div key={point.meeting_id} className="flex flex-col items-center gap-2 h-full justify-end">
                {/* Velocity Pill Badge */}
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-white bg-white/10 px-2 py-0.5 rounded-full border border-white/10 mb-1">
                  <TrendingUp className="size-3 text-indigo-400" />
                  {point.velocity_percentage}%
                </div>

                {/* Vertical Stacked Bar */}
                <div className="w-16 sm:w-20 bg-neutral-900 rounded-lg p-1 flex flex-col justify-end border border-white/10 h-36 gap-1 relative overflow-hidden group">
                  {/* Tooltip on hover */}
                  <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-1 text-[10px] text-center z-10 pointer-events-none">
                    <span className="text-emerald-400 font-bold">{point.completed_tasks} Done</span>
                    <span className="text-amber-400 font-bold">{point.carried_over} Spillover</span>
                    <span className="text-neutral-400 font-mono">{point.planned_tasks} Total</span>
                  </div>

                  {/* Carried over portion */}
                  {carriedHeightPct > 0 && (
                    <div
                      className="w-full rounded bg-amber-500/80 transition-all duration-300"
                      style={{ height: `${Math.max(carriedHeightPct, 12)}%` }}
                      title={`Carried Over: ${point.carried_over}`}
                    />
                  )}

                  {/* Completed portion */}
                  {completedHeightPct > 0 && (
                    <div
                      className="w-full rounded bg-emerald-500 transition-all duration-300"
                      style={{ height: `${Math.max(completedHeightPct, 15)}%` }}
                      title={`Completed: ${point.completed_tasks}`}
                    />
                  )}
                </div>

                {/* X-axis Labels */}
                <div className="text-center mt-1">
                  <span className="text-xs font-medium text-white block truncate max-w-[120px]" title={point.meeting_title}>
                    {point.meeting_title}
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500 block">
                    {point.date_label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Footer Insight */}
      <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-indigo-400 shrink-0" />
          <span>
            Target threshold: Maintain <strong>&gt;75% Velocity</strong> and keep spillover under <strong>25%</strong>.
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="size-3" /> Healthy Velocity
          </span>
          <span className="text-amber-400 flex items-center gap-1">
            <AlertTriangle className="size-3" /> High Spillover Risk
          </span>
        </div>
      </div>
    </div>
  );
};

