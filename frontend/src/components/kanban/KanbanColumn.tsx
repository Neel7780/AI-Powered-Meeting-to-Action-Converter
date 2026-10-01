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
    accentColor: 'text-neutral-400',
    borderGlow: 'border-white/20 bg-neutral-900/30',
    headerBadge: 'bg-neutral-800 text-neutral-300 border-neutral-700',
  },
  in_progress: {
    icon: Clock,
    accentColor: 'text-amber-400',
    borderGlow: 'border-amber-500/40 bg-amber-500/5',
    headerBadge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  blocked: {
    icon: AlertCircle,
    accentColor: 'text-red-400',
    borderGlow: 'border-red-500/40 bg-red-500/5',
    headerBadge: 'bg-red-500/10 text-red-400 border-red-500/20',
  },
  done: {
    icon: CheckCircle2,
    accentColor: 'text-emerald-400',
    borderGlow: 'border-emerald-500/40 bg-emerald-500/5',
    headerBadge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
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
      className={`flex flex-col rounded-xl border bg-[#040404] p-3 transition-all duration-200 min-h-[500px] h-full
        ${isDragOver ? `${meta.borderGlow} ring-1 ring-white/10 shadow-lg` : 'border-[#181818]'}
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#181818]">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${meta.accentColor}`} />
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
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
                  ? 'border-white/30 bg-white/5 text-white'
                  : 'border-[#1c1c1c] text-neutral-600'
              }
            `}
          >
            <p className="text-xs">
              {isDragOver ? 'Release to drop here' : `No tasks in ${title}`}
            </p>
          </div>
        )}

        {/* Drag over indicator at the bottom if column is not empty */}
        {isDragOver && tasks.length > 0 && (
          <div className="h-10 rounded-lg border-2 border-dashed border-white/20 bg-white/5 flex items-center justify-center text-xs text-neutral-400">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
};

export default KanbanColumn;
