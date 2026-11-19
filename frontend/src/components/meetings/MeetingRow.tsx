import { ArrowRight, Lock, LoaderCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { meetingDate, type MeetingListEntry } from '../../services/meetingNavigation';
import { Button } from '../ui/button';

function meetingAction(meeting: MeetingListEntry, canManage: boolean) {
  if (meeting.status === 'processing') return { label: 'Extracting…', tab: null };
  if (canManage) {
    if (meeting.needsSpeakers) return { label: 'Map speakers', tab: 'speakers' };
    if (meeting.status === 'failed') return { label: 'Retry', tab: 'transcript' };
    if (meeting.pending && meeting.ai_processing) {
      return { label: `Review ${meeting.pending} ${meeting.pending === 1 ? 'item' : 'items'}`, tab: 'review' };
    }
    if (meeting.status === 'draft') {
      if (!meeting.transcripts) return { label: 'Add transcript', tab: 'transcript' };
      if (meeting.ai_processing) return { label: 'Find action items', tab: 'transcript' };
    }
  }
  return { label: 'Open meeting', tab: 'overview' };
}

export function MeetingRow({ meeting, canManage, returnTo }: { meeting: MeetingListEntry; canManage: boolean; returnTo: string }) {
  const path = `/meetings/${meeting.id}`;
  const action = meetingAction(meeting, canManage);
  const state = { meetingsReturnTo: returnTo };
  const participants = meeting.participants.map((person) => person.name);
  return (
    <li className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link to={path} state={state} className="break-words font-medium text-white hover:underline">{meeting.title}</Link>
          {!meeting.ai_processing && <span className="inline-flex items-center gap-1 text-xs text-neutral-400"><Lock size={12} /> No AI</span>}
        </div>
        <p className="mt-1 text-xs text-neutral-400">{meetingDate(meeting)} · {meeting.source && `${meeting.source} · `}Organiser: {meeting.organiser}</p>
        <p className="mt-1 truncate text-xs text-neutral-400" title={participants.join(', ')}>{participants.length ? participants.join(', ') : 'No participants added'}</p>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-neutral-400 sm:justify-end">
        <span>{meeting.counts.open} open</span>
        <span className={meeting.counts.overdue ? 'text-rose-300' : undefined}>{meeting.counts.overdue} overdue</span>
        <span className={meeting.counts.blocked ? 'text-amber-300' : undefined}>{meeting.counts.blocked} blocked</span>
      </div>
      <div className="sm:w-36 sm:text-right">
        {action.tab ? (
          <Button asChild size="sm" variant={action.tab === 'overview' ? 'outline' : 'default'}>
            <Link to={`${path}?tab=${action.tab}`} state={state}>{action.label}<ArrowRight /></Link>
          </Button>
        ) : <span className="inline-flex items-center gap-2 text-xs text-neutral-400" role="status"><LoaderCircle className="size-3.5 animate-spin" />{action.label}</span>}
      </div>
    </li>
  );
}
