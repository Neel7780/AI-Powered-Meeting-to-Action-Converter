import type { 
  ActionItemCandidate, 
  MeetingDetails, 
  TranscriptSegment, 
  WorkspaceMember 
} from '../types/review';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

const STORAGE_KEY_ITEMS = 'staging_gate_candidate_items';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: unknown): val is string {
  return typeof val === 'string' && UUID_REGEX.test(val);
}

/** POST JSON or FormData to the FastAPI backend with the user's Supabase JWT; throws the backend's `detail` on failure. */
export async function postApi(path: string, body: unknown): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  const isForm = body instanceof FormData;
  const res = await fetch(getApiUrl(path), {
    method: 'POST',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
    },
    body: isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  let detailMsg = `HTTP ${res.status}`;
  if (typeof data.detail === 'string') {
    detailMsg = data.detail;
  } else if (Array.isArray(data.detail)) {
    detailMsg = data.detail
      .map((d: any) => {
        const field = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join('; ');
  } else if (typeof data.message === 'string') {
    detailMsg = data.message;
  }
  if (!res.ok) throw new Error(detailMsg);
  return data;
}

export const INITIAL_MEMBERS: WorkspaceMember[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    user_id: '00000000-0000-0000-0000-000000000001',
    full_name: 'Neel Khatri',
    email: 'neelkhatri7780@gmail.com',
    role: 'admin',
    initials: 'NK'
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    user_id: '00000000-0000-0000-0000-000000000002',
    full_name: 'Manali Malani',
    email: 'manali.malani@actionpulse.io',
    role: 'team_member',
    initials: 'MM'
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    user_id: '00000000-0000-0000-0000-000000000003',
    full_name: 'Krishna Parmar',
    email: 'krishna.parmar@actionpulse.io',
    role: 'meeting_organiser',
    initials: 'KP'
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    user_id: '00000000-0000-0000-0000-000000000004',
    full_name: 'Bhagy Parmar',
    email: 'bhagy.parmar@actionpulse.io',
    role: 'team_member',
    initials: 'BP'
  }
];

export const INITIAL_MEETING: MeetingDetails = {
  id: 'mtg-sprint-102',
  workspace_id: 'ws-team-10',
  title: 'Sprint 2 Architecture & AI Staging Review',
  date: '2026-10-11T10:00:00Z',
  timezone: 'Asia/Kolkata (IST)',
  duration: '42 mins',
  organiser_name: 'Madhav Chauhan',
  status: 'review_ready',
  candidate_count: 7
};

export const INITIAL_TRANSCRIPT_SEGMENTS: TranscriptSegment[] = [
  {
    id: 'seg-1',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 0,
    speaker_name: 'Madhav Chauhan',
    speaker_color: 'emerald',
    start_ms: 12000,
    end_ms: 35000,
    start_seconds: 12,
    timestamp: '00:12',
    text: "Alright team, welcome to our Sprint 2 architecture sync. Today we're reviewing the AI action item extraction pipeline and our staging gate workflow before tasks go directly to the Kanban board."
  },
  {
    id: 'seg-2',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 1,
    speaker_name: 'Arnav Pandita',
    speaker_color: 'indigo',
    start_ms: 75000,
    end_ms: 120000,
    start_seconds: 75,
    timestamp: '01:15',
    text: "Thanks Madhav. On FE 1 auth and workspace navigation, I have the login/signup and workspace switcher ready. However, we strictly need row-level security policies configured on Supabase so members can only read their workspace's meetings."
  },
  {
    id: 'seg-3',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 2,
    speaker_name: 'Madhav Chauhan',
    speaker_color: 'emerald',
    start_ms: 135000,
    end_ms: 155000,
    start_seconds: 135,
    timestamp: '02:15',
    text: "Agreed Arnav. Can you own the implementation of Supabase RLS security policies for workspace tables by October 14th?"
  },
  {
    id: 'seg-4',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 3,
    speaker_name: 'Arnav Pandita',
    speaker_color: 'indigo',
    start_ms: 160000,
    end_ms: 220000,
    start_seconds: 160,
    timestamp: '02:40',
    text: "Yes, I'll take that. I will write the migration scripts and test admin vs team_member permissions."
  },
  {
    id: 'seg-5',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 4,
    speaker_name: 'Bharat Odedara',
    speaker_color: 'blue',
    start_ms: 240000,
    end_ms: 320000,
    start_seconds: 240,
    timestamp: '04:00',
    text: "On the meeting ingestion side (FE 2), users can now upload transcripts. We support .vtt, .srt, .txt, and .docx formats following the storage path convention meeting-transcripts/{workspace_id}/{meeting_id}/{filename}."
  },
  {
    id: 'seg-6',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 5,
    speaker_name: 'Madhav Chauhan',
    speaker_color: 'emerald',
    start_ms: 340000,
    end_ms: 380000,
    start_seconds: 340,
    timestamp: '05:40',
    text: "Great progress Bharat. Make sure the drag-and-drop file uploader has instant upload feedback and error boundaries for unsupported mime types by October 15th."
  },
  {
    id: 'seg-7',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 6,
    speaker_name: 'Bharat Odedara',
    speaker_color: 'blue',
    start_ms: 390000,
    end_ms: 440000,
    start_seconds: 390,
    timestamp: '06:30',
    text: "Got it. Also, regarding the text paste tab, someone needs to sanitize user inputs in the multi-line paste widget to strip dangerous HTML and scripts before dispatching to the storage bucket."
  },
  {
    id: 'seg-8',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 7,
    speaker_name: 'Yuvraj Katara',
    speaker_color: 'purple',
    start_ms: 450000,
    end_ms: 530000,
    start_seconds: 450,
    timestamp: '07:30',
    text: "That paste sanitization is crucial. We should flag that as an unassigned action item for anyone on frontend to pick up by October 15th."
  },
  {
    id: 'seg-9',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 8,
    speaker_name: 'Yuvraj Katara',
    speaker_color: 'purple',
    start_ms: 552000,
    end_ms: 750000,
    start_seconds: 552,
    timestamp: '09:12',
    text: "For FE 3, the AI extraction trigger and status machine are wired up. But per CR-01 compliance, we must add the AI Attestation disclaimer banner stating: 'AI-generated suggestions. Verify before publishing.' across all review screens."
  },
  {
    id: 'seg-10',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 9,
    speaker_name: 'Madhav Chauhan',
    speaker_color: 'emerald',
    start_ms: 825000,
    end_ms: 1050000,
    start_seconds: 825,
    timestamp: '13:45',
    text: "Exactly. That leads right into FE 4: Meeting Review Workspace. The meeting organiser needs a two-column view where the transcript is clickable on the left, and candidate review cards sit on the right. Organisers can inline edit the title, description, and due date, pick an assignee, and hit [Approve], [Reject], or [Approve All]."
  },
  {
    id: 'seg-11',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 10,
    speaker_name: 'Harshil Patel',
    speaker_color: 'amber',
    start_ms: 1100000,
    end_ms: 1240000,
    start_seconds: 1100,
    timestamp: '18:20',
    text: "And once items are approved from the staging gate, they will flow into our FE 5 Kanban board. I'm building the 1-Tap WhatsApp share button that creates wa.me/?text=... prefilled URLs so assignees get instant mobile notifications."
  },
  {
    id: 'seg-12',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 11,
    speaker_name: 'Arnav Pandita',
    speaker_color: 'indigo',
    start_ms: 1265000,
    end_ms: 1350000,
    start_seconds: 1265,
    timestamp: '21:05',
    text: "I'll also define database triggers so whenever a candidate item is approved in FE 4, a corresponding row is inserted into the tasks table for the Kanban board."
  },
  {
    id: 'seg-13',
    transcript_id: 'tr-sprint-102',
    meeting_id: 'mtg-sprint-102',
    segment_index: 12,
    speaker_name: 'Madhav Chauhan',
    speaker_color: 'emerald',
    start_ms: 1380000,
    end_ms: 1450000,
    start_seconds: 1380,
    timestamp: '23:00',
    text: "Perfect. Let's make sure the staging gate interface shows the 'Assignee Required' badge whenever an item has no owner assigned, so no unfinished tasks slip onto the Kanban board without an owner."
  }
];

export const INITIAL_CANDIDATE_ITEMS: ActionItemCandidate[] = [
  {
    id: 'cand-001',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Implement Supabase RLS security policies for workspace tables',
    description: 'Ensure row-level security prevents cross-workspace tenant data access for meetings and action items. Test admin vs team member permissions.',
    due_date: '2026-10-14',
    assignee_id: 'mem-1',
    status: 'pending',
    confidence_score: 0.96,
    transcript_timestamp: '02:15',
    transcript_segment_id: 'seg-3',
    suggested_tags: ['Backend', 'Security', 'Supabase'],
    created_at: '2026-10-11T10:30:00Z',
    updated_at: '2026-10-11T10:30:00Z'
  },
  {
    id: 'cand-002',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Build drag-and-drop file uploader for .vtt and .docx transcripts',
    description: 'Implement direct Supabase Storage upload with instant feedback and proper file validation following the meeting-transcripts/{ws_id}/{mtg_id} path convention.',
    due_date: '2026-10-15',
    assignee_id: 'mem-2',
    status: 'pending',
    confidence_score: 0.92,
    transcript_timestamp: '05:40',
    transcript_segment_id: 'seg-6',
    suggested_tags: ['Frontend', 'Storage', 'FE-2'],
    created_at: '2026-10-11T10:31:00Z',
    updated_at: '2026-10-11T10:31:00Z'
  },
  {
    id: 'cand-003',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Sanitize user inputs in multi-line paste ingestion widget',
    description: 'Strip harmful scripts and format raw pasted text before saving to the storage bucket to avoid injection vulnerabilities.',
    due_date: '2026-10-15',
    assignee_id: null, // Unassigned to show "Assignee Required" badge!
    status: 'pending',
    confidence_score: 0.85,
    transcript_timestamp: '07:30',
    transcript_segment_id: 'seg-8',
    suggested_tags: ['Security', 'Sanitization'],
    created_at: '2026-10-11T10:32:00Z',
    updated_at: '2026-10-11T10:32:00Z'
  },
  {
    id: 'cand-004',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Implement CR-01 AI Attestation disclaimer banner',
    description: 'Add mandatory compliance notice: "AI-generated suggestions. Verify before publishing." prominently on candidate review screens.',
    due_date: '2026-10-16',
    assignee_id: null, // Unassigned to test owner selector dropdown!
    status: 'pending',
    confidence_score: 0.89,
    transcript_timestamp: '09:12',
    transcript_segment_id: 'seg-9',
    suggested_tags: ['Compliance', 'AI Safety'],
    created_at: '2026-10-11T10:33:00Z',
    updated_at: '2026-10-11T10:33:00Z'
  },
  {
    id: 'cand-005',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Design two-column staging gate review workspace with timestamps',
    description: 'Two-column layout connecting transcript segments with candidate cards. Supports inline title/desc/due date edits, owner selection, approve/reject buttons, and batch approve.',
    due_date: '2026-10-17',
    assignee_id: 'mem-4',
    status: 'pending',
    confidence_score: 0.98,
    transcript_timestamp: '13:45',
    transcript_segment_id: 'seg-10',
    suggested_tags: ['FE-4', 'Staging Gate', 'UX'],
    created_at: '2026-10-11T10:34:00Z',
    updated_at: '2026-10-11T10:34:00Z'
  },
  {
    id: 'cand-006',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Create WhatsApp 1-Tap sharing URL generator with title and due date',
    description: 'Format wa.me/?text=... prefilled link with task title, assignee name, and deadline for instant mobile dispatching.',
    due_date: '2026-10-18',
    assignee_id: 'mem-5',
    status: 'pending',
    confidence_score: 0.91,
    transcript_timestamp: '18:20',
    transcript_segment_id: 'seg-11',
    suggested_tags: ['FE-5', 'WhatsApp', 'Integration'],
    created_at: '2026-10-11T10:35:00Z',
    updated_at: '2026-10-11T10:35:00Z'
  },
  {
    id: 'cand-007',
    meeting_id: 'mtg-sprint-102',
    workspace_id: 'ws-team-10',
    title: 'Define database triggers for task status updates',
    description: 'Create Supabase trigger that copies approved candidate items into the main tasks table with status "To Do".',
    due_date: '2026-10-19',
    assignee_id: 'mem-1',
    status: 'pending',
    confidence_score: 0.94,
    transcript_timestamp: '21:05',
    transcript_segment_id: 'seg-12',
    suggested_tags: ['Database', 'Triggers', 'Postgres'],
    created_at: '2026-10-11T10:36:00Z',
    updated_at: '2026-10-11T10:36:00Z'
  }
];

function getStoredCandidateItems(): ActionItemCandidate[] {
  if (typeof window === 'undefined') return INITIAL_CANDIDATE_ITEMS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ITEMS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(INITIAL_CANDIDATE_ITEMS));
      return INITIAL_CANDIDATE_ITEMS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CANDIDATE_ITEMS;
  } catch (err) {
    console.error('Error reading candidate items from storage:', err);
    return INITIAL_CANDIDATE_ITEMS;
  }
}

