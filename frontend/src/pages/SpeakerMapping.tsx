import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, AudioLines, LoaderCircle, UserRound } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';
import { postApi } from '../services/reviewApi';
import { Button } from '../components/ui/button';
import { Notice } from '../components/ui/notice';

interface SpeakerSample { start_ms: number | null; text: string }
interface Speaker {
  speaker_label: string;
  speaker_name: string | null;
  talk_time_ms: number;
  segment_count: number;
  samples: SpeakerSample[];
}
interface Participant { participant_id: string; user_id: string | null; name: string; is_external: boolean }

async function authedFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `HTTP ${res.status}`);
  return data;
}

const fmtTime = (ms: number | null) => {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};
const fmtTalk = (ms: number) => (ms >= 60_000 ? `${Math.round(ms / 60_000)} min` : `${Math.round(ms / 1000)} s`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Offline meeting step 2: wait for transcription + diarization, then the organiser tells us
 * which detected speaker is which participant. Unmapped speakers stay "Speaker N" and their
 * action items get no owner (flagged for review), so nobody is ever guessed.
 */
export function SpeakerMapping() {
  const { id: meetingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'processing' | 'mapping' | 'failed' | 'extracting'>('processing');
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);

  const loadSpeakers = useCallback(async () => {
    const data = await authedFetch(`/api/meetings/${meetingId}/speakers`);
    setSpeakers(data.speakers);
    setParticipants(data.participants);
    // pre-select participants the speaker was already mapped to (re-visits)
    const byName = new Map<string, string>(data.participants.map((p: Participant) => [p.name, p.participant_id]));
    const initial: Record<string, string> = {};
    for (const sp of data.speakers as Speaker[]) {
      const pid = sp.speaker_name ? byName.get(sp.speaker_name) : undefined;
      if (pid) initial[sp.speaker_label] = pid;
    }
    setMapping(initial);
    setPhase('mapping');
  }, [meetingId]);

  // Poll meetings.status until diarization finishes (free CPU worker: up to ~1x the meeting length).
  useEffect(() => {
    if (phase !== 'processing' || !meetingId) return;
    let cancelled = false;
    const started = Date.now();
    (async () => {
      while (!cancelled) {
        const { data } = await supabase.from('meetings').select('status').eq('id', meetingId).single();
        if (cancelled) return;
        if (data?.status === 'failed') { setPhase('failed'); return; }
        if (data && data.status !== 'processing') {
          try { await loadSpeakers(); } catch (err) { setError((err as Error).message); setPhase('failed'); }
          return;
        }
        setElapsed(Math.floor((Date.now() - started) / 1000));
        await sleep(5000);
      }
    })();
    return () => { cancelled = true; };
  }, [phase, meetingId, loadSpeakers]);

  const usedBy = useMemo(() => {
    const m = new Map<string, string>();
    Object.entries(mapping).forEach(([label, pid]) => pid && m.set(pid, label));
    return m;
  }, [mapping]);

  const saveAndExtract = async () => {
    setError('');
    setPhase('extracting');
    try {
      await authedFetch(`/api/meetings/${meetingId}/speakers`, {
        method: 'PUT',
        body: JSON.stringify({
          mappings: speakers.map((s) => ({ speaker_label: s.speaker_label, participant_id: mapping[s.speaker_label] || null })),
        }),
      });
      await postApi(`/api/meetings/${meetingId}/extract`, {});
      for (let i = 0; i < 90; i++) {
        await sleep(2000);
        const { data } = await supabase.from('meetings').select('status').eq('id', meetingId).single();
        if (data?.status === 'ready') { navigate(`/meetings/${meetingId}/review`); return; }
        if (data?.status === 'failed') throw new Error('AI extraction failed. Please try again.');
      }
      throw new Error('Extraction is taking too long; check the meeting later.');
    } catch (err) {
      setError((err as Error).message);
      setPhase('mapping');
    }
  };

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="eyebrow">Offline meeting</p>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">Who said what?</h1>
          <p className="mt-2 text-sm text-neutral-400">
            We detected the different voices in your recording. Match each one to a participant so action
            items get the right owner. Leave a speaker as “Unknown” if you're not sure; their tasks will be
            flagged for review instead of guessed.
          </p>
        </div>

        {phase === 'processing' && (
          <section className="panel flex flex-col items-center gap-3 p-10 text-center">
            <LoaderCircle className="size-6 animate-spin text-neutral-400" />
            <p className="text-sm text-white">Transcribing and detecting speakers…</p>
            <p className="max-w-md text-xs text-neutral-500">
              This runs on a free worker and can take up to about as long as the meeting itself. You can leave
              this page and come back via the meeting later.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {Math.floor(elapsed / 60)}m {elapsed % 60}s elapsed
            </p>
          </section>
        )}

        {phase === 'failed' && (
          <section className="panel space-y-4 p-6">
            <Notice tone="error">{error || 'Transcription failed. The recording may be silent, corrupted, or the worker is down.'}</Notice>
            <Button variant="outline" onClick={() => navigate('/meetings')}>Back to meetings</Button>
          </section>
        )}

        {(phase === 'mapping' || phase === 'extracting') && (
          <>
            <div className="space-y-4">
              {speakers.map((sp, idx) => (
                <section key={sp.speaker_label} className="panel space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-full border border-white/15 text-neutral-300">
                        <AudioLines className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Speaker {idx + 1}</p>
                        <p className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                          {fmtTalk(sp.talk_time_ms)} talking · {sp.segment_count} turns
                        </p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <UserRound className="size-4 text-neutral-500" />
                      <span className="sr-only">Participant for speaker {idx + 1}</span>
                      <select
                        className="field w-56"
                        value={mapping[sp.speaker_label] ?? ''}
                        disabled={phase === 'extracting'}
                        onChange={(e) => setMapping((m) => ({ ...m, [sp.speaker_label]: e.target.value }))}
                      >
                        <option value="">Unknown</option>
                        {participants.map((p) => {
                          const taken = usedBy.get(p.participant_id);
                          return (
                            <option key={p.participant_id} value={p.participant_id}
                              disabled={!!taken && taken !== sp.speaker_label}>
                              {p.name}{p.is_external ? ' (external)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </label>
                  </div>
                  <ul className="space-y-2 border-l border-white/10 pl-4">
                    {sp.samples.map((s, i) => (
                      <li key={i} className="text-sm text-neutral-300">
                        <span className="mr-2 font-mono text-[10px] text-neutral-500">{fmtTime(s.start_ms)}</span>
                        “{s.text}”
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {error && <Notice tone="error">{error}</Notice>}

            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                {Object.values(mapping).filter(Boolean).length} of {speakers.length} speakers mapped
              </p>
              <Button onClick={saveAndExtract} disabled={phase === 'extracting' || speakers.length === 0}>
                {phase === 'extracting' ? (
                  <><LoaderCircle className="animate-spin" /> Extracting action items…</>
                ) : (
                  <>Save & extract action items <ArrowRight /></>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default SpeakerMapping;
