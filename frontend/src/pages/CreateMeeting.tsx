import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { supabase } from '../lib/supabase';
import { postApi } from '../services/reviewApi';
import { TimezoneSelector } from '../components/meetings/TimezoneSelector';
import { TranscriptUploadModal } from '../components/meetings/TranscriptUploadModal';
import { CalendarImportPicker } from '../components/meetings/CalendarImportPicker';
import type { CalendarEventItem } from '../services/calendarApi';

export function CreateMeeting() {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [timezone, setTimezone] = useState('');
  const [participants, setParticipants] = useState<string>('');
  const [attested, setAttested] = useState(false);
  const [progress, setProgress] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>();
  const [conferenceUrl, setConferenceUrl] = useState<string | undefined>();

  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const navigate = useNavigate();

  const handleSelectCalendarEvent = (ev: CalendarEventItem) => {
    setSelectedEventId(ev.id);
    setTitle(ev.title);
    setConferenceUrl(ev.conference_url || undefined);
    if (ev.timezone) setTimezone(ev.timezone);

    try {
      const d = new Date(ev.starts_at);
      const pad = (n: number) => n.toString().padStart(2, '0');
      const localStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setDate(localStr);
    } catch {
      // Fallback
    }

    if (ev.attendees && ev.attendees.length > 0) {
      setParticipants(ev.attendees.map(a => a.email).join(', '));
    }
  };

  // create meeting -> submit transcript (backend parses + stores) -> extract -> poll -> review
  const handleSubmit = async (input: { text?: string; file?: File }) => {
    if (!workspaceId) throw new Error('Please select or create a workspace first.');
    if (!title.trim() || !date || !timezone) throw new Error('Fill in title, date and timezone.');
    if (!attested) throw new Error('Confirm participants were told about AI processing.');

    setProgress('Creating meeting...');
    const meeting = await postApi(`/api/workspaces/${workspaceId}/meetings`, {
      title: title.trim(),
      starts_at: zonedToUtc(date, timezone),
      timezone,
      external_participants: participants.split(',').map(p => p.trim()).filter(Boolean),
      ai_processing: true,
      ai_attestation: true,
      calendar_event_id: selectedEventId || undefined,
      calendar_provider: selectedEventId ? 'google' : undefined,
      conference_url: conferenceUrl || undefined,
    });

    setProgress('Uploading transcript...');
    const form = new FormData();
    if (input.file) form.append('file', input.file);
    else form.append('text', input.text ?? '');
    await postApi(`/api/meetings/${meeting.id}/transcript`, form);

    setProgress('Extracting action items...');
    await postApi(`/api/meetings/${meeting.id}/extract`, {});
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const { data } = await supabase.from('meetings').select('status').eq('id', meeting.id).single();
      if (data?.status === 'ready') {
        navigate(`/meetings/${meeting.id}/review`);
        return;
      }
      if (data?.status === 'failed') throw new Error('AI extraction failed. Please try again.');
    }
    throw new Error('Extraction is taking too long; check the meeting later.');
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">New meeting</p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-white">Create meeting</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Schedule a new meeting and upload transcripts to generate actionable insights.
        </p>
      </div>

      {workspaceId && (
        <CalendarImportPicker
          workspaceId={workspaceId}
          onSelectEvent={handleSelectCalendarEvent}
          selectedEventId={selectedEventId}
        />
      )}

      <section className="panel space-y-5 p-6">
        <div>
          <p className="eyebrow">Step 01</p>
          <h2 className="mt-1 text-base font-medium tracking-tight text-white">Meeting details</h2>
        </div>

        <div>
          <label htmlFor="title" className="field-label">
            Meeting title
          </label>
          <input
            id="title"
            type="text"
            placeholder="e.g. Q3 Roadmap Planning"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="field"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="date" className="field-label">
              Date & time
            </label>
            <input
              id="date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="field"
            />
          </div>

          <TimezoneSelector
            value={timezone}
            onChange={setTimezone}
          />
        </div>

        <div>
          <label htmlFor="participants" className="field-label">
            Participants <span className="font-normal text-neutral-500">(comma-separated)</span>
          </label>
          <input
            id="participants"
            type="text"
            placeholder="e.g. alice@example.com, bob@example.com"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            className="field"
          />
        </div>
      </section>

      <section className="panel space-y-4 p-6">
        <div>
          <p className="eyebrow">Step 02</p>
          <h2 className="mt-1 text-base font-medium tracking-tight text-white">Ingest transcript</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Upload meeting transcripts (.txt, .vtt, .srt, .docx) to extract action items.
          </p>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-neutral-300">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-white"
          />
          All participants were informed that this transcript will be processed by AI.
        </label>
        <TranscriptUploadModal onSubmit={handleSubmit} progress={progress} />
      </section>
    </div>
  );
}

/** "2026-10-14T10:00" in `tz` -> UTC ISO string. ponytail: off by an hour inside a DST switch hour. */
function zonedToUtc(local: string, tz: string): string {
  const guess = new Date(`${local}:00Z`);
  const inTz = new Date(guess.toLocaleString('en-US', { timeZone: tz }));
  const inUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (inTz.getTime() - inUtc.getTime())).toISOString();
}

export default CreateMeeting;
