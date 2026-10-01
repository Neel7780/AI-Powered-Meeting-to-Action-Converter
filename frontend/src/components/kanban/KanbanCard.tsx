import React, { useState } from 'react';
import { AlertCircle, Quote, ChevronDown, CheckCircle2, Clock, Link as LinkIcon } from 'lucide-react';
import { WhatsAppShareButton } from './WhatsAppShareButton';

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskAssigneeProfile {
  id: string;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export interface TaskAssigneeItem {
  user_id: string;
  is_primary: boolean;
  profiles?: TaskAssigneeProfile | null;
}

export interface KanbanTaskItem {
  id: string;
  workspace_id: string;
  meeting_id: string;
  title: string;
  description?: string | null;
  deadline_utc?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  blocked_by?: string | null;
  source_excerpt: string;
  external_owner_label?: string | null;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  task_assignees?: TaskAssigneeItem[];
  meetings?: {
    id: string;
    title: string;
    meeting_date: string;
  } | null;
}

export interface KanbanCardProps {
  task: KanbanTaskItem;
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void> | void;
  onDragStart?: (taskId: string) => void;
  onDragEnd?: () => void;
  isUpdating?: boolean;
}

const priorityConfig: Record<
  TaskPriority,
  { label: string; badgeClass: string; dotClass: string }
> = {
  urgent: {
    label: 'Urgent',
    badgeClass: 'bg-red-500/15 text-red-400 border-red-500/30',
    dotClass: 'bg-red-500',
  },
  high: {
    label: 'High',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  normal: {
    label: 'Normal',
    badgeClass: 'bg-neutral-800 text-neutral-300 border-neutral-700',
    dotClass: 'bg-neutral-400',
  },
  low: {
    label: 'Low',
    badgeClass: 'bg-neutral-900 text-neutral-500 border-neutral-800',
    dotClass: 'bg-neutral-600',
  },
};

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  onStatusChange,
  onDragStart,
  onDragEnd,
  isUpdating = false,
}) => {
  const [showExcerpt, setShowExcerpt] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const priority = priorityConfig[task.priority] || priorityConfig.normal;

  // Find primary assignee or fallback to first assignee
  const primaryAssignee =
    task.task_assignees?.find((a) => a.is_primary)?.profiles ||
    task.task_assignees?.[0]?.profiles;

  const assigneeDisplayName =
    primaryAssignee?.display_name ||
    primaryAssignee?.email?.split('@')[0] ||
    task.external_owner_label ||
    'Unassigned';

  // Format deadline and check if overdue
  let isOverdue = false;
  let deadlineFormatted = '';

  if (task.deadline_utc) {
    try {
      const d = new Date(task.deadline_utc);
      const now = new Date();
      isOverdue = task.status !== 'done' && d < now;
      deadlineFormatted = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      deadlineFormatted = task.deadline_utc;
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    setIsDragging(true);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.setData('application/json', JSON.stringify({ taskId: task.id, status: task.status }));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart?.(task.id);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    onDragEnd?.();
  };

  const handleStatusSelect = async (newStatus: TaskStatus) => {
    setIsMenuOpen(false);
    if (newStatus !== task.status) {
      await onStatusChange(task.id, newStatus);
    }
  };

  return (
    <div
      draggable={!isUpdating}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative rounded-lg border bg-[#080808] p-4 text-white shadow-md transition-all duration-200 select-none
        ${isDragging ? 'opacity-40 scale-[0.98] border-white/40 ring-2 ring-white/20' : 'hover:border-white/25 hover:bg-[#0c0c0c] border-[#202020]'}
        ${isUpdating ? 'pointer-events-none opacity-60' : 'cursor-grab active:cursor-grabbing'}
      `}
    >
      {/* Top row: Priority & Status Selector & WhatsApp Share */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          {/* Priority Pill */}
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border ${priority.badgeClass}`}
          >
            <span className={`size-1.5 rounded-full ${priority.dotClass}`} />
            {priority.label}
          </span>

          {/* Blocked by indicator if applicable */}
          {task.blocked_by && (
            <span
              title="This task is blocked by another task"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-900/30 text-red-400 border border-red-800/40"
            >
              <AlertCircle className="size-3" />
              Blocked
            </span>
          )}
        </div>

        {/* WhatsApp 1-Tap Share Button */}
        <WhatsAppShareButton
          taskTitle={task.title}
          deadlineUtc={task.deadline_utc}
          priority={task.priority}
          status={task.status}
          assigneeName={assigneeDisplayName}
          meetingTitle={task.meetings?.title}
        />
      </div>

      {/* Task Title */}
      <h3 className="text-sm font-semibold tracking-tight text-white mb-1.5 line-clamp-2 group-hover:text-neutral-100">
        {task.title}
      </h3>

      {/* Optional Description */}
      {task.description && (
        <p className="text-xs text-neutral-400 line-clamp-2 mb-3 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Source Excerpt Quote Toggle */}
      {task.source_excerpt && (
        <div className="mb-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowExcerpt(!showExcerpt);
            }}
            className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors"
          >
            <Quote className="size-3 text-neutral-500" />
            <span>{showExcerpt ? 'Hide transcript quote' : 'View transcript quote'}</span>
          </button>

          {showExcerpt && (
            <div className="mt-1.5 rounded bg-black/60 p-2.5 border border-white/10 text-[11px] text-neutral-300 italic leading-snug">
              &ldquo;{task.source_excerpt}&rdquo;
              {task.meetings?.title && (
                <div className="mt-1 text-[10px] not-italic text-neutral-500 flex items-center gap-1">
                  <LinkIcon className="size-2.5" />
                  <span>From meeting: {task.meetings.title}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Card Footer: Assignee, Deadline & Status Dropdown */}
      <div className="pt-2 border-t border-[#1a1a1a] flex items-center justify-between gap-2 text-xs">
        {/* Assignee Badge */}
        <div
          className="flex items-center gap-1.5 min-w-0"
          title={`Assigned to: ${assigneeDisplayName}`}
        >
          {primaryAssignee?.avatar_url ? (
            <img
              src={primaryAssignee.avatar_url}
              alt={assigneeDisplayName}
              className="size-5 rounded-full object-cover ring-1 ring-white/20 shrink-0"
            />
          ) : (
            <div className="size-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] text-neutral-300 shrink-0 font-medium">
              {assigneeDisplayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-neutral-300 text-[11px]">
            {assigneeDisplayName}
          </span>
        </div>

        {/* Right side: Deadline indicator & Status Selector */}
        <div className="flex items-center gap-2 shrink-0">
          {deadlineFormatted && (
            <div
              className={`inline-flex items-center gap-1 text-[11px] ${
                isOverdue
                  ? 'text-red-400 font-medium'
                  : 'text-neutral-400'
              }`}
              title={isOverdue ? 'Task is overdue!' : `Due: ${deadlineFormatted}`}
            >
              <Clock className="size-3" />
              <span>{deadlineFormatted}</span>
            </div>
          )}

          {/* Quick Status Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen(!isMenuOpen);
              }}
              title="Change task status"
              aria-label="Change status"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 transition-colors"
            >
              <span>Move</span>
              <ChevronDown className="size-3 opacity-60" />
            </button>

            {isMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMenuOpen(false);
                  }}
                />
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 bottom-full mb-1 z-50 w-36 rounded-md border border-neutral-800 bg-[#121212] py-1 shadow-xl"
                >
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                    Move status
                  </div>
                  {statusOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => handleStatusSelect(opt.value)}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-xs text-left transition-colors
                        ${opt.value === task.status ? 'bg-white/10 text-white font-medium' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}
                      `}
                    >
                      <span>{opt.label}</span>
                      {opt.value === task.status && (
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanCard;