function saveStoredCandidateItems(items: ActionItemCandidate[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  } catch (err) {
    console.error('Error saving candidate items to storage:', err);
  }
}

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
          duration: '45 mins',
          organiser_name: 'Organiser',
          status: data.status === 'ready' ? 'review_ready' : data.status,
          candidate_count: 0
        };
    }
    return INITIAL_MEETING;
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
    return INITIAL_TRANSCRIPT_SEGMENTS;
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
    return INITIAL_MEMBERS;
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

            return {
              id: item.id,
              meeting_id: item.meeting_id,
              title: item.task || item.source_excerpt || 'Action Item',
              description: item.source_excerpt || item.task || '',
              due_date: dueDate,
              extracted_due_date: dueDate,
              assignee_id: item.owner_user_id || assignee?.user_id || null,
              assignee,
              status,
              confidence_score: item.confidence !== null && item.confidence !== undefined ? Number(item.confidence) : 0.9,
              transcript_timestamp: timestamp,
              created_at: item.created_at,
              updated_at: item.updated_at
            };
        });
    }
    
    const items = getStoredCandidateItems().map(item => ({
      ...item,
      assignee: item.assignee_id ? members.find(m => m.id === item.assignee_id) || null : null
    }));
    return items;
  },

  async updateActionItem(
    itemId: string, 
    updates: Partial<ActionItemCandidate>
  ): Promise<ActionItemCandidate> {
    const items = getStoredCandidateItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) {
      throw new Error(`Action item candidate ${itemId} not found`);
    }

    const updated = {
      ...items[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    if (updates.assignee_id !== undefined) {
      updated.assignee = updates.assignee_id 
        ? INITIAL_MEMBERS.find(m => m.id === updates.assignee_id) || null 
        : null;
    }

    items[index] = updated;
    saveStoredCandidateItems(items);
    return updated;
  },

  /** Local edit only: extracted_items is backend-owned, edits are sent with the approve call. */
  async editActionItem(
    item: ActionItemCandidate,
    updates: Partial<ActionItemCandidate>,
    members: WorkspaceMember[]
  ): Promise<ActionItemCandidate> {
    if (!isSupabaseConfigured) return this.updateActionItem(item.id, updates);
    const updated = { ...item, ...updates, updated_at: new Date().toISOString() };
    if (updates.assignee_id !== undefined) {
      updated.assignee = members.find(m => m.user_id === updates.assignee_id) || null;
    }
    return updated;
  },

  /** Review gate: POST /api/meetings/{id}/approve (creates tasks + sends assignment emails). */
  async approveActionItems(meetingId: string, items: ActionItemCandidate[]): Promise<ActionItemCandidate[]> {
    if (!isSupabaseConfigured || !isValidUuid(meetingId) || items.some(i => !isValidUuid(i.id))) {
      return Promise.all(items.map(i => this.updateActionItem(i.id, { status: 'approved' })));
    }

    const payloadItems = items.map((i) => {
      const ownerId = isValidUuid(i.assignee_id) ? i.assignee_id : null;
      const payloadItem: Record<string, any> = {
        id: i.id,
        task: i.title,
        owner_user_id: ownerId,
      };

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
    if (!isSupabaseConfigured) return this.updateActionItem(item.id, { status: 'rejected' });
    await postApi(`/api/meetings/${meetingId}/reject`, { item_ids: [item.id] });
    return { ...item, status: 'rejected' };
  },

  async revertActionItem(itemId: string): Promise<ActionItemCandidate> {
    if (isSupabaseConfigured) throw new Error('Reviewed items are final');
    return this.updateActionItem(itemId, { status: 'pending' });
  },

  async resetToInitialData(): Promise<ActionItemCandidate[]> {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(INITIAL_CANDIDATE_ITEMS));
    }
    const members = INITIAL_MEMBERS;
    return INITIAL_CANDIDATE_ITEMS.map(item => ({
      ...item,
      assignee: item.assignee_id ? members.find(m => m.id === item.assignee_id) || null : null
    }));
  }
};
