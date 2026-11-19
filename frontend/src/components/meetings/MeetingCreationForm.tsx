import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, FileText, LoaderCircle, Mic, Upload, Video } from 'lucide-react';
import { postApi } from '../../services/reviewApi';
import type { CalendarEventItem } from '../../services/calendarApi';
import type { WorkspaceMember } from '../../types/review';
import { Button } from '../ui/button';
import { AudioRecorder } from './AudioRecorder';
import { CalendarImportPicker } from './CalendarImportPicker';
import { ParticipantPicker } from './ParticipantPicker';
import { TimezoneSelector } from './TimezoneSelector';

type MeetingSource = 'transcript' | 'live' | 'in_person';
export interface CreatedMeeting {
  id: string;
  title: string;
  conference_url?: string | null;
}

interface Props {
  workspaceId: string;
  initialDate?: string;
  onComplete: (meeting: CreatedMeeting) => void;
  onBusyChange?: (busy: boolean) => void;
  onSaved?: (meeting: CreatedMeeting) => void;
}

const SOURCES = [
  { id: 'transcript', title: 'Upload transcript', hint: 'A file or notes from a past meeting', icon: FileText },
  { id: 'live', title: 'Live online meeting', hint: 'Google Meet, Zoom or Microsoft Teams', icon: Video },
  { id: 'in_person', title: 'In-person meeting', hint: 'Record audio and identify speakers', icon: Mic },
] as const;

function localDateTime() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function toUtc(local: string, timezone: string) {
  const guess = new Date(`${local}:00Z`);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(guess);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return new Date(guess.getTime() - (represented - guess.getTime())).toISOString();
}

