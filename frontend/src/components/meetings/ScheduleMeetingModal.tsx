import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Calendar,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Globe,
  LoaderCircle,
  Mail,
  MapPin,
  Sparkles,
  Users,
  Video,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { ParticipantPicker } from './ParticipantPicker';
import { TimezoneSelector } from './TimezoneSelector';
import { postApi } from '../../services/reviewApi';
import type { WorkspaceMember } from '../../types/review';

export interface ScheduledMeetingResult {
  id: string;
  workspace_id: string;
  title: string;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  conference_url?: string | null;
  notifications_sent: number;
  notified_recipients: string[];
  google_calendar_url?: string | null;
}

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  initialDate?: string;
  initialTitle?: string;
  initialConferenceUrl?: string;
  onMeetingScheduled: (meeting: ScheduledMeetingResult) => void;
}

const DURATION_PRESETS = [
  { label: '15m', minutes: 15 },
  { label: '30m', minutes: 30 },
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1.5h', minutes: 90 },
  { label: '2h', minutes: 120 },
] as const;

const PLATFORM_PRESETS = [
  { id: 'meet', label: 'Google Meet', prefix: 'https://meet.google.com/' },
  { id: 'zoom', label: 'Zoom', prefix: 'https://zoom.us/j/' },
  { id: 'teams', label: 'MS Teams', prefix: 'https://teams.microsoft.com/' },
  { id: 'in_person', label: 'In-Person Room', prefix: '' },
  { id: 'custom', label: 'Custom Link', prefix: '' },
] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseInitialDateTime(initialDate?: string): { date: string; time: string } {
  if (initialDate) {
    if (initialDate.includes('T')) {
      const [d, t] = initialDate.split('T');
      return {
        date: d,
        time: t ? t.slice(0, 5) : '10:00',
      };
    }
    return { date: initialDate, time: '10:00' };
  }
  const now = new Date();
  // Default to tomorrow or next clean hour
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    date: `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`,
    time: '10:00',
  };
}

function toUtcIso(dateStr: string, timeStr: string, timezone: string): string {
  const localIso = `${dateStr}T${timeStr}:00`;
  const guess = new Date(`${localIso}Z`);
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(guess);
    const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const represented = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    return new Date(guess.getTime() - (represented - guess.getTime())).toISOString();
  } catch {
    return new Date(localIso).toISOString();
  }
}

