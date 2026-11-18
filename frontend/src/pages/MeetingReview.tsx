import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCheck, LoaderCircle, Search, SlidersHorizontal, Sparkles } from 'lucide-react';
import type { ActionItemCandidate, ActionItemStatus, WorkspaceMember } from '../types/review';
import { reviewApi } from '../services/reviewApi';
import { ActionItemReviewCard } from '../components/review/ActionItemReviewCard';
import { Button } from '../components/ui/button';

interface MeetingReviewProps {
  meetingId: string;
  workspaceId: string;
  onChanged: () => Promise<void>;
  onOpenSource: (itemId: string) => void;
}

export default function MeetingReview({ meetingId, workspaceId, onChanged, onOpenSource }: MeetingReviewProps) {
  const [candidates, setCandidates] = useState<ActionItemCandidate[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<ActionItemStatus>('pending');
  const [search, setSearch] = useState('');
  const [assignee, setAssignee] = useState('');
  const [feedback, setFeedback] = useState('');
  const [tools, setTools] = useState<'filters' | 'refine' | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  const loadReview = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const people = await reviewApi.fetchWorkspaceMembers(workspaceId);
      const items = await reviewApi.fetchActionItemCandidates(meetingId, people);
      setMembers(people);
      setCandidates(items);
    } catch {
      setLoadError('Could not load suggested actions.');
    } finally {
      setLoading(false);
    }
  }, [meetingId, workspaceId]);

  useEffect(() => { void loadReview(); }, [loadReview]);

  const pending = candidates.filter((item) => item.status === 'pending');
  const views: { id: ActionItemStatus; label: string; count: number }[] = [
    { id: 'pending', label: 'Pending', count: pending.length },
    { id: 'approved', label: 'Approved', count: candidates.filter((item) => item.status === 'approved').length },
    { id: 'rejected', label: 'Rejected', count: candidates.filter((item) => item.status === 'rejected').length },
  ];
  const query = search.trim().toLowerCase();
  const visible = candidates.filter((item) => {
    if (item.status !== status) return false;
    if (assignee === 'unassigned' ? item.assignee_id : assignee && item.assignee_id !== assignee) return false;
    return !query || [item.title, item.description, item.assignee?.full_name]
      .some((value) => value?.toLowerCase().includes(query));
  });
  const approvable = visible.filter((item) => item.status === 'pending' && item.assignee_id);
  const hasFilters = Boolean(query || assignee);

  const update = async (item: ActionItemCandidate, changes: Partial<ActionItemCandidate>) => {
    try {
      const draft = await reviewApi.editActionItem(item, changes, members);
      setCandidates((current) => current.map((candidate) => candidate.id === item.id
        ? { ...candidate, ...changes, ...(changes.assignee_id === undefined ? {} : { assignee: draft.assignee }) }
        : candidate));
    } catch {
      setMessage({ text: 'Could not update this action.', error: true });
    }
  };

  const act = async (key: string, action: () => Promise<string>) => {
    if (operation) return;
    setOperation(key);
    setMessage(undefined);
    try {
      setMessage({ text: await action() });
      void onChanged();
    } catch (error) {
      setMessage({ text: (error as Error).message || 'Could not finish that action.', error: true });
    } finally {
      setOperation(null);
    }
  };

  const approve = (items: ActionItemCandidate[]) => act(items.length === 1 ? items[0].id : 'batch', async () => {
    const approved = await reviewApi.approveActionItems(meetingId, items);
    const byId = new Map(approved.map((item) => [item.id, item]));
    setCandidates((current) => current.map((item) => byId.get(item.id) ?? item));
    return approved.length === 1 ? 'Action approved.' : `${approved.length} actions approved.`;
  });

  const reject = (item: ActionItemCandidate) => act(item.id, async () => {
    const rejected = await reviewApi.rejectActionItem(meetingId, item);
    setCandidates((current) => current.map((candidate) => candidate.id === item.id ? rejected : candidate));
    return 'Action rejected.';
  });

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

  if (loading) return <p role="status" className="flex items-center gap-2 py-6 text-sm text-neutral-400"><LoaderCircle className="size-4 animate-spin" /> Loading suggested actions…</p>;
  if (loadError) return <div role="alert" className="flex items-center gap-3 py-4 text-sm text-rose-300">
    {loadError}<Button size="sm" variant="outline" onClick={loadReview}>Retry</Button>
  </div>;

  return (
    <section aria-labelledby="suggested-actions" className="max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="suggested-actions" className="text-lg font-semibold text-white">Suggested actions</h2>
          {pending.length > 0 && <p className="mt-0.5 text-xs text-neutral-400">Check AI suggestions before approving.</p>}
        </div>
        {approvable.length > 1 && (
          <Button size="sm" variant="outline" disabled={Boolean(operation)} onClick={() => approve(approvable)}>
            <CheckCheck /> Approve {approvable.length} {hasFilters ? 'shown' : approvable.length < visible.length ? 'assigned' : 'actions'}
          </Button>
        )}
      </header>

      {candidates.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1" role="group" aria-label="Review status">
              {views.map((view) => (
                <Button key={view.id} type="button" size="sm" variant={status === view.id ? 'secondary' : 'ghost'}
                  aria-pressed={status === view.id} onClick={() => setStatus(view.id)}>
                  {view.label} <span className="tabular-nums text-neutral-400">{view.count}</span>
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="ghost" aria-expanded={tools === 'filters'}
                onClick={() => setTools(tools === 'filters' ? null : 'filters')}>
                <SlidersHorizontal /> Filters{hasFilters ? ' (active)' : ''}
              </Button>
              {status === 'pending' && pending.length > 0 && (
                <Button size="sm" variant="ghost" aria-expanded={tools === 'refine'}
                  onClick={() => setTools(tools === 'refine' ? null : 'refine')}>
                  <Sparkles /> Refine with AI
                </Button>
              )}
            </div>
          </div>
          {tools === 'filters' && (
            <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-2">
              <label className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
                <input type="search" aria-label="Search suggested actions" placeholder="Search actions"
                  value={search} onChange={(event) => setSearch(event.target.value)} className="field h-9 pl-8 text-sm" />
              </label>
              <select aria-label="Filter by owner" value={assignee} onChange={(event) => setAssignee(event.target.value)} className="field h-9 text-sm">
                <option value="">All owners</option><option value="unassigned">Unassigned</option>
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}
              </select>
            </div>
          )}
          {tools === 'refine' && status === 'pending' && pending.length > 0 && (
            <form onSubmit={refine} className="flex flex-wrap gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <input aria-label="Changes to pending actions" placeholder="Describe what should change"
                maxLength={1500} value={feedback} onChange={(event) => setFeedback(event.target.value)}
                disabled={Boolean(operation)} className="field h-8 min-w-44 flex-1 text-sm" />
              <Button size="sm" type="submit" disabled={Boolean(operation) || feedback.trim().length < 2}>
                {operation === 'refine' ? 'Refining…' : 'Refine suggestions'}
              </Button>
            </form>
          )}
        </div>
      )}

      {message && <p role={message.error ? 'alert' : 'status'} className={`text-sm ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}

      {visible.length ? (
        <ul className="space-y-3">
          {visible.map((item) => <li key={item.id}>
            <ActionItemReviewCard item={item} members={members} disabled={Boolean(operation)}
              busy={operation === item.id || operation === 'batch' && approvable.includes(item)}
              onApprove={() => approve([item])} onReject={() => reject(item)}
              onUpdate={(changes) => update(item, changes)} onOpenSource={() => onOpenSource(item.id)} />
          </li>)}
        </ul>
      ) : (
        <div className="space-y-2 rounded-xl border border-dashed border-white/15 p-8 text-center">
          <p className="text-sm text-neutral-300">
            {candidates.length === 0 ? 'No suggested actions yet.' : hasFilters ? 'No actions match these filters.'
              : status === 'pending' ? 'All suggestions have been reviewed.' : `No ${status} actions.`}
          </p>
          {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setAssignee(''); }}>Clear filters</Button>}
        </div>
      )}
    </section>
  );
}