export function MeetingCreationForm({ workspaceId, initialDate, onComplete, onBusyChange, onSaved }: Props) {
  const navigate = useNavigate();
  const [source, setSource] = useState<MeetingSource>('transcript');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(initialDate || localDateTime);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [externals, setExternals] = useState<string[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [eventId, setEventId] = useState<string>();
  const [conferenceUrl, setConferenceUrl] = useState('');
  const [transcriptTab, setTranscriptTab] = useState<'upload' | 'paste' | 'later'>('upload');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedMeeting | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addTranscriptLater = source === 'transcript' && transcriptTab === 'later';

  const selectFile = (next?: File) => {
    if (!next) return;
    if (!/\.(txt|vtt|srt|docx)$/i.test(next.name)) {
      setError('Choose a .txt, .vtt, .srt or .docx transcript.');
    } else if (next.size === 0 || next.size > 10 * 1024 * 1024) {
      setError('Choose a non-empty transcript up to 10 MB.');
    } else {
      setError('');
      setFile(next);
    }
  };

  const selectEvent = (event: CalendarEventItem) => {
    setEventId(event.id);
    setTitle(event.title);
    setTimezone(event.timezone || timezone);
    const eventDate = new Date(event.starts_at);
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: event.timezone || timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).format(eventDate);
    setDate(parts.replace(' ', 'T'));
    if (event.conference_url) { setSource('live'); setConferenceUrl(event.conference_url); }
    setMemberIds(event.attendees.flatMap((attendee) => {
      const member = members.find((m) => m.email.toLowerCase() === attendee.email.toLowerCase());
      return member ? [member.user_id || member.id] : [];
    }));
    setExternals(event.attendees.filter((a) => !members.some((m) => m.email.toLowerCase() === a.email.toLowerCase()))
      .map((a) => a.email));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (!workspaceId) { setError('Select a workspace first.'); return; }
    if (!attested) { setError('Confirm that participants were informed about AI processing.'); return; }
    if (source === 'transcript' && !addTranscriptLater && !uploaded && (transcriptTab === 'paste' ? !text.trim() : !file)) {
      setError('Upload a transcript or paste your meeting notes.'); return;
    }
    if (source === 'in_person' && (!audio || memberIds.length + externals.length === 0)) {
      setError('Add everyone in the room and record or upload the meeting audio.'); return;
    }
    if (source === 'live') {
      try {
        const url = new URL(conferenceUrl);
        if (url.protocol !== 'https:' || !/^(meet\.google\.com|([\w-]+\.)?zoom\.us|teams\.(microsoft|live)\.com)$/.test(url.hostname)) throw new Error();
      } catch { setError('Enter an HTTPS Google Meet, Zoom or Microsoft Teams meeting link.'); return; }
    }
    setBusy(true);
    onBusyChange?.(true);
    try {
      setProgress(created ? 'Continuing your meeting…' : 'Creating meeting…');
      const meeting = created || await postApi(`/api/workspaces/${workspaceId}/meetings`, {
        title: title.trim(), starts_at: toUtc(date, timezone), timezone,
        participant_user_ids: memberIds, external_participants: externals,
        ai_processing: true, ai_attestation: attested,
        calendar_event_id: eventId, calendar_provider: eventId ? 'google' : undefined,
        conference_url: source === 'live' ? conferenceUrl.trim() : undefined,
      }) as CreatedMeeting;
      setCreated(meeting);
      onSaved?.(meeting);
      if (source === 'live') { setLiveReady(true); return; }
      if (addTranscriptLater) {
        onComplete(meeting);
        return;
      }
      if (!uploaded) {
        const form = new FormData();
        if (source === 'in_person' && audio) form.append('file', audio);
        else if (transcriptTab === 'upload' && file) form.append('file', file);
        else form.append('text', text.trim());
        setProgress(source === 'in_person' ? 'Uploading recording…' : 'Uploading transcript…');
        await postApi(`/api/meetings/${meeting.id}/${source === 'in_person' ? 'audio' : 'transcript'}`, form);
        setUploaded(true);
      }
      if (source === 'in_person') {
        onComplete(meeting);
        navigate(`/meetings/${meeting.id}/speakers`);
      } else {
        setProgress('Finding action items…');
        await postApi(`/api/meetings/${meeting.id}/extract`, {});
        onComplete(meeting);
      }
    } catch (err) {
      setError((err as Error).message || 'Could not create the meeting. Please try again.');
    } finally { setBusy(false); onBusyChange?.(false); setProgress(''); }
  };

  if (liveReady && created) return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="flex items-center gap-3"><CheckCircle2 className="size-8 text-emerald-400" /><div>
        <h3 className="text-lg font-semibold text-white">Your meeting is ready</h3>
        <p className="mt-1 text-sm text-neutral-400">{created.title}</p>
      </div></div>
      <ol className="space-y-4 text-sm text-neutral-300 list-decimal pl-5">
        <li>Install and pin the ActionPulse extension. Keep this workspace open in the same browser.</li>
        <li>Open the call and turn on captions. Open the extension to check that the caption count is increasing.</li>
        <li>After the call, use the extension to open the review. If upload did not start, choose Upload &amp; Generate AI Tasks.</li>
      </ol>
      <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">The extension is required for live capture. You can also upload an exported transcript to this meeting afterward.</p>
      <div className="flex flex-wrap gap-3">
        <Button asChild><a href={conferenceUrl} target="_blank" rel="noopener noreferrer"><Video /> Open meeting</a></Button>
        <Button variant="outline" onClick={() => onComplete(created)}>View meeting overview <ArrowRight /></Button>
      </div>
    </div>
  );

  return (
    <form onSubmit={submit} className="p-5 sm:p-7 space-y-6">
      <fieldset disabled={busy || recording || !!created} className="space-y-6 disabled:opacity-60">
        <div>
          <p className="mb-3 text-sm font-medium text-white">Meeting type</p>
          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Meeting source">
            {SOURCES.map(({ id, title: label, hint, icon: Icon }) => (
              <button key={id} type="button" aria-pressed={source === id} onClick={() => { setSource(id); setError(''); }}
                className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${source === id ? 'border-indigo-400 bg-indigo-500/10' : 'border-white/10 hover:bg-white/5'}`}>
                <Icon className={`mb-3 size-5 ${source === id ? 'text-indigo-300' : 'text-neutral-500'}`} />
                <span className="block text-sm font-medium text-white">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-400">{hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="meeting-title" className="field-label">Meeting title</label>
          <input id="meeting-title" className="field" placeholder="e.g. Weekly product sync" required maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="meeting-date" className="field-label">Date & time</label><input id="meeting-date" type="datetime-local" className="field" required value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <TimezoneSelector value={timezone} onChange={setTimezone} />
        </div>
        <details className="rounded-xl border border-white/10 p-4" open={source === 'in_person' || undefined}>
          <summary className="cursor-pointer text-sm font-medium text-neutral-200">Participants {memberIds.length + externals.length > 0 ? `(${memberIds.length + externals.length})` : source === 'in_person' ? '· required for speaker detection' : '· optional'}</summary>
          <div className="pt-4"><ParticipantPicker workspaceId={workspaceId} selectedMemberIds={memberIds} onSelectedMemberIdsChange={setMemberIds} externalParticipants={externals} onExternalParticipantsChange={setExternals} onMembersLoaded={setMembers} /></div>
        </details>
        <details className="text-sm text-neutral-400">
          <summary className="cursor-pointer hover:text-white">Import details from Google Calendar</summary>
          <div className="pt-3"><CalendarImportPicker workspaceId={workspaceId} onSelectEvent={selectEvent} selectedEventId={eventId} /></div>
        </details>
      </fieldset>

      <fieldset disabled={busy} className="space-y-4">
        <label className="flex items-start gap-3 text-xs leading-5 text-neutral-400 cursor-pointer">
          <input type="checkbox" required disabled={recording} className="mt-1 size-4 shrink-0 accent-indigo-500" checked={attested} onChange={(e) => setAttested(e.target.checked)} />
          <span>I have informed participants that this meeting's transcript or recording will be processed by AI. Suggested tasks require organiser approval.</span>
        </label>
        {source === 'live' ? (
          <div className="space-y-3">
            <div><label htmlFor="meeting-link" className="field-label">Meeting link</label><input id="meeting-link" type="url" className="field" required disabled={!!created} value={conferenceUrl} onChange={(e) => setConferenceUrl(e.target.value)} placeholder="Paste a Google Meet, Zoom or Teams link" /></div>
            <p className="text-xs leading-5 text-neutral-400">Install the ActionPulse browser extension before joining. It starts capturing when you turn on captions in the call.</p>
          </div>
        ) : source === 'in_person' ? (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-neutral-400">Add participants and confirm their consent to enable recording. You can identify each speaker after recording.</p>
            <AudioRecorder canRecord={attested} onRecordingChange={(active) => { setRecording(active); onBusyChange?.(active); }} onChange={(f) => { setAudio(f); setError(''); }} onError={setError} />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 p-4 space-y-4">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Transcript input">
              <Button type="button" variant={transcriptTab === 'upload' ? 'secondary' : 'ghost'} aria-pressed={transcriptTab === 'upload'} disabled={uploaded} onClick={() => setTranscriptTab('upload')}><Upload /> Upload file</Button>
              <Button type="button" variant={transcriptTab === 'paste' ? 'secondary' : 'ghost'} aria-pressed={transcriptTab === 'paste'} disabled={uploaded} onClick={() => setTranscriptTab('paste')}><FileText /> Paste text</Button>
              <Button type="button" variant={addTranscriptLater ? 'secondary' : 'ghost'} aria-pressed={addTranscriptLater} disabled={uploaded} onClick={() => setTranscriptTab('later')}>Add later</Button>
            </div>
            {addTranscriptLater ? (
              <p className="text-sm text-neutral-400">You can add the transcript from the meeting’s Transcript tab.</p>
            ) : transcriptTab === 'paste' ? <textarea className="field min-h-36 text-sm" aria-label="Meeting transcript" placeholder="Paste your transcript or meeting notes…" value={text} disabled={uploaded} onChange={(e) => setText(e.target.value)} /> : (
              <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!uploaded) selectFile(e.dataTransfer.files[0]); }}>
                <button type="button" disabled={uploaded} onClick={() => fileInput.current?.click()} className="w-full rounded-lg border border-dashed border-white/20 px-4 py-7 text-center hover:bg-white/5">
                  <Upload className="mx-auto mb-2 size-5 text-indigo-300" /><span className="block text-sm text-white">{file ? file.name : 'Choose a transcript or drop it here'}</span><span className="mt-1 block text-xs text-neutral-500">TXT, VTT, SRT or DOCX · Up to 10 MB</span>
                </button>
                <input ref={fileInput} type="file" aria-label="Upload transcript file" className="sr-only" accept=".txt,.vtt,.srt,.docx" onChange={(e) => selectFile(e.target.files?.[0])} />
              </div>
            )}
          </div>
        )}

      </fieldset>
      {created && error && <p className="text-xs text-amber-300">Your meeting was saved. Retry to continue uploading or processing it.</p>}
      {error && <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-5">
        <Button type="submit" disabled={busy || recording || !workspaceId} className="bg-indigo-500 text-white hover:bg-indigo-400">
          {busy ? <><LoaderCircle className="animate-spin" /><span role="status">{progress}</span></> : <>{addTranscriptLater ? 'Create meeting' : created ? 'Retry' : source === 'live' ? 'Create live meeting' : source === 'in_person' ? 'Transcribe meeting' : 'Create & find action items'}<ArrowRight /></>}
        </Button>
      </div>
    </form>
  );
}
