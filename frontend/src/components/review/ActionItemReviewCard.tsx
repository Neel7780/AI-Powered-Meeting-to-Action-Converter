import React, { useState } from 'react';
import {
  Check,
  X,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  Edit3,
  Sparkles,
  RotateCcw,
  Save,
  ExternalLink,
  Tag
} from 'lucide-react';
import type { ActionItemCandidate, WorkspaceMember } from '../../types/review';
import { Button } from '../ui/button';

interface ActionItemReviewCardProps {
  item: ActionItemCandidate;
  members: WorkspaceMember[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRevert?: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ActionItemCandidate>) => void;
  onJumpToTranscript?: (timestamp: string, segmentId?: string) => void;
  isSelected?: boolean;
}

export const ActionItemReviewCard: React.FC<ActionItemReviewCardProps> = ({
  item,
  members,
  onApprove,
  onReject,
  onRevert,
  onUpdate,
  onJumpToTranscript,
  isSelected = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editDescription, setEditDescription] = useState(item.description);
  const [editDueDate, setEditDueDate] = useState(item.due_date || '');
  const [assigneeError, setAssigneeError] = useState(false);

  React.useEffect(() => {
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditDueDate(item.due_date || '');
  }, [item.title, item.description, item.due_date]);

  const isUnassigned = !item.assignee_id;

  const handleSaveInlineEdit = () => {
    if (!editTitle.trim()) return;
    onUpdate(item.id, {
      title: editTitle.trim(),
      description: editDescription.trim(),
      due_date: editDueDate || null
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditDueDate(item.due_date || '');
    setIsEditing(false);
  };

  const handleOwnerChange = (memberId: string) => {
    setAssigneeError(false);
    onUpdate(item.id, {
      assignee_id: memberId === 'unassigned' || !memberId ? null : memberId
    });
  };

  const handleApproveClick = () => {
    if (isUnassigned) {
      setAssigneeError(true);
      return;
    }
    onApprove(item.id);
  };

  const confidencePercent = Math.round(item.confidence_score * 100);

  const cardState =
    item.status === 'approved'
      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
      : item.status === 'rejected'
      ? 'border-white/10 bg-transparent opacity-60'
      : isSelected
      ? 'border-white/30 bg-white/[0.04] ring-1 ring-white/15'
      : 'border-white/10 bg-[#08080c] hover:border-white/20';

  return (
    <div className={`rounded-lg border p-4 transition-all duration-200 ${cardState}`}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-neutral-300"
            title={`AI extraction confidence: ${confidencePercent}%`}
          >
            <Sparkles className="size-3 text-white" />
            {confidencePercent}% AI confidence
          </span>

          <button
            type="button"
            onClick={() => onJumpToTranscript?.(item.transcript_timestamp, item.transcript_segment_id)}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-black px-2 py-0.5 font-mono text-[11px] text-neutral-400 transition-colors hover:border-white/25 hover:text-white"
            title="Click to locate this exact segment in the transcript"
          >
            <Clock className="size-3" />
            <span>Transcript @ {item.transcript_timestamp}</span>
            <ExternalLink className="ml-0.5 size-2.5 opacity-60" />
          </button>

          {item.status === 'approved' && (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
              <Check className="size-3" />
              Approved
            </span>
          )}
          {item.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-neutral-400">
              <X className="size-3" />
              Rejected
            </span>
          )}
        </div>

        {item.status === 'pending' && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/10 hover:text-white"
            title="Inline edit action item title, description or date"
            aria-label="Edit action item"
          >
            <Edit3 className="size-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="my-2 space-y-3 rounded-md border border-white/10 bg-black p-3">
          <div>
            <label htmlFor={`title-${item.id}`} className="field-label text-[11px]">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              id={`title-${item.id}`}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Action item title..."
              className="field py-1.5 text-xs font-medium"
            />
          </div>

          <div>
            <label htmlFor={`description-${item.id}`} className="field-label text-[11px]">
              Description & context
            </label>
            <textarea
              id={`description-${item.id}`}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              placeholder="Detailed description..."
              className="field py-1.5 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label htmlFor={`due-${item.id}`} className="field-label text-[11px]">
                Due date
              </label>
              <input
                id={`due-${item.id}`}
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="field py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={handleCancelEdit}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSaveInlineEdit} disabled={!editTitle.trim()}>
              <Save />
              Save changes
            </Button>
          </div>
        </div>
      ) : (
        <div className="my-1 space-y-1.5">
          <h4
            onClick={() => item.status === 'pending' && setIsEditing(true)}
            className={`text-sm font-medium leading-snug text-white ${
              item.status === 'pending' ? 'cursor-pointer hover:text-neutral-300' : ''
            }`}
            title={item.status === 'pending' ? 'Click to inline edit title' : undefined}
          >
            {item.title}
          </h4>

          {item.description && (
            <p className="text-xs leading-relaxed text-neutral-400">
              {item.description}
            </p>
          )}

          {item.suggested_tags && item.suggested_tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {item.suggested_tags.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`owner-${item.id}`} className="flex items-center gap-1 text-xs text-neutral-500">
            <User className="size-3.5" />
            <span>Owner:</span>
          </label>

          <select
            id={`owner-${item.id}`}
            value={item.assignee_id || 'unassigned'}
            disabled={item.status !== 'pending'}
            onChange={(e) => handleOwnerChange(e.target.value)}
            className={`field h-7 w-auto cursor-pointer py-0 pl-2 text-xs font-medium ${
              isUnassigned ? 'border-amber-500/40 text-amber-300' : ''
            }`}
          >
            <option value="unassigned">-- Unassigned --</option>
            {item.assignee_id && !members.some(m => (m.user_id || m.id) === item.assignee_id) && (
              <option value={item.assignee_id}>
                {item.assignee?.full_name || 'Assigned Member'}
              </option>
            )}
            {members.map(m => {
              const val = m.user_id || m.id;
              return (
                <option key={val} value={val}>
                  {m.full_name} ({m.role.replace('_', ' ')})
                </option>
              );
            })}
          </select>

          {isUnassigned && (
            <span
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${
                assigneeError
                  ? 'animate-bounce border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-amber-500/25 bg-amber-500/10 text-amber-400'
              }`}
              title="This candidate item cannot be approved without assigning an owner"
            >
              <AlertTriangle className="size-3" />
              Assignee required
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Calendar className="size-3.5 text-neutral-500" />
          {item.status === 'pending' ? (
            <input
              type="date"
              aria-label="Due date"
              value={item.due_date || ''}
              onChange={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
              className="field h-7 w-auto cursor-pointer px-2 py-0 text-xs"
              title="Change due date"
            />
          ) : (
            <span className="font-medium text-neutral-300">
              {item.due_date ? new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
        <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {item.status === 'pending' ? 'Awaiting review' : `Status: ${item.status}`}
        </div>

        <div className="flex items-center gap-2">
          {item.status === 'pending' ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => onReject(item.id)}
                title="Reject and dismiss this candidate action item"
              >
                <X />
                Reject
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleApproveClick}
                className={isUnassigned ? 'opacity-60' : ''}
                title={isUnassigned ? 'Please select an assignee first' : 'Approve and publish to the task board'}
              >
                <Check />
                Approve
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRevert?.(item.id)}
              title="Revert back to pending staging review"
            >
              <RotateCcw />
              Undo status
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
