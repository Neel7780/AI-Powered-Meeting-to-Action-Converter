import { supabase } from '../lib/supabase';
import type { KanbanTaskItem, TaskStatus } from '../components/kanban/KanbanCard';
import type { AppRole } from '../context/WorkspaceContext';

interface MeetingParticipant {
  id: string;
  user_id: string | null;
  external_name: string | null;
}

interface Decision {
  id: string;
  type: string;
  task: string | null;
  source_excerpt: string;
  source_start_ms: number | null;
  review_status: string;
}

export const meetingSources = ['Online', 'Transcript', 'In person'] as const;

interface MeetingRecord {
  id: string;
  workspace_id: string;
  title: string;
  status: string;
  starts_at: string;
  timezone: string;
  organiser_id: string;
  ai_processing: boolean;
  speaker_mapping_required?: boolean | null;
  conference_url: string | null;
  transcripts: { id: string; source: string } | null;
  meeting_participants: MeetingParticipant[];
  extracted_items: Decision[];
}

export interface MeetingEntry extends MeetingRecord {
  organiser: string;
  participants: { id: string; userId?: string; name: string }[];
  decisions: Decision[];
  source: (typeof meetingSources)[number] | null;
  pending: number;
  needsSpeakers: boolean;
}

const meetingFields = `
  *,
  transcripts(id, source), meeting_participants(id, user_id, external_name),
  extracted_items(id, type, task, source_excerpt, source_start_ms, review_status)
`;

async function getProfiles(ids: string[]) {
  if (!ids.length) return new Map<string, { id: string; display_name: string | null; email: string | null }>();
  const { data, error } = await supabase.from('profiles').select('id, display_name, email').in('id', [...new Set(ids)]);
  if (error) throw error;
  return new Map(data.map((profile) => [profile.id, profile]));
}

function toEntry(row: MeetingRecord, profiles: Awaited<ReturnType<typeof getProfiles>>): MeetingEntry {
  const name = (id: string, fallback: string) => profiles.get(id)?.display_name || profiles.get(id)?.email || fallback;
  return {
    ...row,
    organiser: name(row.organiser_id, 'Organiser'),
    participants: row.meeting_participants.map((p) => ({
      id: p.id, userId: p.user_id || undefined,
      name: p.user_id ? name(p.user_id, 'Participant') : p.external_name || 'Guest',
    })),
    decisions: row.extracted_items.filter((item) => item.type === 'decision' && item.review_status !== 'rejected'),
    pending: row.extracted_items.filter((item) => item.type === 'action' && item.review_status === 'needs_review').length,
    // Audio transcription finishes in draft. Extraction changes it to processing, then ready.
    needsSpeakers: row.transcripts?.source === 'audio' && (row.speaker_mapping_required ?? row.status === 'draft'),
    source: row.transcripts?.source === 'audio' ? 'In person'
      : row.conference_url ? 'Online'
      : row.transcripts ? 'Transcript' : null,
  };
}

export type TaskCounts = { open: number; overdue: number; blocked: number };
type TaskSnapshot = { status: TaskStatus; deadline_utc: string | null };
export function countTasks(tasks: TaskSnapshot[], now = Date.now()): TaskCounts {
  const counts = { open: 0, overdue: 0, blocked: 0 };
  for (const task of tasks) {
    if (task.status === 'done') continue;
    counts.open++;
    if (task.status === 'blocked') counts.blocked++;
    if (task.deadline_utc && Date.parse(task.deadline_utc) < now) counts.overdue++;
  }
  return counts;
}

export interface MeetingListEntry extends MeetingEntry {
  counts: TaskCounts;
}

type ListRecord = MeetingRecord & { tasks: TaskSnapshot[] };

export async function loadMeetingList(workspaceId: string): Promise<MeetingListEntry[]> {
  // One workspace-scoped read for all counts works with the deployed schema and respects RLS.
  const { data, error } = await supabase.from('meetings')
    .select(`${meetingFields}, tasks(status, deadline_utc)`)
    .eq('workspace_id', workspaceId).eq('lifecycle', 'active').order('starts_at', { ascending: false })
    .returns<ListRecord[]>();
  if (error) throw error;
  const profiles = await getProfiles(data.flatMap((row) => [
    row.organiser_id, ...row.meeting_participants.flatMap((p) => p.user_id ? [p.user_id] : []),
  ]));
  return data.map((row) => ({ ...toEntry(row, profiles), counts: countTasks(row.tasks) }));
}

export async function loadMeeting(meetingId: string, userId: string) {
  const meetingResult = await supabase.from('meetings').select(meetingFields)
    .eq('id', meetingId).eq('lifecycle', 'active').returns<MeetingRecord[]>().maybeSingle();
  if (meetingResult.error) throw meetingResult.error;
  const row = meetingResult.data;
  if (!row) throw new Error('Meeting unavailable. Check the link or your workspace access.');

  const [membership, taskResult] = await Promise.all([
    supabase.from('workspace_members').select('role')
      .eq('workspace_id', row.workspace_id).eq('user_id', userId).maybeSingle(),
    supabase.from('tasks')
      .select('*, task_assignees(user_id, is_primary)')
      .eq('meeting_id', meetingId).order('created_at').returns<KanbanTaskItem[]>(),
  ]);
  if (membership.error) throw membership.error;
  if (taskResult.error) throw taskResult.error;
  const tasks = taskResult.data;
  const profiles = await getProfiles([
    row.organiser_id,
    ...row.meeting_participants.flatMap((p) => p.user_id ? [p.user_id] : []),
    ...tasks.flatMap((task) => (task.task_assignees || []).map((a) => a.user_id)),
  ]);
  return {
    meeting: toEntry(row, profiles),
    role: (membership.data?.role ?? null) as AppRole | null,
    tasks: tasks.map((task) => ({
      ...task, meetings: { id: row.id, title: row.title, starts_at: row.starts_at },
      task_assignees: task.task_assignees?.map((a) => ({ ...a, profiles: profiles.get(a.user_id) })),
    })),
  };
}

export function meetingDate(meeting: Pick<MeetingEntry, 'starts_at' | 'timezone'>) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short', timeZone: meeting.timezone,
  }).format(new Date(meeting.starts_at));
}

export function needsAttention(meeting: MeetingListEntry, canManage: boolean, now: number) {
  if (meeting.counts.overdue || meeting.counts.blocked) return true;
  if (!canManage) return false;
  return meeting.needsSpeakers || meeting.status === 'failed'
    || (meeting.ai_processing && meeting.pending > 0)
    || (meeting.status === 'draft' && (!meeting.transcripts || meeting.ai_processing) && Date.parse(meeting.starts_at) <= now);
}