function downloadClientIcs(
  title: string,
  startsAtIso: string,
  durationMinutes: number,
  url?: string | null,
  description?: string
) {
  const start = new Date(startsAtIso);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const formatIcsDate = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

  const icsLines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ActionPulse//Meeting Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:meeting-${Date.now()}@actionpulse.app`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${formatIcsDate(start)}`,
    `DTEND:${formatIcsDate(end)}`,
    `SUMMARY:${title.replace(/[\r\n]+/g, ' ')}`,
    `DESCRIPTION:${(description || 'Scheduled via ActionPulse Meeting-to-Action Converter').replace(/[\r\n]+/g, '\\n')}`,
    url ? `LOCATION:${url.replace(/[\r\n]+/g, ' ')}` : 'LOCATION:Virtual Room',
    url && url.startsWith('http') ? `URL:${url}` : '',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const blob = new Blob([icsLines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_') || 'meeting'}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  workspaceId,
  initialDate,
  initialTitle = '',
  initialConferenceUrl = '',
  onMeetingScheduled,
}: ScheduleMeetingModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  // Form states
  const [title, setTitle] = useState(initialTitle);
  const parsed = useMemo(() => parseInitialDateTime(initialDate), [initialDate]);
  const [date, setDate] = useState(parsed.date);
  const [time, setTime] = useState(parsed.time);
  const [duration, setDuration] = useState<number>(30);
  const [timezone, setTimezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );
  const [platform, setPlatform] = useState<string>('meet');
  const [conferenceUrl, setConferenceUrl] = useState(initialConferenceUrl);
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [externals, setExternals] = useState<string[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [notifyViaEmail, setNotifyViaEmail] = useState(true);

  // Status & outcome states
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [createdResult, setCreatedResult] = useState<ScheduledMeetingResult | null>(null);

  // Sync initial props on open
  useEffect(() => {
    if (!isOpen) return;
    const p = parseInitialDateTime(initialDate);
    setDate(p.date);
    setTime(p.time);
    setTitle(initialTitle || '');
    setConferenceUrl(initialConferenceUrl || '');
    setError('');
    setCreatedResult(null);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.showModal();
    return () => {
      dialogRef.current?.close();
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, initialDate, initialTitle, initialConferenceUrl]);

  // Handle platform change
  const handlePlatformChange = (pId: string) => {
    setPlatform(pId);
    if (pId === 'in_person') {
      if (conferenceUrl.startsWith('http')) setConferenceUrl('');
    } else if (pId === 'meet' && !conferenceUrl) {
      setConferenceUrl('');
    }
  };

  // Human readable time range preview
  const formattedSchedulePreview = useMemo(() => {
    if (!date || !time) return '';
    try {
      const [year, month, day] = date.split('-').map(Number);
      const [hours, minutes] = time.split(':').map(Number);
      const startObj = new Date(year, month - 1, day, hours, minutes);
      const endObj = new Date(startObj.getTime() + duration * 60 * 1000);

      const dateStr = startObj.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const startTimeStr = startObj.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      const endTimeStr = endObj.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });

      return `${dateStr} • ${startTimeStr} – ${endTimeStr} (${duration} min)`;
    } catch {
      return `${date} at ${time} (${duration} min)`;
    }
  }, [date, time, duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Please provide a meeting title.');
      return;
    }
    if (!workspaceId) {
      setError('Workspace is required to schedule a meeting.');
      return;
    }

    if (conferenceUrl.trim() && platform !== 'in_person') {
      try {
        const u = new URL(conferenceUrl.trim());
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
      } catch {
        setError('Please enter a valid URL (starting with https://).');
        return;
      }
    }

    setBusy(true);
    try {
      const startsAtUtc = toUtcIso(date, time, timezone);
      const payload = {
        title: trimmedTitle,
        starts_at: startsAtUtc,
        duration_minutes: duration,
        timezone,
        participant_user_ids: memberIds,
        external_participants: externals,
        conference_url: conferenceUrl.trim() || undefined,
        description: description.trim() || undefined,
        notify_via_email: notifyViaEmail,
      };

      const result = (await postApi(
        `/api/workspaces/${workspaceId}/meetings/schedule`,
        payload
      )) as ScheduledMeetingResult;

      setCreatedResult(result);
      onMeetingScheduled(result);
    } catch (err) {
      setError((err as Error).message || 'Failed to schedule meeting. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-2xl border border-white/15 dashboard-surface bg-[#101013] p-0 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm"
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 dashboard-surface bg-[#101013]/95 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <CalendarPlus className="size-5" />
          </div>
          <div>
            <h2 id={headingId} className="text-lg font-semibold tracking-tight text-white">
              Schedule Meeting
            </h2>
            <p className="text-xs text-neutral-400">
              Set up a future meeting on the calendar and notify all invitees via email
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close modal"
          className="rounded-lg p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition disabled:opacity-40"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Confirmation View on Success */}
      {createdResult ? (
        <div className="space-y-6 p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-start gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <CheckCircle2 className="size-8 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Meeting Scheduled Successfully!</h3>
              <p className="text-sm font-medium text-emerald-200">{createdResult.title}</p>
              <p className="text-xs text-neutral-300">
                Scheduled for {formattedSchedulePreview} ({timezone})
              </p>
            </div>
          </div>

          {/* Email Notification Status */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-white">
              <Mail className="size-4 text-cyan-400" />
              <span>Email Invitations</span>
            </div>

            {createdResult.notifications_sent > 0 ? (
              <div className="space-y-2">
                <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                  <CalendarCheck className="size-3.5" />
                  Invitations dispatched via email to {createdResult.notifications_sent} recipient(s):
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {createdResult.notified_recipients.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200"
                    >
                      <Mail className="size-2.5 opacity-70" />
                      {email}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-400">
                {notifyViaEmail
                  ? 'No external recipients or workspace email addresses found to send invitations to.'
                  : 'Email notifications were opted out.'}
              </p>
            )}

            <p className="text-[11px] text-neutral-400 pt-1 border-t border-white/5">
              💡 Each invitation email includes an attached <code>invite.ics</code> file and a direct Google Calendar add link.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            {createdResult.google_calendar_url && (
              <Button
                asChild
                variant="outline"
                className="border-sky-500/30 text-sky-300 hover:bg-sky-500/10 gap-1.5 text-xs"
              >
                <a
                  href={createdResult.google_calendar_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Calendar className="size-3.5" />
                  Add to Google Calendar
                  <ExternalLink className="size-3 opacity-60" />
                </a>
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() =>
                downloadClientIcs(
                  createdResult.title,
                  createdResult.starts_at,
                  createdResult.duration_minutes,
                  createdResult.conference_url,
                  description
                )
              }
              className="border-white/15 text-neutral-200 hover:bg-white/5 gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Download .ics
            </Button>

            <Button
              onClick={onClose}
              className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-5"
            >
              Done & View Calendar
            </Button>
          </div>
        </div>
      ) : (
        /* Scheduling Form */
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 1. Meeting Title */}
          <div>
            <label htmlFor="sched-meeting-title" className="field-label flex items-center justify-between">
              <span>Meeting title *</span>
              <span className="text-[11px] font-normal text-neutral-500">{title.length}/300</span>
            </label>
            <input
              id="sched-meeting-title"
              className="field"
              placeholder="e.g. Sprint 2 Planning & Review"
              required
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 2. Date, Time & Duration */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <Clock className="size-3.5 text-cyan-400" />
              <span>Date & Schedule</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="sched-date" className="field-label">
                  Date
                </label>
                <input
                  id="sched-date"
                  type="date"
                  className="field"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="sched-time" className="field-label">
                  Start Time
                </label>
                <input
                  id="sched-time"
                  type="time"
                  className="field"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </div>
            </div>

            {/* Duration Selector */}
            <div>
              <label className="field-label">Duration</label>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((preset) => (
                  <button
                    key={preset.minutes}
                    type="button"
                    onClick={() => setDuration(preset.minutes)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      duration === preset.minutes
                        ? 'border-cyan-500 bg-cyan-500/15 text-cyan-300 font-semibold'
                        : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Timezone Selector */}
            <TimezoneSelector value={timezone} onChange={setTimezone} />

            {/* Live Schedule Preview Pill */}
            {formattedSchedulePreview && (
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-2 text-xs text-cyan-300 flex items-center gap-2">
                <CalendarDays className="size-3.5 text-cyan-400 shrink-0" />
                <span>{formattedSchedulePreview}</span>
              </div>
            )}
          </div>

          {/* 3. Platform & Video Link / Location */}
          <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.01] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <Video className="size-3.5 text-indigo-400" />
              <span>Location / Video Call</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {PLATFORM_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePlatformChange(p.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    platform === p.id
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300 font-semibold'
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              <label htmlFor="sched-conf-url" className="field-label">
                {platform === 'in_person' ? 'Room / Physical Location' : 'Meeting Link (URL)'}
              </label>
              <input
                id="sched-conf-url"
                type={platform === 'in_person' ? 'text' : 'url'}
                className="field"
                placeholder={
                  platform === 'in_person'
                    ? 'e.g. Conference Room B, 3rd Floor'
                    : 'https://meet.google.com/abc-defg-hij'
                }
                value={conferenceUrl}
                onChange={(e) => setConferenceUrl(e.target.value)}
              />
            </div>
          </div>

          {/* 4. Agenda / Description */}
          <div>
            <label htmlFor="sched-description" className="field-label flex items-center justify-between">
              <span>Agenda & Objectives (optional)</span>
              <span className="text-[11px] font-normal text-neutral-500">{description.length}/5000</span>
            </label>
            <textarea
              id="sched-description"
              className="field min-h-24 text-sm"
              placeholder="Outline meeting topics, discussion points, or goals. This will be included in the email invitations and calendar entry..."
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* 5. Participants */}
          <details className="rounded-xl border border-white/10 bg-white/[0.01] p-4" open>
            <summary className="cursor-pointer text-sm font-medium text-neutral-200 select-none flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="size-4 text-cyan-400" />
                <span>Invite Participants</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-normal text-neutral-300">
                  {memberIds.length + externals.length}
                </span>
              </span>
              <span className="text-xs text-neutral-400 hover:text-white">
                {memberIds.length + externals.length === 0 ? 'Add members & guests' : 'Change'}
              </span>
            </summary>
            <div className="pt-4">
              <ParticipantPicker
                workspaceId={workspaceId}
                selectedMemberIds={memberIds}
                onSelectedMemberIdsChange={setMemberIds}
                externalParticipants={externals}
                onExternalParticipantsChange={setExternals}
                onMembersLoaded={setMembers}
              />
            </div>
          </details>

          {/* 6. Email Notification Card */}
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/30 via-indigo-950/20 to-neutral-900/50 p-4">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={notifyViaEmail}
                onChange={(e) => setNotifyViaEmail(e.target.checked)}
                className="mt-0.5 size-4 rounded border-cyan-500/50 bg-neutral-900 text-cyan-500 focus:ring-cyan-500/40"
              />
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Mail className="size-4 text-cyan-400" />
                  <span>Notify all participants via email</span>
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.2 text-[10px] text-cyan-300 uppercase tracking-wider">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  Every invited team member and external guest will receive an email invitation containing the meeting
                  details, video call link, agenda, and an attached <code>invite.ics</code> calendar invite with a 1-click Google Calendar add button.
                </p>
              </div>
            </label>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300 animate-in fade-in"
            >
              {error}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClose}
              className="border-white/15 text-neutral-300 hover:bg-white/5"
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={busy || !title.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium gap-2 px-5 shadow-lg shadow-cyan-900/20"
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  <span>Scheduling & sending invites...</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="size-4" />
                  <span>Schedule meeting</span>
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
