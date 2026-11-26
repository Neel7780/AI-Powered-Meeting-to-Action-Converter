import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Clock,
  Bot,
  User,
  Quote,
  ShieldAlert,
  Calendar,
  Check,
  ArrowRight,
  Filter,
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
  const [filterMode, setFilterMode] = useState<'all' | 'urgent' | 'agent'>('all');

  if (!diff) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-neutral-400">
        Please select two meetings above to view the progress diff.
      </div>
    );
  }

  const { completed_tasks, carried_over_tasks, new_action_items } = diff;

  const handleRollover = async (task: DiffTaskItem) => {
    setRollingOverId(task.id);
    const wsId = currentWorkspace?.id || '';
    const success = await rolloverTaskToMeeting(wsId, task.id, diff.current_meeting.id);
    setRollingOverId(null);
    if (success) {
      setRolledOverSuccess((prev) => new Set(prev).add(task.id));
      if (onRefresh) onRefresh();
    }
  };

  const filterTasks = (tasks: DiffTaskItem[]) => {
    if (filterMode === 'urgent') return tasks.filter((t) => t.priority === 'urgent' || t.priority === 'high');
    if (filterMode === 'agent') return tasks.filter((t) => t.execution_type === 'agent');
    return tasks;
  };

  const filteredCompleted = useMemo(() => filterTasks(completed_tasks), [completed_tasks, filterMode]);
  const filteredCarried = useMemo(() => filterTasks(carried_over_tasks), [carried_over_tasks, filterMode]);
  const filteredNew = useMemo(() => filterTasks(new_action_items), [new_action_items, filterMode]);

  return (
    <div className="space-y-3">
      {/* Mini Filter Toolbar */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Filter className="size-3 text-neutral-500" />
          <span>Filter tasks:</span>
          {(['all', 'urgent', 'agent'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setFilterMode(m)}
              className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition ${
                filterMode === m
                  ? 'bg-white/15 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {m === 'all' ? 'All' : m === 'urgent' ? 'High/Urgent' : 'AI Agent'}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-neutral-500">
          Total: {completed_tasks.length + carried_over_tasks.length + new_action_items.length} tasks
        </span>
      </div>

      {/* 3-Column Comparative Board */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 items-start">
        {/* ================= COLUMN 1: COMPLETED TASKS ================= */}
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-950/[0.04] p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-2.5 border-b border-emerald-500/15 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400" />
              <h4 className="text-xs font-semibold text-white tracking-wide uppercase">Delivered</h4>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-400">
              {filteredCompleted.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[520px] pr-1">
            {filteredCompleted.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-neutral-500 border border-dashed border-emerald-500/20 rounded-lg">
                No delivered tasks
              </div>
            ) : (
              filteredCompleted.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-emerald-500/15 bg-black/40 p-3 transition-colors hover:border-emerald-500/30"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 font-medium">
                      <CheckCircle2 className="size-2.5" /> Done
                    </span>
                    {task.execution_type === 'agent' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded">
                        <Bot className="size-2.5" /> Agent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-400">
                        <User className="size-2.5" /> {task.assignee_name || 'Human'}
                      </span>
                    )}
                  </div>

                  <h5 className="text-xs font-medium text-white line-clamp-2 leading-relaxed">
                    {task.title}
                  </h5>

                  {task.source_excerpt && (
                    <div className="mt-1.5 text-[10px] text-neutral-500 italic line-clamp-1 flex items-center gap-1">
                      <Quote className="size-2 shrink-0 text-emerald-500/60" />
                      <span>{task.source_excerpt}</span>
                    </div>
                  )}

                  {task.completed_at && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-mono text-emerald-400/70">
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
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/[0.04] p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-2.5 border-b border-amber-500/15 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400" />
              <h4 className="text-xs font-semibold text-white tracking-wide uppercase">Carried Over</h4>
            </div>
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-400">
              {filteredCarried.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[520px] pr-1">
            {filteredCarried.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-neutral-500 border border-dashed border-amber-500/20 rounded-lg">
                Zero carryover! All tasks done
              </div>
            ) : (
              filteredCarried.map((task) => {
                const isBlocked = task.status === 'blocked';
                const isSuccessRolled = rolledOverSuccess.has(task.id);

                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-amber-500/20 bg-black/40 p-3 transition-colors hover:border-amber-500/35"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono font-medium ${
                        isBlocked
                          ? 'bg-red-500/15 text-red-400'
                          : task.status === 'in_progress'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}>
                        {task.status.toUpperCase()}
                      </span>

                      <span className="text-[10px] font-mono text-amber-400/90 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                        Rolled 1x
                      </span>
                    </div>

                    <h5 className="text-xs font-medium text-white line-clamp-2 leading-relaxed">
                      {task.title}
                    </h5>

                    {/* Blocked Explanation */}
                    {isBlocked && (
                      <div className="mt-1.5 text-[10px] text-red-300 bg-red-950/30 border border-red-500/20 p-1.5 rounded flex items-center gap-1">
                        <ShieldAlert className="size-2.5 shrink-0 text-red-400" />
                        <span className="truncate">Blocked by: {task.blocked_by_title || 'Prerequisite Task'}</span>
                      </div>
                    )}

                    <div className="mt-2.5 flex items-center justify-between text-[11px] pt-1">
                      <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                        <User className="size-2.5 text-neutral-500" />
                        {task.assignee_name || 'Unassigned'}
                      </span>

                      {/* 1-Click Rollover / Carry Forward Button */}
                      <button
                        type="button"
                        onClick={() => handleRollover(task)}
                        disabled={rollingOverId === task.id || isSuccessRolled}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded transition flex items-center gap-1 ${
                          isSuccessRolled
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
                        }`}
                        title="Carry forward this task to the current meeting"
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
        <div className="rounded-xl border border-indigo-500/15 bg-indigo-950/[0.04] p-4 flex flex-col min-h-[420px]">
          <div className="flex items-center justify-between pb-2.5 border-b border-indigo-500/15 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-indigo-400" />
              <h4 className="text-xs font-semibold text-white tracking-wide uppercase">New Action Items</h4>
            </div>
            <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-400">
              {filteredNew.length}
            </span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[520px] pr-1">
            {filteredNew.length === 0 ? (
              <div className="h-28 flex items-center justify-center text-xs text-neutral-500 border border-dashed border-indigo-500/20 rounded-lg">
                No new tasks created in this meeting
              </div>
            ) : (
              filteredNew.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-indigo-500/15 bg-black/40 p-3 transition-colors hover:border-indigo-500/30"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300 font-medium">
                      NEW
                    </span>
                    <span className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded ${
                      task.priority === 'urgent'
                        ? 'bg-red-500/15 text-red-400'
                        : task.priority === 'high'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-white/5 text-neutral-400'
                    }`}>
                      {task.priority.toUpperCase()}
                    </span>
                  </div>

                  <h5 className="text-xs font-medium text-white line-clamp-2 leading-relaxed">
                    {task.title}
                  </h5>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                      <User className="size-2.5 text-neutral-500" />
                      {task.assignee_name || 'Unassigned'}
                    </span>
                    {task.deadline_utc && (
                      <span className="text-[10px] text-neutral-500 font-mono flex items-center gap-1">
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
