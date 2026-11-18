import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Lock, Video } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { requestApi } from '../lib/api';
import { supabase } from '../lib/supabase';
import { canOrganise, loadMeeting, meetingDate } from '../services/meetingNavigation';
import type { MeetingSummaryData } from '../types/meetingDetails';
import { MeetingOverview } from '../components/meetings/MeetingOverview';
import { MeetingChapters, MeetingSummary, MeetingTranscript } from '../components/meetings/MeetingContent';
import { MeetingTasks } from '../components/meetings/MeetingTasks';
import { FollowUpModal } from '../components/meetings/FollowUpModal';
import { Button } from '../components/ui/button';
import MeetingReview from './MeetingReview';
import SpeakerMapping from './SpeakerMapping';

function useMeetingResource<T>(load: (() => Promise<T>) | null) {
  const [state, setState] = useState<{ data?: T; error?: string }>({});
  useEffect(() => {
    if (!load) return;
    let current = true;
    load().then(
      (data) => { if (current) setState({ data }); },
      (error: Error) => { if (current) setState({ error: error.message || 'Could not load this content.' }); },
    );
    return () => { current = false; };
  }, [load]);
  return state;
}

const tabs = [
  ['overview', 'Overview'], ['chapters', 'Chapters'], ['transcript', 'Transcript'],
  ['tasks', 'Tasks'], ['review', 'Review'], ['speakers', 'Speakers'], ['follow-up', 'Follow-up'],
] as const;
type Tab = typeof tabs[number][0];
type MeetingData = Awaited<ReturnType<typeof loadMeeting>>;

function MeetingWorkspace({ data, reload }: { data: MeetingData; reload: () => Promise<void> }) {
  const { meeting, tasks, role } = data;
  const canManage = canOrganise(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const { state } = useLocation();
  const returnTo = typeof state?.meetingsReturnTo === 'string' && state.meetingsReturnTo.startsWith('/meetings?')
    ? state.meetingsReturnTo : '/meetings';
  const [initialTab] = useState<Tab>(role === 'organiser' && meeting.pending && meeting.ai_processing && !meeting.needsSpeakers ? 'review' : 'overview');
  const [followUp, setFollowUp] = useState(false);
  const [loadSummary, setLoadSummary] = useState(false);
  const desiredTab = searchParams.get('tab') || initialTab;
  const availableTabs = tabs.filter(([id]) => {
    if (id === 'review' || id === 'follow-up') return canManage && meeting.ai_processing;
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
  const summaryRequest = useCallback(() => requestApi<MeetingSummaryData>(`/api/meetings/${meeting.id}/summary`), [meeting.id]);
  const summary = useMeetingResource((tab === 'overview' || loadSummary) && transcriptId && meeting.status !== 'processing' ? summaryRequest : null);
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

      {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-2">
        <MeetingSummary summary={summary.data} error={summary.error} meeting={meeting} onTimestamp={showQuote} />
        <MeetingOverview participants={meeting.participants} tasks={tasks} onShowTasks={() => setTab('tasks')} />
      </div>}
      {tab === 'chapters' && (transcriptId
        ? <MeetingChapters meetingId={meeting.id} onTimestamp={showQuote} />
        : <p className="text-sm text-neutral-400">No transcript available for chapters.</p>)}
      {tab === 'transcript' && <MeetingTranscript meeting={meeting} canManage={canManage}
        timestamp={searchParams.get('at')}
        excerpt={sourceSuggestion?.source_excerpt ?? tasks.find((task) => task.id === searchParams.get('task'))?.source_excerpt}
        onBackToReview={sourceSuggestion && availableTabs.some(([id]) => id === 'review') ? () => setTab('review') : undefined}
        onRefresh={reload} onTab={setTab} />}
      {tab === 'tasks' && <MeetingTasks tasks={tasks} onRefresh={reload} />}
      {(tab === 'review' || reviewOpened) && availableTabs.some(([id]) => id === 'review') && (
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
  if (!data) return <p role="status" className="p-8 text-sm text-neutral-400">Loading meeting…</p>;
  return <MeetingWorkspace data={data} reload={reload} />;
}
