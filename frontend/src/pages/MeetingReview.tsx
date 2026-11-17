import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { 
  CheckCheck, 
  LoaderCircle, 
  Lock, 
  Plus, 
  Search, 
  ShieldCheck, 
  SlidersHorizontal, 
  Sparkles, 
  Trash2, 
  X 
} from 'lucide-react';
import type { 
  ActionItemCandidate, 
  ActionItemStatus, 
  ManualTask, 
  MeetingDetails, 
  WorkspaceMember 
} from '../types/review';
import { reviewApi } from '../services/reviewApi';
import { ActionItemReviewCard } from '../components/review/ActionItemReviewCard';
import { Button } from '../components/ui/button';

export interface MeetingReviewProps {
  meetingId?: string;
  workspaceId?: string;
  onChanged?: () => Promise<void>;
  onOpenSource?: (itemId: string) => void;
  onNavigateBack?: () => void;
  onNavigateToKanban?: () => void;
}

export function MeetingReview({
  meetingId: propMeetingId,
  workspaceId: propWorkspaceId,
  onChanged,
  onOpenSource,
}: MeetingReviewProps) {
  const { id: routeMeetingId } = useParams<{ id: string }>();
  const meetingId = propMeetingId || routeMeetingId || 'mtg-sprint-102';
  const workspaceId = propWorkspaceId || 'ws-team-10';

  const [meeting, setMeeting] = useState<MeetingDetails | null>(null);
  const [candidates, setCandidates] = useState<ActionItemCandidate[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<ActionItemStatus>('pending');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [feedback, setFeedback] = useState('');
  const [tools, setTools] = useState<'filters' | 'refine' | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  // Manual Task Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssigneeId, setTaskAssigneeId] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const isNoAiMode = meeting?.ai_processing === false;

  const loadReview = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const people = await reviewApi.fetchWorkspaceMembers(workspaceId).catch(() => []);
      const [items, details, tasks] = await Promise.all([
        reviewApi.fetchActionItemCandidates(meetingId, people).catch(() => []),
        reviewApi.fetchMeetingDetails(meetingId).catch(() => null),
        reviewApi.fetchMeetingTasks(meetingId).catch(() => []),
      ]);
      setMembers(people);
      setCandidates(items);
      setMeeting(details);
      setManualTasks(tasks);
      if (people.length > 0 && !taskAssigneeId) {
        setTaskAssigneeId(people[0].user_id || people[0].id);
      }
    } catch {
      setLoadError('Could not load suggested actions.');
    } finally {
      setLoading(false);
    }
  }, [meetingId, workspaceId, taskAssigneeId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const act = async (key: string, action: () => Promise<string>) => {
    if (operation) return;
    setOperation(key);
    setMessage(undefined);
    try {
      setMessage({ text: await action() });
      if (onChanged) void onChanged();
    } catch (error) {
      setMessage({ text: (error as Error).message || 'Could not finish that action.', error: true });
    } finally {
      setOperation(null);
    }
  };

  const approve = (items: ActionItemCandidate[]) =>
    act(items.length === 1 ? items[0].id : 'batch', async () => {
      const approved = await reviewApi.approveActionItems(meetingId, items);
      const byId = new Map(approved.map((item) => [item.id, item]));
      setCandidates((current) => current.map((item) => byId.get(item.id) ?? item));
      return approved.length === 1 ? 'Action approved.' : `${approved.length} actions approved.`;
    });

  const reject = (item: ActionItemCandidate) =>
    act(item.id, async () => {
      const rejected = await reviewApi.rejectActionItem(meetingId, item);
      setCandidates((current) => current.map((candidate) => (candidate.id === item.id ? rejected : candidate)));
      return 'Action rejected.';
    });

  const update = async (item: ActionItemCandidate, changes: Partial<ActionItemCandidate>) => {
    try {
      const updated = await reviewApi.updateActionItem(item.id, changes);
      setCandidates((current) => current.map((candidate) => (candidate.id === item.id ? updated : candidate)));
    } catch {
      setMessage({ text: 'Could not update this action.', error: true });
    }
  };

  const refine = (event: FormEvent) => {
    event.preventDefault();
    if (feedback.trim().length < 2) return;
    void act('refine', async () => {
      await reviewApi.refineActionItems(meetingId, feedback.trim());
      setCandidates(await reviewApi.fetchActionItemCandidates(meetingId, members));
      setFeedback('');
      return 'Pending suggestions updated.';
    });
  };

  const handleCreateManualTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setIsAssigning(true);
    try {
      const created = await reviewApi.createManualTask(meetingId, workspaceId, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        assignee_user_id: taskAssigneeId || undefined,
        priority: taskPriority,
        deadline_utc: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
        source_excerpt: 'Manual task assignment (No-AI mode)',
      });
      setManualTasks((prev) => [created, ...prev]);
      setTaskTitle('');
      setTaskDescription('');
      setTaskDueDate('');
      setShowAssignModal(false);
      setMessage({ text: 'Task successfully assigned to participant.' });
      if (onChanged) void onChanged();
    } catch (err) {
      setMessage({ text: (err as Error).message || 'Failed to assign task.', error: true });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteManualTask = async (taskId: string) => {
    try {
      await reviewApi.deleteManualTask(meetingId, taskId);
      setManualTasks((prev) => prev.filter((t) => t.id !== taskId));
      setMessage({ text: 'Task deleted successfully.' });
      if (onChanged) void onChanged();
    } catch (err) {
      setMessage({ text: (err as Error).message || 'Failed to delete task.', error: true });
    }
  };

  const pending = candidates.filter((item) => item.status === 'pending');
  const approvable = pending.filter((item) => item.assignee_id && !item.blocked_by_id);
  const visible = candidates.filter((item) => {
    if (status !== item.status) return false;
    if (assignee && (assignee === 'unassigned' ? item.assignee_id : item.assignee_id !== assignee)) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return item.title.toLowerCase().includes(term) || item.description.toLowerCase().includes(term);
  });

  const views = [
    { id: 'pending' as const, label: 'Pending review', count: pending.length },
    { id: 'approved' as const, label: 'Approved', count: candidates.filter((item) => item.status === 'approved').length },
    { id: 'rejected' as const, label: 'Rejected', count: candidates.filter((item) => item.status === 'rejected').length },
  ];
  const hasFilters = Boolean(search.trim() || assignee);

  if (loading) {
    return (
      <p role="status" className="flex items-center gap-2 py-6 text-sm text-neutral-400">
        <LoaderCircle className="size-4 animate-spin" /> Loading meeting tasks and review…
      </p>
    );
  }

  if (loadError) {
    return (
      <div role="alert" className="flex items-center gap-3 py-4 text-sm text-rose-300">
        {loadError}
        <Button size="sm" variant="outline" onClick={loadReview}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <section aria-labelledby="meeting-review-heading" className="max-w-5xl space-y-5">
      {/* Privacy Banner for No-AI Mode */}
      {isNoAiMode && (
        <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-5 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white">Private Meeting — No-AI Mode</h3>
                <span className="inline-flex items-center gap-1 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                  <Lock size={10} /> Confidential
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-300">
                AI extraction and processing are strictly disabled for this meeting. Transcripts remain confidential on premise and are never sent to external AI providers. Managers manually create and assign tasks below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header with Assign Task Button */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="meeting-review-heading" className="text-lg font-semibold text-white">
            {isNoAiMode ? 'Manual Task Assignments' : 'Action Item Review'}
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400">
            {isNoAiMode
              ? 'Delegate responsibilities and assign tasks to workspace members.'
              : 'Verify AI-detected action items before publishing them to the workspace task board.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowAssignModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
            <Plus className="size-4" /> Assign task
          </Button>
          {!isNoAiMode && approvable.length > 1 && (
            <Button size="sm" variant="outline" disabled={Boolean(operation)} onClick={() => approve(approvable)}>
              <CheckCheck /> Approve {approvable.length} {hasFilters ? 'shown' : approvable.length < visible.length ? 'assigned' : 'actions'}
            </Button>
          )}
        </div>
      </header>

      {/* Status Messages */}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>
          {message.text}
        </p>
      )}

      {/* Manual Tasks Section */}
      {manualTasks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Manually Assigned Tasks ({manualTasks.length})
          </h3>
          <ul className="space-y-2">
            {manualTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4 transition-colors hover:bg-white/[0.04]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{task.title}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        task.priority === 'urgent'
                          ? 'bg-rose-500/20 text-rose-300'
                          : task.priority === 'high'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && <p className="text-xs text-neutral-400">{task.description}</p>}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
                    <span>Assignee: <strong className="text-neutral-200">{task.assignee?.full_name || 'Assigned member'}</strong></span>
                    {task.deadline_utc && <span>Due: {new Date(task.deadline_utc).toLocaleDateString()}</span>}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteManualTask(task.id)}
                  className="text-neutral-400 hover:text-rose-400"
                  aria-label={`Delete task ${task.title}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Suggestions Review (only when AI is enabled) */}
      {!isNoAiMode && candidates.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Review status">
              {views.map((view) => (
                <Button
                  key={view.id}
                  type="button"
                  size="sm"
                  variant={status === view.id ? 'secondary' : 'ghost'}
                  aria-pressed={status === view.id}
                  onClick={() => setStatus(view.id)}
                >
                  {view.label} <span className="tabular-nums text-neutral-400">{view.count}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-expanded={tools === 'filters'}
                onClick={() => setTools(tools === 'filters' ? null : 'filters')}
              >
                <SlidersHorizontal /> Filters{hasFilters ? ' (active)' : ''}
              </Button>
              {status === 'pending' && pending.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-expanded={tools === 'refine'}
                  onClick={() => setTools(tools === 'refine' ? null : 'refine')}
                >
                  <Sparkles /> Refine with AI
                </Button>
              )}
            </div>
          </div>

          {tools === 'filters' && (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  type="search"
                  aria-label="Search suggested actions"
                  placeholder="Search actions"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="field h-9 pl-8 text-sm"
                />
              </label>
              <select
                aria-label="Filter by owner"
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                className="field h-9 text-sm"
              >
                <option value="">All owners</option>
                <option value="unassigned">Unassigned</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {tools === 'refine' && status === 'pending' && pending.length > 0 && (
            <form onSubmit={refine} className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <input
                aria-label="Changes to pending actions"
                placeholder="Describe what should change"
                maxLength={1500}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                disabled={Boolean(operation)}
                className="field h-8 min-w-44 flex-1 text-sm"
              />
              <Button size="sm" type="submit" disabled={Boolean(operation) || feedback.trim().length < 2}>
                {operation === 'refine' ? 'Refining…' : 'Refine suggestions'}
              </Button>
            </form>
          )}

          {visible.length ? (
            <ul className="space-y-3">
              {visible.map((item) => (
                <li key={item.id}>
                  <ActionItemReviewCard
                    item={item}
                    members={members}
                    disabled={Boolean(operation)}
                    busy={operation === item.id || (operation === 'batch' && approvable.includes(item))}
                    onApprove={() => approve([item])}
                    onReject={() => reject(item)}
                    onUpdate={(changes) => update(item, changes)}
                    onOpenSource={onOpenSource ? () => onOpenSource(item.id) : () => {}}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2 rounded-xl border border-dashed border-white/15 p-8 text-center">
              <p className="text-sm text-neutral-300">
                {hasFilters
                  ? 'No actions match these filters.'
                  : status === 'pending'
                  ? 'All suggestions have been reviewed.'
                  : `No ${status} actions.`}
              </p>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setAssignee(''); }}>
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State for No-AI mode when no manual tasks exist yet */}
      {isNoAiMode && manualTasks.length === 0 && (
        <div className="space-y-3 rounded-xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm text-neutral-300">No tasks assigned to workspace members yet.</p>
          <p className="text-xs text-neutral-500">
            Click "+ Assign task" to manually delegate tasks discussed in this private meeting.
          </p>
          <Button size="sm" onClick={() => setShowAssignModal(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white mt-2">
            <Plus className="size-4" /> Assign task
          </Button>
        </div>
      )}

      {/* Task Assignment Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#141417] p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Assign Task (Manager Mode)</h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-lg p-1 text-neutral-400 hover:text-white"
              >
                <X className="size-5" />
              </button>
            </div>
            <form onSubmit={handleCreateManualTask} className="mt-4 space-y-4">
              <div>
                <label className="field-label" htmlFor="manual-task-title">
                  Task Title *
                </label>
                <input
                  id="manual-task-title"
                  className="field w-full text-sm"
                  placeholder="e.g. Prepare executive compensation report"
                  required
                  maxLength={500}
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="manual-task-desc">
                  Description / Context
                </label>
                <textarea
                  id="manual-task-desc"
                  className="field w-full min-h-20 text-sm"
                  placeholder="Key deliverables, prerequisites, or meeting context..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="manual-task-assignee">
                    Assignee
                  </label>
                  <select
                    id="manual-task-assignee"
                    className="field w-full text-sm"
                    value={taskAssigneeId}
                    onChange={(e) => setTaskAssigneeId(e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {members.map((m) => (
                      <option key={m.user_id || m.id} value={m.user_id || m.id}>
                        {m.full_name} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="manual-task-priority">
                    Priority
                  </label>
                  <select
                    id="manual-task-priority"
                    className="field w-full text-sm"
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label" htmlFor="manual-task-due">
                  Deadline (Optional)
                </label>
                <input
                  id="manual-task-due"
                  type="date"
                  className="field w-full text-sm"
                  value={taskDueDate}
                  onChange={(e) => setTaskDueDate(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <Button type="button" variant="outline" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isAssigning || !taskTitle.trim()} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                  {isAssigning ? 'Assigning…' : 'Create & Assign Task'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

export default MeetingReview;
