import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Plus, Search } from 'lucide-react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { canOrganise } from '../lib/workspaceRoles';
import { loadMeetingList, meetingSources, needsAttention, type MeetingListEntry } from '../services/meetingNavigation';
import { supabase } from '../lib/supabase';
import { CreateMeetingModal } from '../components/meetings/CreateMeetingModal';
import { MeetingRow } from '../components/meetings/MeetingRow';
import { Button } from '../components/ui/button';

const views = [
  ['attention', 'Needs attention'], ['upcoming', 'Upcoming'], ['past', 'Past'], ['all', 'All'],
] as const;

function MeetingFilter({ label, value, options, onChange }: {
  label: string; value: string; options: readonly (readonly [string, string])[]; onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-32 space-y-1 text-xs text-neutral-400">
      <span>{label}</span>
      <select className="field w-full text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Any</option>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}

export default function MeetingsPage() {
  const { currentWorkspace, currentRole, loading: workspaceLoading } = useWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const workspaceId = currentWorkspace?.id;
  const canManage = canOrganise(currentRole);
  const [meetings, setMeetings] = useState<MeetingListEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const view = params.get('view') || 'attention';
  const source = meetingSources.find((option) => option === params.get('source'));
  const [query, setQuery] = useState(() => params.get('q') || '');
  const updateFilter = (key: string, value: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (value) next.set(key, value);
    else next.delete(key);
    return next;
  }, { replace: true });

  const reload = useCallback(async () => {
    if (!workspaceId) return;
    try {
      setMeetings(await loadMeetingList(workspaceId));
      setNow(Date.now());
      setError('');
    } catch (err) {
      setError((err as Error).message || 'Could not load meetings.');
    } finally {
      setLoaded(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    void reload();
    const channel = supabase.channel(`meetings-list:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings', filter: `workspace_id=eq.${workspaceId}` }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` }, reload)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [reload, workspaceId]);

  const hasProcessing = meetings.some((meeting) => meeting.status === 'processing');
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = window.setInterval(reload, 5000);
    return () => window.clearInterval(timer);
  }, [hasProcessing, reload]);

  const oldMeetingId = params.get('meeting');
  useEffect(() => {
    const unsupportedSource = params.has('source') && !source;
    if (oldMeetingId || !(params.has('status') || unsupportedSource)) return;
    const next = new URLSearchParams(params);
    next.delete('status');
    if (unsupportedSource) next.delete('source');
    setParams(next, { replace: true });
  }, [oldMeetingId, params, setParams, source]);

  if (oldMeetingId) return <Navigate to={`/meetings/${encodeURIComponent(oldMeetingId)}?tab=overview`} replace />;
  const organisers = [...new Map(meetings.map((meeting) => [meeting.organiser_id, meeting.organiser]))]
    .sort((a, b) => a[1].localeCompare(b[1]));
  const search = query.trim().toLocaleLowerCase();
  const filtered = meetings.filter((meeting) => {
    const isUpcoming = Date.parse(meeting.starts_at) > now;
    if (view === 'attention' && !needsAttention(meeting, canManage, now)) return false;
    if (view === 'upcoming' && !isUpcoming) return false;
    if (view === 'past' && isUpcoming) return false;
    if (params.get('organiser') && meeting.organiser_id !== params.get('organiser')) return false;
    if (source && meeting.source !== source) return false;
    if (params.get('ai') === 'off' && meeting.ai_processing) return false;
    if (params.get('ai') === 'on' && !meeting.ai_processing) return false;
    if (params.get('tasks') === 'blocked' && !meeting.counts.blocked) return false;
    return !search || [
      meeting.title, meeting.organiser, ...meeting.participants.map((p) => p.name),
      ...meeting.decisions.flatMap((d) => [d.task || '', d.source_excerpt]),
    ].some((value) => value.toLocaleLowerCase().includes(search));
  });
  if (view === 'upcoming') filtered.reverse();

  const returnParams = new URLSearchParams(params);
  if (query) returnParams.set('q', query);
  else returnParams.delete('q');
  const returnTo = returnParams.size ? `/meetings?${returnParams}` : '/meetings';
  const create = () => updateFilter('create', '1');
  const closeCreator = () => updateFilter('create', '');
  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Meetings</h1>
        {canManage && workspaceId && <Button onClick={create}><Plus /> New meeting</Button>}
      </header>

      {workspaceId && (
        <>
          <nav aria-label="Meeting views" className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
            {views.map(([id, label]) => (
              <Button key={id} size="sm" variant={view === id ? 'secondary' : 'ghost'} aria-pressed={view === id}
                onClick={() => updateFilter('view', id)}>{label}</Button>
            ))}
          </nav>
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-48 flex-1 space-y-1 text-xs text-neutral-400">
              <span>Search meetings</span>
              <span className="relative block"><Search className="pointer-events-none absolute left-3 top-3 size-4" />
                <input className="field w-full pl-9 text-sm" value={query} placeholder="Title, participant or decision"
                  onChange={(event) => setQuery(event.target.value)} />
              </span>
            </label>
            <MeetingFilter label="Organiser" options={organisers} value={params.get('organiser') || ''} onChange={(value) => updateFilter('organiser', value)} />
            <MeetingFilter label="Source" options={meetingSources.map((option) => [option, option])}
              value={source || ''} onChange={(value) => updateFilter('source', value)} />
            <MeetingFilter label="AI processing" options={[[ 'off', 'No AI' ], [ 'on', 'AI enabled' ]]} value={params.get('ai') || ''} onChange={(value) => updateFilter('ai', value)} />
            {params.get('tasks') === 'blocked' && <Button variant="outline" onClick={() => updateFilter('tasks', '')}>Blocked tasks ×</Button>}
          </div>
        </>
      )}

      {error && <div role="alert" className="flex items-center gap-3 text-sm text-rose-300">{error}<Button size="sm" variant="outline" onClick={reload}>Retry</Button></div>}
      {workspaceLoading || (workspaceId && !loaded) ? <p role="status" className="text-sm text-neutral-400">Loading meetings…</p>
        : !workspaceId ? <p className="text-sm text-neutral-400">Select a workspace to see meetings.</p>
        : !error && (filtered.length ? (
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-white/[0.02]">
            {filtered.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} canManage={canManage} returnTo={returnTo} />)}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-10 text-center">
            <CalendarDays className="mx-auto mb-3 size-7 text-neutral-500" />
            <h2 className="font-medium text-white">{meetings.length ? (view === 'attention' && params.size <= 1 ? 'No meetings need attention' : 'No matching meetings') : 'No meetings yet'}</h2>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {meetings.length > 0 && <Button variant="outline" onClick={() => { setQuery(''); setParams({ view: 'all' }); }}>View all meetings</Button>}
              {!meetings.length && canManage && <Button onClick={create}><Plus /> New meeting</Button>}
            </div>
          </div>
        ))}

      {workspaceId && canManage && <CreateMeetingModal workspaceId={workspaceId} isOpen={params.get('create') === '1'} onClose={closeCreator}
        onMeetingCreated={(meeting) => navigate(`/meetings/${meeting.id}?tab=overview`)} />}
    </div>
  );
}
