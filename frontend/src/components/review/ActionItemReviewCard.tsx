import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, ChevronDown, GitFork, LoaderCircle, Pencil, Quote, X } from 'lucide-react';
import type { ActionItemCandidate, WorkspaceMember } from '../../types/review';
import { Button } from '../ui/button';

interface ActionItemReviewCardProps {
  item: ActionItemCandidate;
  members: WorkspaceMember[];
  disabled: boolean;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUpdate: (changes: Partial<ActionItemCandidate>) => void;
  onOpenSource: () => void;
}

export function ActionItemReviewCard({
  item, members, disabled, busy, onApprove, onReject, onUpdate, onOpenSource,
}: ActionItemReviewCardProps) {
  const [editing, setEditing] = useState(false);
  const pending = item.status === 'pending';
  const source = item.source_excerpt;
  const description = item.description !== source ? item.description : '';
  const titleId = `review-title-${item.id}`;
  const missingOwner = pending && !item.assignee_id;

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const title = String(fields.get('title') || '').trim();
    if (!title) return;
    const note = String(fields.get('description') || '').trim();
    onUpdate({ title, description: note || source || '' });
    setEditing(false);
  };

  return (
    <article aria-labelledby={titleId} aria-busy={busy || undefined} className="dashboard-surface rounded-xl border border-white/10 bg-white/[0.025] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <h3 id={titleId} className="break-words text-sm font-semibold leading-6 text-white sm:text-base">{item.title}</h3>
          {description && <p className="whitespace-pre-wrap break-words text-sm text-neutral-400">{description}</p>}
          {item.blocked_by_id && <p className="flex items-center gap-1.5 text-xs text-amber-300"><GitFork className="size-3" /> Has a prerequisite</p>}
        </div>
        {pending && !editing && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => setEditing(true)} aria-label="Edit action">
            <Pencil /> <span className="hidden sm:inline">Edit</span>
          </Button>
        )}
      </div>

      {editing && (
        <form onSubmit={save} className="mt-3 space-y-3 rounded-lg border border-white/10 bg-black/40 p-3">
          <fieldset disabled={disabled} className="space-y-3">
            <label className="block space-y-1 text-xs text-neutral-300">
              <span>Title</span><input name="title" required defaultValue={item.title} className="field text-sm" />
            </label>
            <label className="block space-y-1 text-xs text-neutral-300">
              <span>Task description</span><textarea name="description" rows={2} defaultValue={description} className="field text-sm" />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" type="submit">Save changes</Button>
            </div>
          </fieldset>
        </form>
      )}

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        {pending ? (
          <fieldset disabled={disabled} className="flex min-w-0 flex-wrap items-end gap-3">
            <label className="flex min-w-0 flex-col gap-1 text-xs text-neutral-400">
              <span>Owner</span>
              <select value={item.assignee_id || ''} onChange={(event) => onUpdate({ assignee_id: event.target.value || null })}
                className={`field h-9 max-w-full py-0 text-sm sm:w-48 ${missingOwner ? 'border-amber-500/35 text-amber-200' : ''}`}>
                <option value="">Unassigned</option>
                {item.assignee_id && !members.some((member) => member.user_id === item.assignee_id) && (
                  <option value={item.assignee_id}>{item.assignee?.full_name || 'Assigned member'}</option>
                )}
                {members.map((member) => <option key={member.user_id} value={member.user_id}>{member.full_name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-400">
              <span>Due date</span>
              <input type="date" value={item.due_date || ''} onChange={(event) => onUpdate({ due_date: event.target.value || null })}
                className="field h-9 w-auto py-0 text-sm" />
            </label>
          </fieldset>
        ) : (
          <p className="text-xs text-neutral-400">
            {item.assignee?.full_name || (item.assignee_id ? 'Assigned member' : 'Unassigned')} · {item.due_date
              ? new Date(`${item.due_date}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'No due date'}
          </p>
        )}

        {pending && !editing && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {busy ? <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
              <LoaderCircle className="size-3.5 animate-spin" /> Saving…
            </span> : missingOwner && <span className="text-xs text-amber-300">Owner required</span>}
            <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onReject}>
              <X /> Reject
            </Button>
            <Button type="button" size="sm" disabled={disabled || missingOwner} onClick={onApprove}>
              <Check /> Approve
            </Button>
          </div>
        )}
      </div>

      {source && (
        <details className="group mt-3">
          <summary className="inline-flex min-h-7 cursor-pointer list-none items-center gap-1.5 rounded-md border border-white/10 px-2 text-xs text-neutral-400 hover:border-white/25 hover:text-white [&::-webkit-details-marker]:hidden">
            <Quote className="size-3" /> Source quote <ChevronDown className="size-3 group-open:rotate-180" />
          </summary>
          <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/40 p-3">
            <blockquote className="whitespace-pre-wrap break-words border-l-2 border-indigo-500/40 pl-3 text-sm text-neutral-300">{source}</blockquote>
            <button type="button" onClick={onOpenSource} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-300 hover:underline">
              Open in transcript <ArrowUpRight className="size-3" />
            </button>
          </div>
        </details>
      )}
    </article>
  );
}
