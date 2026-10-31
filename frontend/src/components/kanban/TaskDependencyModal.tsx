import React, { useState, useMemo } from 'react';
import type { KanbanTaskItem, TaskStatus } from './KanbanCard';
import {
  X,
  Link as LinkIcon,
  Unlink,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bot,
  User,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface TaskDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: KanbanTaskItem | null;
  allTasks: KanbanTaskItem[];
  onUpdateDependency: (taskId: string, blockedById: string | null, executionType?: 'human' | 'agent') => Promise<void> | void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
}

export const TaskDependencyModal: React.FC<TaskDependencyModalProps> = ({
  isOpen,
  onClose,
  task,
  allTasks,
  onUpdateDependency,
  onStatusChange,
}) => {
  if (!isOpen || !task) return null;

  const [selectedBlockedBy, setSelectedBlockedBy] = useState<string>(task.blocked_by || '');
  const [executionType, setExecutionType] = useState<'human' | 'agent'>(
    task.execution_type === 'agent' ? 'agent' : 'human'
  );
  const [isSaving, setIsSaving] = useState(false);

  // 1. Current blocking task (Prerequisite)
  const currentBlockingTask = useMemo(() => {
    return allTasks.find((t) => t.id === selectedBlockedBy);
  }, [allTasks, selectedBlockedBy]);

  // 2. Downstream tasks (Tasks that are waiting for THIS task to complete)
  const downstreamTasks = useMemo(() => {
    return allTasks.filter((t) => t.blocked_by === task.id);
  }, [allTasks, task.id]);

  // 3. Detect Circular Dependency:
  // If user selects Task X, check if Task X is already blocked by task.id (or transitive cycle)
  const isCircular = useMemo(() => {
    if (!selectedBlockedBy) return false;
    if (selectedBlockedBy === task.id) return true;

    // Check if selected task depends on current task
    const targetTask = allTasks.find((t) => t.id === selectedBlockedBy);
    if (targetTask?.blocked_by === task.id) return true;

    return false;
  }, [selectedBlockedBy, task.id, allTasks]);

  // 4. Eligible tasks that can be chosen as prerequisites (exclude self & tasks that depend on this task)
  const eligiblePrerequisites = useMemo(() => {
    const downstreamIds = new Set(downstreamTasks.map((t) => t.id));
    return allTasks.filter((t) => t.id !== task.id && !downstreamIds.has(t.id));
  }, [allTasks, task.id, downstreamTasks]);

  const handleSave = async () => {
    if (isCircular) return;
    setIsSaving(true);
    try {
      const newBlockedBy = selectedBlockedBy ? selectedBlockedBy : null;
      await onUpdateDependency(task.id, newBlockedBy, executionType);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveDependency = async () => {
    setIsSaving(true);
    try {
      setSelectedBlockedBy('');
      await onUpdateDependency(task.id, null, executionType);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#202020] dark:bg-[#0c0c0e] dark:text-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dependency-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <LinkIcon className="size-4" />
              </span>
              <h2 id="dependency-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Task Dependencies & Workflow Chain
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">
              Configure prerequisites and execution routing for this action item.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Close modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Current Task Summary Banner */}
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-[#121216]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 dark:text-neutral-400">
              Current Target Task
            </span>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              task.status === 'done'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
                : task.status === 'blocked'
                ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400'
                : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400'
            }`}>
              Status: {task.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">
            {task.title}
          </h3>
        </div>

        {/* Form Body */}
        <div className="mt-6 space-y-6">
          {/* 1. Execution Routing (Human vs AI Agent) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-2">
              Task Execution Mode (Sprint 2 Specification)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setExecutionType('human')}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  executionType === 'human'
                    ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-950/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5'
                }`}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                  <User className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Human Assignee</p>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">Team member executes task manually</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setExecutionType('agent')}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                  executionType === 'agent'
                    ? 'border-purple-500 bg-purple-50/60 ring-2 ring-purple-500/20 dark:border-purple-400 dark:bg-purple-950/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:hover:bg-white/5'
                }`}
              >
                <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                  <Bot className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                    AI Agent Runner <Sparkles className="size-3 text-purple-500" />
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-neutral-400">Auto-triggers research, drafting or checklist</p>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Prerequisite Dependency Selector (Blocked By) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="prerequisite-select" className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-neutral-300">
                Prerequisite Task (Must Complete First)
              </label>
              {selectedBlockedBy && (
                <button
                  type="button"
                  onClick={handleRemoveDependency}
                  className="inline-flex items-center gap-1 text-[11px] text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  <Unlink className="size-3" /> Remove dependency
                </button>
              )}
            </div>

            <select
              id="prerequisite-select"
              value={selectedBlockedBy}
              onChange={(e) => setSelectedBlockedBy(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-white/15 dark:bg-[#141418] dark:text-white"
            >
              <option value="">-- No Dependency (Independent Task) --</option>
              {eligiblePrerequisites.map((t) => (
                <option key={t.id} value={t.id}>
                  [{t.status.toUpperCase()}] {t.title.slice(0, 65)}{t.title.length > 65 ? '...' : ''}
                </option>
              ))}
            </select>

            {/* Circular Dependency Warning */}
            {isCircular && (
              <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300">
                <AlertTriangle className="size-4 shrink-0 text-red-500" />
                <span>
                  <strong>Circular Dependency Detected!</strong> This task cannot depend on a task that already depends on it.
                </span>
              </div>
            )}

            {/* Status of prerequisite task */}
            {currentBlockingTask && !isCircular && (
              <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-neutral-400">Prerequisite State:</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                    currentBlockingTask.status === 'done'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                  }`}>
                    {currentBlockingTask.status === 'done' ? (
                      <><CheckCircle2 className="size-3" /> Completed</>
                    ) : (
                      <><Clock className="size-3" /> In Progress (Blocking this task)</>
                    )}
                  </span>
                </div>
                <p className="mt-1 font-medium text-slate-800 dark:text-neutral-200 truncate">
                  "{currentBlockingTask.title}"
                </p>
                {currentBlockingTask.status === 'done' && task.status === 'blocked' && onStatusChange && (
                  <button
                    type="button"
                    onClick={() => onStatusChange(task.id, 'todo')}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  >
                    Prerequisite is done! Click to Unblock task ➔ Move to To Do
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 3. Downstream Dependent Tasks (What depends on this task) */}
          {downstreamTasks.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-neutral-300 mb-2">
                Downstream Dependents ({downstreamTasks.length})
              </p>
              <div className="space-y-1.5">
                {downstreamTasks.map((dep) => (
                  <div
                    key={dep.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-white/10 dark:bg-[#141418]"
                  >
                    <span className="truncate text-slate-700 dark:text-neutral-300">{dep.title}</span>
                    <span className="shrink-0 text-[10px] font-mono uppercase text-slate-400 dark:text-neutral-500">
                      Waiting for this
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-white/10">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isCircular}
            className="bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {isSaving ? 'Saving...' : 'Apply Dependency'}
          </Button>
        </div>
      </div>
    </div>
  );
};
