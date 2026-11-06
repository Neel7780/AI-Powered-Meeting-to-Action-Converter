import React, { useState } from 'react';
import {
  X,
  Calendar,
  Video,
  Users,
  FileText,
  Upload,
  Sparkles,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Wand2,
} from 'lucide-react';
import { postApi } from '../../services/reviewApi';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/button';
import { TimezoneSelector } from './TimezoneSelector';

interface CreateMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onMeetingCreated: (meeting: any) => void;
  onSwitchToAdvanced?: () => void;
  initialDate?: string;
}

const SAMPLE_TRANSCRIPT = `Madhav Chauhan (00:05): Team, let's review our sprint progress. Bharat, can you verify the transcript parser handles .vtt and .srt subtitle files properly by Friday?
Bharat Odedara (00:22): Yes, I'll test the parser and add error handling for corrupted files before Friday October 16th.
Arnav Pandita (00:38): I will write the Supabase RLS security policies for the meetings and tasks tables by next Monday.
Madhav Chauhan (00:55): Great. Yuvraj, please add the AI Attestation disclaimer banner on the meeting review gate by October 18th.
Yuvraj Katara (01:10): On it. I'll make sure it's visible before organisers approve extracted tasks.`;

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  isOpen,
  onClose,
  workspaceId,
  onMeetingCreated,
  onSwitchToAdvanced,
  initialDate,
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    if (initialDate) return initialDate;
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  React.useEffect(() => {
    if (initialDate && isOpen) {
      setDate(initialDate);
    }
  }, [initialDate, isOpen]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [meetingFormat, setMeetingFormat] = useState<'online' | 'in_person'>('online');
  const [conferenceUrl, setConferenceUrl] = useState('');
  const [attested, setAttested] = useState(true);

  // Transcript tab: 'paste' | 'upload' | 'later'
  const [transcriptTab, setTranscriptTab] = useState<'paste' | 'upload' | 'later'>('paste');
  const [transcriptText, setTranscriptText] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUseSampleTranscript = () => {
    setTranscriptText(SAMPLE_TRANSCRIPT);
    if (!title.trim()) {
      setTitle('Sprint Architecture & Security Review');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowed = ['.txt', '.vtt', '.srt', '.docx'];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowed.includes(ext)) {
        setError(`Unsupported file format. Please upload ${allowed.join(', ')}`);
        return;
      }
      setError(null);
      setUploadedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a meeting title.');
      return;
    }
    if (!date) {
      setError('Please select a meeting date and time.');
      return;
    }
    if (!attested) {
      setError('Please attest that participants were notified of AI processing.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusMessage('Creating meeting...');

    try {
      // 1. Convert local date to UTC ISO string
      let startsAtUtc = new Date().toISOString();
      try {
        const localDate = new Date(date);
        startsAtUtc = localDate.toISOString();
      } catch {
        startsAtUtc = new Date().toISOString();
      }

      // 2. Call backend meeting creation
      let createdMeeting: any = null;
      try {
        createdMeeting = await postApi(`/api/workspaces/${workspaceId}/meetings`, {
          title: title.trim(),
          starts_at: startsAtUtc,
          timezone,
          participant_user_ids: [],
          external_participants: [],
          ai_processing: true,
          ai_attestation: true,
          conference_url: meetingFormat === 'online' && conferenceUrl.trim() ? conferenceUrl.trim() : undefined,
        });
      } catch (backendErr) {
        console.warn('Backend API meeting creation failed, falling back to direct Supabase insert:', backendErr);
        // Supabase direct fallback
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000001';

        const { data: inserted, error: insertErr } = await supabase
          .from('meetings')
          .insert({
            workspace_id: workspaceId,
            title: title.trim(),
            starts_at: startsAtUtc,
            timezone,
            organiser_id: userId,
            status: transcriptTab !== 'later' ? 'ready' : 'draft',
            conference_url: meetingFormat === 'online' && conferenceUrl.trim() ? conferenceUrl.trim() : null,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;
        createdMeeting = inserted;
      }

      if (!createdMeeting || !createdMeeting.id) {
        throw new Error('Failed to retrieve created meeting record.');
      }

      // 3. Attach transcript if provided
      if (transcriptTab === 'paste' && transcriptText.trim()) {
        setStatusMessage('Saving transcript...');
        try {
          const form = new FormData();
          form.append('text', transcriptText.trim());
          await postApi(`/api/meetings/${createdMeeting.id}/transcript`, form);
          setStatusMessage('Extracting action items...');
          await postApi(`/api/meetings/${createdMeeting.id}/extract`, {}).catch(() => null);
        } catch (tErr) {
          console.warn('Backend transcript upload fallback, inserting to Supabase:', tErr);
          const { data: tRow } = await supabase
            .from('transcripts')
            .insert({
              meeting_id: createdMeeting.id,
              source: 'paste',
              canonical_text: transcriptText.trim(),
              raw_text: transcriptText.trim(),
            })
            .select()
            .single();

          // Split lines to create segments if available
          if (tRow) {
            const lines = transcriptText.trim().split('\n').filter(Boolean);
            const segments = lines.map((line, idx) => {
              const speakerMatch = line.match(/^([^:(]+)(?:\s*\(([^)]+)\))?:\s*(.+)$/);
              const speaker = speakerMatch ? speakerMatch[1].trim() : `Speaker ${idx + 1}`;
              const text = speakerMatch ? speakerMatch[3].trim() : line.trim();
              return {
                transcript_id: tRow.id,
                segment_index: idx,
                speaker_name: speaker,
                start_ms: idx * 30000,
                end_ms: (idx + 1) * 30000,
                text,
              };
            });
            try {
              await supabase.from('transcript_segments').insert(segments);
            } catch {
              // ignore segment insertion error
            }
          }
        }
      } else if (transcriptTab === 'upload' && uploadedFile) {
        setStatusMessage('Uploading transcript file...');
        try {
          const form = new FormData();
          form.append('file', uploadedFile);
          await postApi(`/api/meetings/${createdMeeting.id}/transcript`, form);
          setStatusMessage('Extracting action items...');
          await postApi(`/api/meetings/${createdMeeting.id}/extract`, {}).catch(() => null);
        } catch (fErr) {
          console.warn('Transcript file upload notice:', fErr);
        }
      }

      // Success!
      setStatusMessage('Meeting created successfully!');
      onMeetingCreated(createdMeeting);
      onClose();
    } catch (err: any) {
      console.error('Error creating meeting:', err);
      setError(err?.message || 'Failed to create meeting. Please check required fields.');
    } finally {
      setLoading(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-white/15 bg-neutral-900/95 shadow-2xl rounded-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 shrink-0 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              <Calendar className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white tracking-tight">Create New Meeting</h2>
              <p className="text-xs text-neutral-400">Schedule or log a meeting and attach transcripts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="meeting-title" className="block text-xs font-medium text-neutral-300 mb-1.5">
              Meeting Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="meeting-title"
              type="text"
              required
              placeholder="e.g. Sprint 3 Planning & Architecture Sync"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Date, Time & Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="meeting-datetime" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Date & Time <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  id="meeting-datetime"
                  type="datetime-local"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <TimezoneSelector value={timezone} onChange={setTimezone} />
            </div>
          </div>

          {/* Format selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-1.5">Meeting Format</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMeetingFormat('online')}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                  meetingFormat === 'online'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/30'
                    : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Video className="size-4 shrink-0 text-indigo-400" />
                <div>
                  <span className="block text-xs font-semibold">Online Meeting</span>
                  <span className="block text-[11px] text-neutral-500">Google Meet / Zoom</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMeetingFormat('in_person')}
                className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all ${
                  meetingFormat === 'in_person'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white ring-1 ring-indigo-500/30'
                    : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                <Users className="size-4 shrink-0 text-emerald-400" />
                <div>
                  <span className="block text-xs font-semibold">In-Person Meeting</span>
                  <span className="block text-[11px] text-neutral-500">Physical room session</span>
                </div>
              </button>
            </div>

            {meetingFormat === 'online' && (
              <div className="mt-3">
                <input
                  type="url"
                  placeholder="Conference link (e.g. https://meet.google.com/abc-defg-hij)"
                  value={conferenceUrl}
                  onChange={(e) => setConferenceUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          {/* Transcript Ingestion Tabs */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <FileText className="size-3.5 text-indigo-400" />
                  Meeting Transcript
                </h3>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Attach meeting notes or transcript now to automatically extract tasks
                </p>
              </div>

              {transcriptTab === 'paste' && (
                <button
                  type="button"
                  onClick={handleUseSampleTranscript}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                >
                  <Wand2 className="size-3" />
                  Use Sample Notes
                </button>
              )}
            </div>

            {/* Tab switchers */}
            <div className="flex items-center gap-1 border-b border-white/10 pb-2">
              <button
                type="button"
                onClick={() => setTranscriptTab('paste')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  transcriptTab === 'paste'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Paste Text
              </button>
              <button
                type="button"
                onClick={() => setTranscriptTab('upload')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  transcriptTab === 'upload'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Upload File (.vtt, .srt, .txt, .docx)
              </button>
              <button
                type="button"
                onClick={() => setTranscriptTab('later')}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  transcriptTab === 'later'
                    ? 'bg-white/10 text-white'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Add Later
              </button>
            </div>

            {/* Tab content */}
            {transcriptTab === 'paste' && (
              <div>
                <textarea
                  rows={4}
                  placeholder="Paste meeting transcript or notes here... e.g.&#10;Madhav: We need to set up the database migrations by Friday.&#10;Arnav: I will take that task."
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white placeholder-neutral-500 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>
            )}

            {transcriptTab === 'upload' && (
              <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.01] p-5 text-center">
                <Upload className="mx-auto size-6 text-neutral-500 mb-2" />
                <label className="cursor-pointer text-xs font-medium text-indigo-400 hover:text-indigo-300">
                  <span>Click to select transcript file</span>
                  <input
                    type="file"
                    accept=".txt,.vtt,.srt,.docx"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
                <p className="text-[11px] text-neutral-500 mt-1">Supports .vtt, .srt, .txt, and .docx (up to 10 MB)</p>
                {uploadedFile && (
                  <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="size-3.5" />
                    <span>Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>
            )}

            {transcriptTab === 'later' && (
              <p className="text-xs text-neutral-400 italic py-1">
                You can create this meeting now and upload or paste the transcript after the meeting concludes.
              </p>
            )}
          </div>

          {/* AI Attestation Consent Checkbox */}
          <label className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              required
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              className="mt-0.5 size-4 rounded accent-indigo-600 cursor-pointer"
            />
            <span>
              All meeting participants were informed that this session's transcript and action items will be analyzed and processed by AI.
            </span>
          </label>

          {/* Advanced creator toggle */}
          {onSwitchToAdvanced && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToAdvanced();
                }}
                className="text-xs text-neutral-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
              >
                Need Google Calendar sync or Offline Audio recording? Open Full Meeting Wizard →
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="text-neutral-400 hover:text-white text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 shadow-lg shadow-indigo-500/20"
            >
              {loading ? (
                <>
                  <LoaderCircle className="size-3.5 animate-spin mr-1.5" />
                  {statusMessage || 'Creating...'}
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5 mr-1.5" />
                  Create Meeting
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
