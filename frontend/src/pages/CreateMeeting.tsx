import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import { TimezoneSelector } from '../components/meetings/TimezoneSelector';
import { TranscriptUploadModal } from '../components/meetings/TranscriptUploadModal';
import { reviewApi, INITIAL_MEMBERS } from '../services/reviewApi';
import type { WorkspaceMember } from '../types/review';
import { 
  ShieldCheck, 
  Sparkles, 
  Lock, 
  Globe, 
  Users, 
  Calendar, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  FileText
} from 'lucide-react';

export function CreateMeeting() {
  const navigate = useNavigate();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || 'ws-team-10';

  // Form State
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    return now.toISOString().slice(0, 16);
  });
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [isNoAiMode, setIsNoAiMode] = useState(true); // Default to No-AI mode per privacy-first DPDP
  const [visibility, setVisibility] = useState<'private' | 'workspace'>('private');
  const [aiAttestation, setAiAttestation] = useState(false);
  const [externalParticipants, setExternalParticipants] = useState('');
  
  // Workspace Members & Selection
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  
  // Status & Transcript
  const [meetingId] = useState(() => crypto.randomUUID());
  const [transcriptUploaded, setTranscriptUploaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadMembers() {
      try {
        const mems = await reviewApi.fetchWorkspaceMembers(workspaceId);
        setMembers(mems.length > 0 ? mems : INITIAL_MEMBERS);
        // Pre-select first 2 members as attendees by default
        if (mems.length > 0) {
          setSelectedUserIds(mems.slice(0, 3).map(m => m.user_id || m.id));
        } else {
          setSelectedUserIds(INITIAL_MEMBERS.slice(0, 3).map(m => m.user_id));
        }
      } catch (err) {
        console.warn('Failed to load workspace members:', err);
        setMembers(INITIAL_MEMBERS);
      }
    }
    loadMembers();
  }, [workspaceId]);

  // Sync visibility with No-AI mode toggle
  const handleToggleNoAi = (enableNoAi: boolean) => {
    setIsNoAiMode(enableNoAi);
    if (enableNoAi) {
      setVisibility('private');
      setAiAttestation(false);
    } else {
      setVisibility('workspace');
    }
    setFormError(null);
  };

  const handleToggleMember = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleUploadSuccess = (_path: string) => {
    setTranscriptUploaded(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Please provide a meeting title.');
      return;
    }

    if (!date) {
      setFormError('Please select a scheduled date and time.');
      return;
    }

    if (!timezone) {
      setFormError('Please specify a timezone.');
      return;
    }

    // Check AI attestation requirement when AI mode is active
    if (!isNoAiMode && !aiAttestation) {
      setFormError('Compliance notice: You must attest that participants were informed of AI transcript processing before proceeding in AI Mode (CR-01).');
      return;
    }

    setIsSubmitting(true);

    try {
      const extList = externalParticipants
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const createdMeeting = await reviewApi.createMeeting(workspaceId, {
        title: cleanTitle,
        starts_at: new Date(date).toISOString(),
        timezone,
        participant_user_ids: selectedUserIds,
        external_participants: extList,
        ai_processing: !isNoAiMode,
        ai_attestation: !isNoAiMode ? aiAttestation : false,
        visibility
      });

      setSuccessMessage(
        isNoAiMode 
          ? 'Confidential No-AI meeting created! Redirecting to workspace for manual task assignment...'
          : 'AI-assisted meeting created! Redirecting to workspace...'
      );

      setTimeout(() => {
        navigate(`/meetings/${createdMeeting.id}/review`);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to create meeting:', err);
      setFormError(err?.message || 'Failed to create meeting. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
            Sprint 3 • Meeting Privacy Controls
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Create Meeting & Setup Privacy Mode
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Configure meeting confidentiality. In No-AI Mode, no transcripts are sent to external AI providers, and managers manually assign tasks.
        </p>
      </div>

      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Unable to create meeting</p>
            <p className="text-xs text-red-600 mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-sm text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* NO-AI MODE / AI MODE SELECTOR (CARD SELECTION) */}
        <div className="space-y-3">
          <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>Meeting Processing Mode</span>
            <span className="text-xs font-normal text-slate-500">(Required)</span>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: No-AI Mode (Confidential) */}
            <div
              onClick={() => handleToggleNoAi(true)}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                isNoAiMode 
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20 shadow-sm' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isNoAiMode ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">No-AI Mode</h3>
                      <p className="text-xs text-slate-500">Confidential & Private</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isNoAiMode ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    100% Private
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-600">
                  <strong>Zero AI transfer.</strong> Transcripts are strictly kept private within your workspace and <em>never</em> sent to, read by, or processed by any external AI.
                </p>

                <div className="pt-2 border-t border-emerald-200/60 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Managers manually assign tasks to participants.</span>
                </div>
              </div>

              {isNoAiMode && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Selected (Privacy Guard Active)</span>
                </div>
              )}
            </div>

            {/* Option 2: AI Assisted Mode */}
            <div
              onClick={() => handleToggleNoAi(false)}
              className={`relative cursor-pointer rounded-2xl p-5 border-2 transition-all flex flex-col justify-between ${
                !isNoAiMode 
                  ? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/20 shadow-sm' 
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${!isNoAiMode ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Standard AI Mode</h3>
                      <p className="text-xs text-slate-500">Automated Extraction</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    !isNoAiMode ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-slate-100 text-slate-500'
                  }`}>
                    AI-Assisted
                  </span>
                </div>

                <p className="text-xs leading-relaxed text-slate-600">
                  Transcripts are parsed by Google Gemini to automatically discover action items, tentative owners, and deadlines for staging review.
                </p>

                <div className="pt-2 border-t border-indigo-200/60 text-[11px] text-indigo-800 font-medium flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span>Organiser staging gate review before publish.</span>
                </div>
              </div>

              {!isNoAiMode && (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  <span>Selected (AI Extraction Active)</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BASIC MEETING DETAILS */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Meeting Details</h2>
            <p className="text-xs text-slate-500">Provide the title, date, and operational timezone.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="title" className="text-sm font-semibold text-slate-700">
                Meeting Title <span className="text-rose-500">*</span>
              </label>
              <input
                id="title"
                type="text"
                placeholder={isNoAiMode ? "e.g. Confidential Executive Strategy & Bonus Review" : "e.g. Sprint 3 Architecture & Backlog Sync"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="date" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>Scheduled Date & Time</span> <span className="text-rose-500">*</span>
                </label>
                <input
                  id="date"
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="flex h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <TimezoneSelector 
                  value={timezone} 
                  onChange={setTimezone} 
                />
              </div>
            </div>

            {/* Visibility Option */}
            <div className="space-y-1.5 pt-2">
              <label className="text-sm font-semibold text-slate-700">
                Meeting Visibility Scope
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  visibility === 'private' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="private"
                    checked={visibility === 'private'}
                    onChange={() => setVisibility('private')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Lock className="w-3.5 h-3.5 text-slate-600" />
                      <span>Private Meeting (Attendees Only)</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Only organisers and invited participants can view</p>
                  </div>
                </label>

                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                  visibility === 'workspace' ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}>
                  <input
                    type="radio"
                    name="visibility"
                    value="workspace"
                    checked={visibility === 'workspace'}
                    onChange={() => setVisibility('workspace')}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                      <Globe className="w-3.5 h-3.5 text-slate-600" />
                      <span>Workspace Public</span>
                    </div>
                    <p className="text-[11px] text-slate-500">Visible to all workspace members</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* PARTICIPANTS ASSIGNMENT */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <span>Workspace Participants</span>
              </h2>
              <p className="text-xs text-slate-500">
                Select workspace members who attended or will participate in this meeting.
              </p>
            </div>
            <span className="text-xs bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
              {selectedUserIds.length} selected
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {members.map(member => {
              const uid = member.user_id || member.id;
              const isSelected = selectedUserIds.includes(uid);
              return (
                <div
                  key={uid}
                  onClick={() => handleToggleMember(uid)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-indigo-500 bg-indigo-50/40 shadow-xs' 
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by parent div click
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                    {member.initials || member.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{member.full_name}</p>
                    <p className="text-[10px] text-slate-500 truncate capitalize">{member.role.replace('_', ' ')}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5 pt-2">
            <label htmlFor="external" className="text-xs font-semibold text-slate-700">
              External Guests / Non-Members (Optional, comma-separated)
            </label>
            <input
              id="external"
              type="text"
              placeholder="e.g. auditor@client.com, legal-counsel@law.org"
              value={externalParticipants}
              onChange={(e) => setExternalParticipants(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* TRANSCRIPT / NOTES INGESTION */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {isNoAiMode ? "Meeting Notes & Private Transcript" : "Ingest Transcript for AI"}
              </h2>
              <p className="text-xs text-slate-500">
                {isNoAiMode 
                  ? "Upload or paste notes for record-keeping. No AI will ever read or process this data." 
                  : "Upload or paste transcript (.txt, .vtt, .srt, .docx) for GenAI action item extraction."
                }
              </p>
            </div>
            {transcriptUploaded && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Transcript Attached</span>
              </span>
            )}
          </div>

          <TranscriptUploadModal 
            workspaceId={workspaceId}
            meetingId={meetingId}
            onUploadSuccess={handleUploadSuccess}
          />
        </div>

        {/* COMPLIANCE & ATTESTATION SECTION */}
        {isNoAiMode ? (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-bold">🔒 No-AI Privacy Mode Active (DPDP / GDPR Compliant)</p>
              <p className="mt-0.5 text-emerald-800">
                Because AI processing is completely disabled for this meeting, zero transcript data is transmitted to external AI endpoints. 
                Third-party consent attestation is waived. You will be able to manually assign tasks to workspace members in the meeting workspace.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-950 leading-relaxed">
                <p className="font-bold">AI Processing Disclosure & Consent (CR-01 / FR-SEC-09)</p>
                <p className="mt-0.5 text-indigo-800">
                  Meeting transcripts will be processed by Google Gemini (Flash-Lite free tier). AI outputs are recommendations and require organiser approval.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-3 pt-2 border-t border-indigo-200/60 cursor-pointer">
              <input
                type="checkbox"
                checked={aiAttestation}
                onChange={(e) => setAiAttestation(e.target.checked)}
                className="h-4 w-4 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-indigo-900">
                I attest that meeting participants have been informed that transcripts will be processed by AI. <span className="text-rose-500">*</span>
              </span>
            </label>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/meetings')}
            className="px-5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed ${
              isNoAiMode ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800' : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800'
            }`}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Creating Meeting...</span>
              </>
            ) : (
              <>
                <span>Create Meeting {isNoAiMode ? "(No-AI Mode)" : ""}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateMeeting;
