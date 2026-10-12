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
import { ActionItemCandidate, WorkspaceMember } from '../../types/review';

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

  const assignedMember = members.find(m => m.id === item.assignee_id) || item.assignee;
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
      assignee_id: memberId === 'unassigned' ? null : memberId
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

  const cardBorder = 
    item.status === 'approved' 
      ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-200'
      : item.status === 'rejected'
      ? 'border-slate-300 bg-slate-50/60 opacity-80'
      : isSelected
      ? 'border-indigo-400 bg-indigo-50/20 ring-2 ring-indigo-200 shadow-md'
      : 'border-slate-200 hover:border-slate-300 bg-white shadow-xs';

  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 ${cardBorder}`}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span 
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
              confidencePercent >= 90 
                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
            title={`AI extraction confidence: ${confidencePercent}%`}
          >
            <Sparkles className="w-3 h-3 text-purple-600" />
            {confidencePercent}% AI Confidence
          </span>

          <button
            onClick={() => onJumpToTranscript?.(item.transcript_timestamp, item.transcript_segment_id)}
            className="inline-flex items-center gap-1 text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Click to locate this exact segment in the transcript"
          >
            <Clock className="w-3 h-3 text-slate-500" />
            <span>Transcript @ {item.transcript_timestamp}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </button>

          {item.status === 'approved' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
              <Check className="w-3 h-3" />
              Approved
            </span>
          )}
          {item.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
              <X className="w-3 h-3" />
              Rejected
            </span>
          )}
        </div>

        {item.status === 'pending' && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition"
            title="Inline edit action item title, description or date"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3 my-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Action item title..."
              className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
              Description & Context
            </label>
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              placeholder="Detailed description..."
              className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Due Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-700"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
            <button
              onClick={handleCancelEdit}
              className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200/70 rounded font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveInlineEdit}
              disabled={!editTitle.trim()}
              className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium transition flex items-center gap-1 shadow-xs disabled:opacity-50"
            >
              <Save className="w-3 h-3" />
              Save Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 my-1">
          <h4 
            onClick={() => item.status === 'pending' && setIsEditing(true)}
            className={`text-sm font-semibold text-slate-900 leading-snug cursor-pointer ${
              item.status === 'pending' ? 'hover:text-indigo-600' : ''
            }`}
            title={item.status === 'pending' ? 'Click to inline edit title' : undefined}
          >
            {item.title}
          </h4>

          {item.description && (
            <p className="text-xs text-slate-600 leading-relaxed">
              {item.description}
            </p>
          )}

          {item.suggested_tags && item.suggested_tags.length > 0 && (
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              {item.suggested_tags.map(tag => (
                <span 
                  key={tag}
                  className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                >
                  <Tag className="w-2.5 h-2.5 opacity-60" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Owner:</span>
          </label>

          <div className="relative">
            <select
              value={item.assignee_id || 'unassigned'}
              disabled={item.status !== 'pending'}
              onChange={(e) => handleOwnerChange(e.target.value)}
              className={`text-xs pl-2 pr-7 py-1 rounded-lg border font-medium transition appearance-none cursor-pointer focus:outline-none focus:ring-2 ${
                isUnassigned
                  ? 'border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-400/30'
                  : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 focus:ring-indigo-500/20'
              } ${item.status !== 'pending' ? 'opacity-70 cursor-not-allowed bg-slate-50' : ''}`}
            >
              <option value="unassigned">-- Unassigned --</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>
                  {m.full_name} ({m.role.replace('_', ' ')})
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-slate-400 text-xs">
              ▼
            </div>
          </div>

          {isUnassigned && (
            <span 
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                assigneeError
                  ? 'bg-rose-100 text-rose-800 border-rose-300 animate-bounce'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}
              title="This candidate item cannot be approved without assigning an owner"
            >
              <AlertTriangle className="w-3 h-3 text-amber-600" />
              Assignee Required
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {item.status === 'pending' ? (
            <input
              type="date"
              value={item.due_date || ''}
              onChange={(e) => onUpdate(item.id, { due_date: e.target.value || null })}
              className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
              title="Change due date"
            />
          ) : (
            <span className="font-medium text-slate-700">
              {item.due_date ? new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-100/90 flex items-center justify-between">
        <div className="text-[11px] text-slate-400">
          {item.status === 'pending' ? 'Review & staging action' : `Status: ${item.status}`}
        </div>

        <div className="flex items-center gap-2">
          {item.status === 'pending' ? (
            <>
              <button
                onClick={() => onReject(item.id)}
                className="px-2.5 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border border-rose-200 rounded-lg transition flex items-center gap-1 shadow-xs"
                title="Reject and dismiss this candidate action item"
              >
                <X className="w-3.5 h-3.5 text-rose-600" />
                <span>Reject</span>
              </button>

              <button
                onClick={handleApproveClick}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 shadow-xs ${
                  isUnassigned 
                    ? 'bg-emerald-600/70 hover:bg-emerald-600 text-white' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
                title={isUnassigned ? 'Please select an assignee first' : 'Approve and publish to Kanban board'}
              >
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Approve</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onRevert?.(item.id)}
              className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1"
              title="Revert back to pending staging review"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Undo Status</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
