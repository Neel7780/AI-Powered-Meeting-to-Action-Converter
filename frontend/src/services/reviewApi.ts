import type { 
  ActionItemCandidate, 
  MeetingDetails, 
  TranscriptSegment, 
  WorkspaceMember,
  DraftFollowUpResponse,
  SendFollowUpResponse,
  FollowUpTone,
} from '../types/review';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { requestApi } from '../lib/api';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

export const postApi = (path: string, body: unknown): Promise<any> => requestApi(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) });
export const patchApi = (path: string, body: unknown): Promise<any> => requestApi(path, { method: 'PATCH', body: JSON.stringify(body) });

export const reviewApi = {
  async fetchMeetingDetails(meetingId: string): Promise<MeetingDetails> {
    if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('meetings')
          .select('*')
          .eq('id', meetingId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Meeting not found');
        return {
          id: data.id,
          workspace_id: data.workspace_id,
          title: data.title,
          date: data.starts_at || data.created_at,
          timezone: data.timezone || 'Asia/Kolkata',
          duration: 'Unavailable',
          organiser_name: 'Organiser',
          status: data.status === 'ready' ? 'review_ready' : data.status,
          candidate_count: 0
        };
    }
    throw new Error('Database is not configured.');
  },

  async fetchTranscript(meetingId: string): Promise<TranscriptSegment[]> {
    if (isSupabaseConfigured && supabase) {
        // Look up the transcript associated with this meeting
        const { data: transcript, error: tError } = await supabase
          .from('transcripts')
          .select('id')
          .eq('meeting_id', meetingId)
          .maybeSingle();
        if (tError) throw tError;
        if (transcript) {
          // Schema alignment: transcript_segments uses transcript_id, start_ms, and end_ms
          const { data: segments, error: sError } = await supabase
            .from('transcript_segments')
            .select('*')
            .eq('transcript_id', transcript.id)
            .order('segment_index', { ascending: true });

          if (sError) throw sError;
          if (segments && segments.length > 0) {
            return segments.map((seg) => {
              const startMs = Number(seg.start_ms || 0);
              const startSec = Math.floor(startMs / 1000);
              const mins = Math.floor(startSec / 60);
              const secs = startSec % 60;
              const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
              return {
                id: seg.id,
                transcript_id: seg.transcript_id,
                meeting_id: meetingId,
                segment_index: seg.segment_index,
                speaker_name: seg.speaker_name || 'Speaker',
                speaker_color: 'indigo',
                start_ms: seg.start_ms,
                end_ms: seg.end_ms,
                start_seconds: startSec,
                timestamp,
                text: seg.text
              };
            });
          }
        }
        return [];
    }
    throw new Error('Database is not configured.');
  },

  async fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('workspace_members')
          .select('role, user_id')
          .eq('workspace_id', workspaceId);
        if (error) throw error;
        if (!data?.length) return [];
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, email')
          .in('id', data.map(m => m.user_id));
        if (profileError) throw profileError;
        const byId = new Map((profiles || []).map(p => [p.id, p]));
        return data.map((m) => {
          const profile = byId.get(m.user_id);
          const name = profile?.display_name || profile?.email?.split('@')[0] || 'Member';
          const initials = name
            .split(' ')
            .map((p: string) => p[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
          return {
            id: m.user_id,
            user_id: m.user_id,
            full_name: name,
            email: profile?.email || '',
            role: m.role === 'admin' ? 'admin' : m.role === 'organiser' ? 'meeting_organiser' : 'team_member',
            initials
          };
        });
    }
    throw new Error('Database is not configured.');
  },

  async fetchActionItemCandidates(meetingId: string, members: WorkspaceMember[]): Promise<ActionItemCandidate[]> {
    // Schema alignment: Candidate items live in extracted_items
    if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from('extracted_items')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('type', 'action')
          .order('created_at', { ascending: true });

        if (error) throw error;
        return (data || []).map((item: any) => {
            const startMs = item.source_start_ms ? Number(item.source_start_ms) : 0;
            const startSec = Math.floor(startMs / 1000);
            const mins = Math.floor(startSec / 60);
            const secs = startSec % 60;
            const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            let status: ActionItemCandidate['status'] = 'pending';
            if (item.review_status === 'approved') status = 'approved';
            else if (item.review_status === 'rejected') status = 'rejected';

            const assignee = members.find(m => m.user_id === item.owner_user_id || m.id === item.owner_user_id) || null;
            const dueDate = item.deadline_utc
              ? new Intl.DateTimeFormat('sv-SE', { timeZone: item.deadline_timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.deadline_utc))
              : null;

            let blockedById: string | null = null;
            if (typeof item.rejection_reason === 'string' && item.rejection_reason.startsWith('depends_on:')) {
              blockedById = item.rejection_reason.split('depends_on:')[1]?.trim() || null;
            }

            return {
              id: item.id,
              meeting_id: item.meeting_id,
              title: item.task || item.source_excerpt || 'Action Item',
              description: item.source_excerpt || item.task || '',
              due_date: dueDate,
              extracted_due_date: dueDate,
              assignee_id: item.owner_user_id || assignee?.user_id || null,
              assignee,
              blocked_by_id: blockedById,
              status,
              confidence_score: item.confidence !== null && item.confidence !== undefined ? Number(item.confidence) : null,
              transcript_timestamp: timestamp,
              created_at: item.created_at,
              updated_at: item.updated_at
            };
        });
    }
    
    throw new Error('Database is not configured.');
  },

  /** Local edit only: extracted_items is backend-owned, edits are sent with the approve call. */
  async editActionItem(
    item: ActionItemCandidate,
    updates: Partial<ActionItemCandidate>,
    members: WorkspaceMember[]
  ): Promise<ActionItemCandidate> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured.');
    const updated = { ...item, ...updates, updated_at: new Date().toISOString() };
    if (updates.assignee_id !== undefined) {
      updated.assignee = members.find(m => m.user_id === updates.assignee_id) || null;
    }
    return updated;
  },

  /** Review gate: POST /api/meetings/{id}/approve (creates tasks + sends assignment emails). */
  async approveActionItems(meetingId: string, items: ActionItemCandidate[]): Promise<ActionItemCandidate[]> {
    if (!isSupabaseConfigured || !isValidUuid(meetingId) || items.some(i => !isValidUuid(i.id))) {
      throw new Error('A configured database and valid meeting/candidate IDs are required.');
    }

    const payloadItems = items.map((i) => {
      const ownerId = isValidUuid(i.assignee_id) ? i.assignee_id : null;
      const payloadItem: Record<string, any> = {
        id: i.id,
        task: i.title,
        owner_user_id: ownerId,
      };

      if (isValidUuid(i.blocked_by_id)) {
        payloadItem.blocked_by_id = i.blocked_by_id;
      }
      if (i.execution_type) {
        payloadItem.execution_type = i.execution_type;
      }

      if (i.due_date !== i.extracted_due_date) {
        if (i.due_date) {
          payloadItem.deadline_date = i.due_date;
          try {
            const d = new Date(i.due_date.includes('T') ? i.due_date : `${i.due_date}T23:59:59Z`);
            if (!isNaN(d.getTime())) {
              payloadItem.deadline_utc = d.toISOString();
            }
          } catch {
            // ignore unparseable date
          }
        } else {
          payloadItem.deadline_date = null;
          payloadItem.deadline_utc = null;
        }
      }

      return payloadItem;
    });

    await postApi(`/api/meetings/${meetingId}/approve`, {
      items: payloadItems,
    });
    return items.map(i => ({ ...i, status: 'approved' as const }));
  },

  async rejectActionItem(meetingId: string, item: ActionItemCandidate): Promise<ActionItemCandidate> {
    if (!isSupabaseConfigured) throw new Error('Database is not configured.');
    await postApi(`/api/meetings/${meetingId}/reject`, { item_ids: [item.id] });
    return { ...item, status: 'rejected' };
  },

  async updateTaskDependency(
    workspaceId: string,
    taskId: string,
    blockedById: string | null,
    executionType?: 'human' | 'agent'
  ): Promise<any> {
    if (!isSupabaseConfigured || !isValidUuid(workspaceId) || !isValidUuid(taskId)) {
      throw new Error('A configured database and valid workspace/task IDs are required.');
    }
    return patchApi(`/api/workspaces/${workspaceId}/tasks/${taskId}/dependency`, {
      blocked_by: isValidUuid(blockedById) ? blockedById : null,
      execution_type: executionType || null,
    });
  },

  async updateTaskStatus(
    workspaceId: string,
    taskId: string,
    status: string
  ): Promise<any> {
    if (!isSupabaseConfigured || !isValidUuid(workspaceId) || !isValidUuid(taskId)) {
      throw new Error('A configured database and valid workspace/task IDs are required.');
    }
    return patchApi(`/api/workspaces/${workspaceId}/tasks/${taskId}/status`, { status });
  },

  async draftFollowUp(meetingId: string, options?: { targetUserId?: string | null; targetName?: string | null; tone?: FollowUpTone }): Promise<DraftFollowUpResponse> {
    return postApi(`/api/meetings/${meetingId}/draft-followup`, {
      target_user_id: options?.targetUserId || null, target_name: options?.targetName || null, tone: options?.tone || 'executive'
    });
  },
  async sendFollowUp(meetingId: string, payload: { recipient_emails: string[]; subject: string; content_markdown: string; content_html?: string }): Promise<SendFollowUpResponse> {
    return postApi(`/api/meetings/${meetingId}/send-followup`, payload);
  }
};
