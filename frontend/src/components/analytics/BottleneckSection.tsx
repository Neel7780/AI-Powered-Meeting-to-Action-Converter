import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { BottleneckTask } from '../../services/analyticsApi';

interface BottleneckSectionProps {
  bottlenecks: BottleneckTask[];
}

export const BottleneckSection: React.FC<BottleneckSectionProps> = ({ bottlenecks }) => {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="size-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Workflow Bottlenecks & Blocked Chains</h3>
            <p className="text-xs text-neutral-400">
              Tasks waiting on preceding dependencies before work can resume
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-400 border border-amber-500/20">
          {bottlenecks.length} Blocked
        </span>
      </div>

      {bottlenecks.length === 0 ? (
        <div className="py-8 text-center">
          <CheckCircle2 className="mx-auto size-8 text-emerald-400/60 mb-2" />
          <p className="text-sm font-medium text-neutral-300">No blocked tasks detected</p>
          <p className="text-xs text-neutral-500 mt-0.5">All workflow tasks are progressing smoothly</p>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-white/5">
          {bottlenecks.map((item) => (
            <div key={item.task_id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1 max-w-xl">
                <div className="flex items-center gap-2">
                  <span className={`inline-block size-2 rounded-full ${
                    item.priority === 'urgent' ? 'bg-red-500' : item.priority === 'high' ? 'bg-amber-500' : 'bg-neutral-500'
                  }`} />
                  <span className="text-sm font-medium text-neutral-100">{item.title}</span>
                </div>
                {item.blocked_by_title && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400/90 pl-4">
                    <ArrowRight className="size-3 shrink-0" />
                    <span>Blocked by: <strong className="text-white font-medium">{item.blocked_by_title}</strong></span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs shrink-0 pl-4 sm:pl-0">
                <span className="text-neutral-400">
                  Assignee: <span className="text-neutral-200">{item.assignee_name || 'Unassigned'}</span>
                </span>
                <span className="rounded-md bg-neutral-800/80 px-2 py-0.5 text-neutral-300 border border-white/5">
                  {item.days_open} {item.days_open === 1 ? 'day' : 'days'} open
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
