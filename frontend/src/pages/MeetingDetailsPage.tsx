import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ListChecks, Lock, Video } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMeetingResource } from '../hooks/useMeetingResource';
import { supabase } from '../lib/supabase';
import { canOrganise } from '../lib/workspaceRoles';
import { loadMeeting, meetingDate } from '../services/meetingNavigation';
import type { MeetingSummaryData } from '../types/meetingDetails';
import { MeetingOverview } from '../components/meetings/MeetingOverview';
import { MeetingChapters, MeetingPreparation, MeetingSummary, MeetingTranscript } from '../components/meetings/MeetingContent';
import { MeetingTasks } from '../components/meetings/MeetingTasks';
import { FollowUpModal } from '../components/meetings/FollowUpModal';
import { Button } from '../components/ui/button';
import MeetingReview from './MeetingReview';
import SpeakerMapping from './SpeakerMapping';

const tabs = [
  ['overview', 'Overview'], ['chapters', 'Chapters'], ['transcript', 'Transcript'],
  ['tasks', 'Tasks'], ['review', 'Review'], ['speakers', 'Speakers'], ['follow-up', 'Follow-up'],
] as const;
type Tab = typeof tabs[number][0];
type MeetingData = Awaited<ReturnType<typeof loadMeeting>>;

function MeetingWorkspace({ data, reload }: { data: MeetingData; reload: () => Promise<void> }) {
  const { meeting, tasks, role } = data;
  const canManage = canOrganise(role);
  const canReview = canManage && meeting.ai_processing;
  const processing = meeting.status === 'processing';
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useLocation();
  const returnTo = typeof state?.meetingsReturnTo === 'string' && state.meetingsReturnTo.startsWith('/meetings?')
    ? state.meetingsReturnTo : '/meetings';
  const [initialTab] = useState<Tab>(role === 'organiser' && meeting.pending && meeting.ai_processing && !meeting.needsSpeakers ? 'review' : 'overview');
  const [followUp, setFollowUp] = useState(false);
  const [loadSummary, setLoadSummary] = useState(false);
  const desiredTab = searchParams.get('tab') || initialTab;
  const availableTabs = tabs.filter(([id]) => {
    if (id === 'review' || id === 'follow-up') return canReview;
    if (id === 'speakers') {
      const resumingAudio = desiredTab === 'speakers' && !meeting.transcripts
        && ['processing', 'failed'].includes(meeting.status);
      return canManage && (meeting.transcripts?.source === 'audio' || resumingAudio);
    }
    return true;
  });
  const tab = availableTabs.find(([id]) => id === desiredTab)?.[0] || 'overview';
  const [reviewOpened, setReviewOpened] = useState(tab === 'review');
  if (tab === 'review' && !reviewOpened) setReviewOpened(true);
  const sourceSuggestion = meeting.extracted_items.find((item) => item.id === searchParams.get('suggestion') && item.type === 'action');
  const setTab = (next: Tab) => setSearchParams({ tab: next }, { state });
  const showQuote = (timestamp: string) => setSearchParams({ tab: 'transcript', at: timestamp }, { state });
  const transcriptId = meeting.transcripts?.id;
  const canLoadSummary = !!transcriptId && !processing && !meeting.needsSpeakers;
  const summary = useMeetingResource<MeetingSummaryData>(
    `/api/meetings/${meeting.id}/summary`, canLoadSummary && (tab === 'overview' || loadSummary), transcriptId,
  );
  const waitingForSummary = canLoadSummary && !summary.data && !summary.error;
  useEffect(() => {
    if (tab === 'overview' && transcriptId) setLoadSummary(true);
  }, [tab, transcriptId]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-4 sm:p-8">
      <header className="space-y-3">
        <Link to={returnTo} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white"><ArrowLeft size={16} /> Meetings</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">{meeting.title}</h1>
            <p className="mt-1 text-sm text-neutral-400">{meetingDate(meeting)} · {meeting.source && `${meeting.source} · `}{meeting.organiser}</p>
          </div>
          <div className="flex items-center gap-3">
            {!meeting.ai_processing && <span className="inline-flex items-center gap-1 text-xs text-neutral-400"><Lock size={13} /> No AI</span>}
            {meeting.conference_url && /^https?:\/\//i.test(meeting.conference_url) && <Button size="sm" variant="outline" asChild>
              <a href={meeting.conference_url} target="_blank" rel="noreferrer"><Video /> Join call</a>
            </Button>}
          </div>
        </div>
      </header>

      <nav aria-label="Meeting sections" className="flex flex-wrap gap-1 border-b border-white/10 pb-3">
        {availableTabs.map(([id, label]) => <Button key={id} asChild size="sm" variant={tab === id ? 'secondary' : 'ghost'}>
          <Link to={`?tab=${id}`} state={state} aria-current={tab === id ? 'page' : undefined}>
            {label}
            {id === 'review' && meeting.pending > 0 && <span className="rounded-full bg-indigo-500/20 px-1.5 text-indigo-200">{meeting.pending}</span>}
            {id === 'speakers' && meeting.needsSpeakers && <span className="size-1.5 rounded-full bg-amber-400" aria-label="Mapping needed" />}
          </Link>
        </Button>)}
      </nav>

      {processing && (tab === 'overview' || tab === 'chapters' || tab === 'review') && (
        <MeetingPreparation
          title="Preparing your meeting"
          description={transcriptId
            ? 'Your transcript is saved. We’re identifying decisions and suggested actions.'
            : 'We’re turning your recording into a transcript.'}
        />
      )}
      {tab === 'overview' && !processing && (
        <div className="space-y-5">
          {canReview && meeting.pending > 0 && (
            <section className="dashboard-surface flex flex-wrap items-center justify-between gap-4 rounded-xl border border-indigo-500/25 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-300"><ListChecks className="size-5" /></span>
                <div>
                  <h2 className="text-sm font-semibold text-white">Suggested actions</h2>
                  <p className="mt-1 text-sm text-neutral-400">{meeting.pending} {meeting.pending === 1 ? 'action needs' : 'actions need'} your review.</p>
                </div>
              </div>
              <Button onClick={() => setTab('review')}>Review {meeting.pending} {meeting.pending === 1 ? 'action' : 'actions'} <ArrowRight /></Button>
            </section>
          )}
          {meeting.status === 'failed' && transcriptId && canReview && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 p-4 text-sm text-neutral-300">
              Action extraction could not finish.
              <Button variant="outline" size="sm" onClick={() => setTab('transcript')}>Open transcript to retry</Button>
            </div>
          )}
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {waitingForSummary
              ? <MeetingPreparation title="Preparing the summary" description="Organizing the discussion, decisions and open questions." />
              : <MeetingSummary summary={summary.data} error={summary.error} meeting={meeting} onTimestamp={showQuote} onRetry={summary.retry} />}
            <MeetingOverview participants={meeting.participants} tasks={tasks} pending={meeting.pending} onShowTasks={() => setTab('tasks')} />
          </div>
        </div>
      )}
      {tab === 'chapters' && !processing && (transcriptId
        ? <MeetingChapters meetingId={meeting.id} transcriptId={transcriptId} onTimestamp={showQuote} />
        : <p className="text-sm text-neutral-400">No transcript available for chapters.</p>)}
      {tab === 'transcript' && <MeetingTranscript meeting={meeting} canManage={canManage}
        timestamp={searchParams.get('at')}
        excerpt={sourceSuggestion?.source_excerpt ?? tasks.find((task) => task.id === searchParams.get('task'))?.source_excerpt}
        onBackToReview={sourceSuggestion && availableTabs.some(([id]) => id === 'review') ? () => setTab('review') : undefined}
        onRefresh={reload} onTab={setTab} />}
      {tab === 'tasks' && <MeetingTasks tasks={tasks} onRefresh={reload} />}
      {(tab === 'review' || reviewOpened) && canReview && !processing && (
        <div hidden={tab !== 'review'}>
          <MeetingReview meetingId={meeting.id} workspaceId={meeting.workspace_id} onChanged={reload}
            onOpenSource={(itemId) => setSearchParams({ tab: 'transcript', suggestion: itemId }, { state })} />
        </div>
      )}
      {tab === 'speakers' && <SpeakerMapping extractAfterSave={meeting.ai_processing && meeting.status !== 'ready'}
        onSaved={async (needsReview) => { await reload(); setTab(needsReview ? 'review' : 'transcript'); }} />}
      {tab === 'follow-up' && <Button onClick={() => setFollowUp(true)}>Draft follow-up</Button>}
      {followUp && <FollowUpModal isOpen onClose={() => setFollowUp(false)} meetingId={meeting.id} meetingTitle={meeting.title} />}
    </div>
  );
}

