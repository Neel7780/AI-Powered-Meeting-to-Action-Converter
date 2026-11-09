import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  Bot,
  User,
  Quote,
  ArrowRight,
  ShieldAlert,
  Calendar,
  Check,
} from 'lucide-react';
import type { MeetingProgressDiff, DiffTaskItem } from '../../types/velocity';
import { rolloverTaskToMeeting } from '../../services/velocityApi';
import { useWorkspace } from '../../context/WorkspaceContext';

interface MeetingProgressDiffViewProps {
  diff: MeetingProgressDiff | null;
  onRefresh?: () => void;
}

export const MeetingProgressDiffView: React.FC<MeetingProgressDiffViewProps> = ({ diff, onRefresh }) => {
  const { currentWorkspace } = useWorkspace();
  const [rollingOverId, setRollingOverId] = useState<string | null>(null);
  const [rolledOverSuccess, setRolledOverSuccess] = useState<Set<string>>(new Set());

  if (!diff) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-neutral-400">
        Please select two meetings above to view the progress diff.
      </div>
    );
  }

  const { completed_tasks, carried_over_tasks, new_action_items, base_meeting, current_meeting } = diff;

  const handleRollover = async (task: DiffTaskItem) => {
    setRollingOverId(task.id);
    const wsId = currentWorkspace?.id || '';
    const success = await rolloverTaskToMeeting(wsId, task.id, current_meeting.id);
    setRollingOverId(null);
    if (success) {
      setRolledOverSuccess((prev) => new Set(prev).add(task.id));
      if (onRefresh) onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Visual Header summary pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white">{base_meeting.title}</span>
          <ArrowRight className="size-3 text-neutral-500" />
          <span className="font-semibold text-white">{current_meeting.title}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-400" />
            {completed_tasks.length} Completed
          </span>
          <span className="inline-flex items-center gap-1.5 text-amber-400">
            <span className="size-2 rounded-full bg-amber-400" />
            {carried_over_tasks.length} Carried Over
          </span>
          <span className="inline-flex items-center gap-1.5 text-indigo-400">
            <span className="size-2 rounded-full bg-indigo-400" />
            {new_action_items.length} Newly Created
          </span>
        </div>
      </div>

      {/* 3-Column Differential Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* ================= COLUMN 1: COMPLETED TASKS ================= */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/[0.08] p-4.5 flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-500/15 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="size-3.5" />
              </div>
              <h4 className="text-sm font-semibold text-white">Delivered / Completed</h4>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-400">
              {completed_tasks.length}
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 mb-3">
            Tasks agreed in Base Meeting and completed before or during Current Meeting
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {completed_tasks.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-xs text-neutral-500 border border-dashed border-emerald-500/20 rounded-lg">
                No completed tasks recorded in this cycle
              </div>
            ) : (
              completed_tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-emerald-500/20 bg-black/40 p-3.5 transition-all hover:border-emerald-500/40"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wider font-mono">
                      <CheckCircle2 className="size-2.5" /> Done
                    </span>
                    {task.execution_type === 'agent' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 bg-purple-500/15 px-1.5 py-0.5 rounded">
                        <Bot className="size-3" /> Agent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-300 bg-white/5 px-1.5 py-0.5 rounded">
                        <User className="size-3" /> {task.assignee_name || 'Human'}
                      </span>
                    )}
                  </div>

                  <h5 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                    {task.title}
                  </h5>

                  {task.description && (
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  {task.source_excerpt && (
                    <div className="mt-2 text-[10px] text-neutral-500 italic bg-white/[0.02] p-1.5 rounded border border-white/5 line-clamp-2 flex items-start gap-1">
                      <Quote className="size-2.5 shrink-0 text-emerald-500/60 mt-0.5" />
                      <span>{task.source_excerpt}</span>
                    </div>
                  )}

                  {task.completed_at && (
                    <div className="mt-2.5 flex items-center gap-1 text-[10px] font-mono text-emerald-400/80">
                      <Clock className="size-2.5" />
                      <span>Completed {new Date(task.completed_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: CARRIED-OVER / SPILLOVER TASKS ================= */}
        <div className="rounded-xl border border-amber-500/25 bg-amber-950/[0.08] p-4.5 flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-amber-500/20 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-400">
                <AlertTriangle className="size-3.5" />
              </div>
              <h4 className="text-sm font-semibold text-white">Carried-Over / Spillover</h4>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
              {carried_over_tasks.length}
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 mb-3">
            Unfinished tasks from Base Meeting needing attention or rollover into current sprint
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {carried_over_tasks.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-xs text-neutral-500 border border-dashed border-amber-500/20 rounded-lg">
                Zero spillover! All base meeting commitments completed 🎉
              </div>
            ) : (
              carried_over_tasks.map((task) => {
                const isBlocked = task.status === 'blocked';
                const isSuccessRolled = rolledOverSuccess.has(task.id);

                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-amber-500/25 bg-black/40 p-3.5 transition-all hover:border-amber-500/50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider font-mono ${
                        isBlocked
                          ? 'bg-red-500/15 text-red-400'
                          : task.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {task.status.toUpperCase()}
                      </span>

                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Carried 1x
                      </span>
                    </div>

                    <h5 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                      {task.title}
                    </h5>

                    {/* Blocked Explanation if blocked */}
                    {isBlocked && (
                      <div className="mt-2 text-[10px] text-red-400 bg-red-950/40 border border-red-500/20 p-1.5 rounded flex items-center gap-1">
                        <ShieldAlert className="size-3 shrink-0" />
                        <span className="truncate">Blocked by: {task.blocked_by_title || 'Prerequisite Task'}</span>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[11px] pt-1">
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <User className="size-3 text-neutral-500" />
                        {task.assignee_name || 'Unassigned'}
                      </span>

                      {/* 1-Click Rollover / Carry Forward Button */}
                      <button
                        type="button"
                        onClick={() => handleRollover(task)}
                        disabled={rollingOverId === task.id || isSuccessRolled}
                        className={`text-[10px] font-medium px-2 py-1 rounded transition flex items-center gap-1 ${
                          isSuccessRolled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
                        }`}
                        title="Link and carry forward this task to the current meeting record"
                      >
                        {isSuccessRolled ? (
                          <>
                            <Check className="size-2.5" /> Rolled Over
                          </>
                        ) : (
                          <>
                            <ArrowRight className="size-2.5" /> Carry Forward
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= COLUMN 3: NEW ACTION ITEMS ================= */}
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/[0.08] p-4.5 flex flex-col min-h-[460px]">
          <div className="flex items-center justify-between pb-3 border-b border-indigo-500/15 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-400">
                <PlusCircle className="size-3.5" />
              </div>
              <h4 className="text-sm font-semibold text-white">New Action Items</h4>
            </div>
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-400">
              {new_action_items.length}
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 mb-3">
            Fresh commitments and tasks newly identified during Current Meeting
          </p>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {new_action_items.length === 0 ? (
              <div className="h-32 flex flex-col items-center justify-center text-xs text-neutral-500 border border-dashed border-indigo-500/20 rounded-lg">
                No new tasks extracted from this meeting yet
              </div>
            ) : (
              new_action_items.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-indigo-500/20 bg-black/40 p-3.5 transition-all hover:border-indigo-500/40"
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium text-indigo-400 uppercase tracking-wider font-mono">
                      NEW
                    </span>
                    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                      task.priority === 'urgent'
                        ? 'bg-red-500/15 text-red-400'
                        : task.priority === 'high'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-white/5 text-neutral-300'
                    }`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>

                  <h5 className="text-xs font-semibold text-white leading-snug line-clamp-2">
                    {task.title}
                  </h5>

                  {task.description && (
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <User className="size-3 text-neutral-500" />
                      {task.assignee_name || 'Unassigned'}
                    </span>
                    {task.deadline_utc && (
                      <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-1">
                        <Calendar className="size-2.5" />
                        {new Date(task.deadline_utc).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

