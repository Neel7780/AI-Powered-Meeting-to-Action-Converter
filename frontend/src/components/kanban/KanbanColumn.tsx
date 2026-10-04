import React, { useState } from 'react';
import { KanbanCard, type KanbanTaskItem, type TaskStatus } from './KanbanCard';
import { CircleDot, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: KanbanTaskItem[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onDropTask: (taskId: string, targetStatus: TaskStatus) => Promise<void> | void;
  updatingTaskIds?: Set<string>;
}

const columnMeta: Record<
  TaskStatus,
  {
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    borderGlow: string;
    headerBadge: string;
  }
> = {
  todo: {
    icon: CircleDot,
    accentColor: 'text-slate-500 dark:text-neutral-400',
    borderGlow: 'border-slate-300 bg-slate-200/50 dark:border-white/20 dark:bg-neutral-900/30',
    headerBadge: 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700',
  },
  in_progress: {
    icon: Clock,
    accentColor: 'text-amber-600 dark:text-amber-400',
    borderGlow: 'border-amber-400 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/5',
    headerBadge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  },
  blocked: {
    icon: AlertCircle,
    accentColor: 'text-red-600 dark:text-red-400',
    borderGlow: 'border-red-400 bg-red-50/50 dark:border-red-500/40 dark:bg-red-500/5',
    headerBadge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
  },
  done: {
    icon: CheckCircle2,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    borderGlow: 'border-emerald-400 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-500/5',
    headerBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  },
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  status,
  title,
  tasks,
  onStatusChange,
  onDropTask,
  updatingTaskIds = new Set(),
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const meta = columnMeta[status];
  const Icon = meta.icon;

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    // Only set false if we actually left the column container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);

    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      await onDropTask(taskId, status);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col rounded-xl border bg-slate-100/70 p-3 transition-all duration-200 min-h-[500px] h-full dark:bg-[#040404]
        ${isDragOver ? `${meta.borderGlow} ring-1 ring-indigo-500/20 dark:ring-white/10 shadow-lg` : 'border-slate-200 dark:border-[#181818]'}
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/80 dark:border-[#181818]">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${meta.accentColor}`} />
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h2>
        </div>

        {/* Task Counter */}
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium border ${meta.headerBadge}`}
        >
          {tasks.length}
        </span>
      </div>

      {/* Cards Scrollable List */}
      <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            isUpdating={updatingTaskIds.has(task.id)}
          />
        ))}

        {/* Empty state or Drop Placeholder */}
        {tasks.length === 0 && (
          <div
            className={`flex flex-1 items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors
              ${
                isDragOver
                  ? 'border-indigo-400 bg-indigo-50/50 text-indigo-700 dark:border-white/30 dark:bg-white/5 dark:text-white'
                  : 'border-slate-300 text-slate-400 dark:border-[#1c1c1c] dark:text-neutral-600'
              }
            `}
          >
            <p className="text-xs font-medium">
              {isDragOver ? 'Release to drop here' : `No tasks in ${title}`}
            </p>
          </div>
        )}

        {/* Drag over indicator at the bottom if column is not empty */}
        {isDragOver && tasks.length > 0 && (
          <div className="h-10 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/40 text-indigo-600 dark:border-white/20 dark:bg-white/5 flex items-center justify-center text-xs dark:text-neutral-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