export default function MeetingDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  if (!id || !user) return null;
  return <MeetingDetails key={`${user.id}:${id}`} id={id} userId={user.id} />;
}

function MeetingDetails({ id, userId }: { id: string; userId: string }) {
  const [data, setData] = useState<MeetingData>();
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    try { setData(await loadMeeting(id, userId)); setError(''); }
    catch (err) { setError((err as Error).message || 'Could not load the meeting.'); }
  }, [id, userId]);

  useEffect(() => {
    void reload();
    const channel = supabase.channel(`meeting-details:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `id=eq.${id}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, reload]);

  const processing = data?.meeting.status === 'processing';
  useEffect(() => {
    if (!processing) return;
    const timer = window.setInterval(reload, 5000);
    return () => window.clearInterval(timer);
  }, [processing, reload]);

  if (error) return <div className="space-y-3 p-8"><p role="alert" className="text-sm text-rose-300">{error}</p><Button onClick={reload} variant="outline">Retry</Button> <Link to="/meetings" className="text-sm underline">Back to meetings</Link></div>;
  if (!data) return (
    <div className="mx-auto max-w-7xl p-4 sm:p-8">
      <MeetingPreparation title="Loading meeting" description="Getting your meeting details." />
    </div>
  );
  return <MeetingWorkspace data={data} reload={reload} />;
}
