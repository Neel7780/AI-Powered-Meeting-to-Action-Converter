import React from 'react';
import { AlertCircle, ShieldAlert, User, Bot } from 'lucide-react';
import type { DiffTaskItem } from '../../types/velocity';

interface ChronicSpilloverAlertProps {
  tasks: DiffTaskItem[];
  onResolveTask?: (taskId: string) => void;
}

export const ChronicSpilloverAlert: React.FC<ChronicSpilloverAlertProps> = ({ tasks }) => {
  if (!tasks || tasks.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-950/[0.08] p-5 backdrop-blur-sm space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/15 text-red-400">
          <AlertCircle className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">
            Chronic Bottleneck Detection ({tasks.length} Multi-Meeting Spillovers)
          </h3>
          <p className="text-[11px] text-neutral-400">
            These tasks have rolled over across multiple sprint meetings and require immediate triage
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="rounded-lg border border-red-500/20 bg-black/50 p-3.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-red-400 bg-red-500/15 px-2 py-0.5 rounded">
                  Rolled Over {task.spillover_count || 2}x
                </span>
                <span className="text-[10px] font-mono text-neutral-400 uppercase">
                  Status: {task.status}
                </span>
              </div>

              <h5 className="text-xs font-semibold text-white line-clamp-2">
                {task.title}
              </h5>

              {task.blocked_by_title && (
                <div className="mt-2 text-[10px] text-red-300 bg-red-950/40 border border-red-500/20 p-1.5 rounded flex items-center gap-1">
                  <ShieldAlert className="size-3 shrink-0 text-red-400" />
                  <span className="truncate">Blocked by: {task.blocked_by_title}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
              <span className="text-neutral-400 flex items-center gap-1 text-[10px]">
                {task.execution_type === 'agent' ? (
                  <>
                    <Bot className="size-3 text-purple-400" /> {task.assignee_name}
                  </>
                ) : (
                  <>
                    <User className="size-3 text-neutral-500" /> {task.assignee_name || 'Unassigned'}
                  </>
                )}
              </span>

              <span className="text-[10px] text-amber-400/90 font-mono">
                Needs Immediate Triage
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
