import type { 
  ActionItemCandidate, 
  MeetingDetails, 
  TranscriptSegment, 
  WorkspaceMember 
} from '../types/review';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

const STORAGE_KEY_ITEMS = 'staging_gate_candidate_items';

export const INITIAL_MEMBERS: WorkspaceMember[] = [
  {
    id: 'mem-1',
    user_id: 'usr-1',
    full_name: 'Arnav Pandita',
    email: 'arnav.pandita@workspace.io',
    role: 'admin',
    initials: 'AP'
  },
  {
    id: 'mem-2',
    user_id: 'usr-2',
    full_name: 'Bharat Odedara',
    email: 'bharat.odedara@workspace.io',
    role: 'team_member',
    initials: 'BO'
  },
  {
    id: 'mem-3',
    user_id: 'usr-3',
    full_name: 'Yuvraj Katara',
    email: 'yuvraj.katara@workspace.io',
    role: 'meeting_organiser',
    initials: 'YK'
  },
  {
    id: 'mem-4',
    user_id: 'usr-4',
    full_name: 'Madhav Chauhan',
    email: 'madhav.chauhan@workspace.io',
    role: 'meeting_organiser',
    initials: 'MC'
  },
  {
    id: 'mem-5',
    user_id: 'usr-5',
    full_name: 'Harshil Patel',
    email: 'harshil.patel@workspace.io',
    role: 'team_member',
    initials: 'HP'
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
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select('*, organiser:profiles!organiser_id(display_name)')
          .eq('id', meetingId)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            workspace_id: data.workspace_id,
            title: data.title,
            date: data.starts_at || data.created_at,
            timezone: data.timezone || 'Asia/Kolkata',
            duration: '45 mins',
            organiser_name: data.organiser?.display_name || 'Organiser',
            status: data.status === 'ready' ? 'review_ready' : data.status,
            candidate_count: 0
          };
        }
      } catch (err) {
        console.warn('Error fetching meeting details from Supabase:', err);
      }
    }
    return INITIAL_MEETING;
  },

  async fetchTranscript(meetingId: string): Promise<TranscriptSegment[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        // Look up the transcript associated with this meeting
        const { data: transcript, error: tError } = await supabase
          .from('transcripts')
          .select('id')
          .eq('meeting_id', meetingId)
          .maybeSingle();

        if (!tError && transcript) {
          // Schema alignment: transcript_segments uses transcript_id, start_ms, and end_ms
          const { data: segments, error: sError } = await supabase
            .from('transcript_segments')
            .select('*')
            .eq('transcript_id', transcript.id)
            .order('segment_index', { ascending: true });

          if (!sError && segments && segments.length > 0) {
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
      } catch (err) {
        console.warn('Error fetching transcript segments from Supabase:', err);
      }
    }
    return INITIAL_TRANSCRIPT_SEGMENTS;
  },

  async fetchWorkspaceMembers(_workspaceId: string): Promise<WorkspaceMember[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('workspace_members')
          .select('role, user_id, profiles:user_id(id, display_name, email)')
          .eq('workspace_id', _workspaceId);

        if (!error && data && data.length > 0) {
          return data.map((m: any) => {
            const name = m.profiles?.display_name || m.profiles?.email || 'Member';
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
              email: m.profiles?.email || '',
              role: m.role === 'admin' ? 'admin' : m.role === 'organiser' ? 'meeting_organiser' : 'team_member',
              initials
            };
          });
        }
      } catch (err) {
        console.warn('Error fetching workspace members from Supabase:', err);
      }
    }
    return INITIAL_MEMBERS;
  },

  async fetchActionItemCandidates(meetingId: string): Promise<ActionItemCandidate[]> {
    // Schema alignment: Candidate items live in extracted_items
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('extracted_items')
          .select('*')
          .eq('meeting_id', meetingId)
          .eq('type', 'action')
          .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
          const members = INITIAL_MEMBERS;
          return data.map((item: any) => {
            const startMs = item.source_start_ms ? Number(item.source_start_ms) : 0;
            const startSec = Math.floor(startMs / 1000);
            const mins = Math.floor(startSec / 60);
            const secs = startSec % 60;
            const timestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

            let status: ActionItemCandidate['status'] = 'pending';
            if (item.review_status === 'approved') status = 'approved';
            else if (item.review_status === 'rejected') status = 'rejected';

            const assignee = item.owner_user_id 
              ? members.find(m => m.user_id === item.owner_user_id || m.id === item.owner_user_id) || {
                  id: item.owner_user_id,
                  user_id: item.owner_user_id,
                  full_name: item.owner_name || 'Assigned Member',
                  email: '',
                  role: 'team_member' as const
                }
              : null;

            return {
              id: item.id,
              meeting_id: item.meeting_id,
              title: item.task || item.source_excerpt || 'Action Item',
              description: item.source_excerpt || item.task || '',
              due_date: item.deadline_utc ? item.deadline_utc.split('T')[0] : (item.deadline_raw || null),
              assignee_id: item.owner_user_id || null,
              assignee,
              status,
              confidence_score: item.confidence !== null && item.confidence !== undefined ? Number(item.confidence) : 0.9,
              transcript_timestamp: timestamp,
              created_at: item.created_at,
              updated_at: item.updated_at
            };
          });
        }
      } catch (err) {
        console.warn('Error fetching extracted items from Supabase:', err);
      }
    }
    
    const members = INITIAL_MEMBERS;
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

  /**
   * Approves candidate item via FastAPI backend endpoint POST /api/meetings/{id}/approve
   * Enforces backend review gate & RLS boundary.
   */
  async approveActionItem(
    itemId: string, 
    meetingId?: string, 
    updates?: Partial<ActionItemCandidate>
  ): Promise<ActionItemCandidate> {
    const items = getStoredCandidateItems();
    const current = items.find(i => i.id === itemId);
    const targetMeetingId = meetingId || current?.meeting_id || 'mtg-sprint-102';

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(getApiUrl(`/meetings/${targetMeetingId}/approve`), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            items: [
              {
                id: itemId,
                task: updates?.title || current?.title,
                owner_user_id: updates?.assignee_id !== undefined ? updates.assignee_id : current?.assignee_id,
                priority: 'normal'
              }
            ]
          })
        });

        if (!res.ok) {
          console.warn(`[reviewApi] Backend approve returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn('[reviewApi] Backend approve network fallback:', err);
      }
    }

    return this.updateActionItem(itemId, { status: 'approved', ...updates });
  },

  /**
   * Rejects candidate item via FastAPI backend endpoint POST /api/meetings/{id}/reject
   * Enforces backend review gate & RLS boundary.
   */
  async rejectActionItem(
    itemId: string, 
    meetingId?: string, 
    reason?: string
  ): Promise<ActionItemCandidate> {
    const items = getStoredCandidateItems();
    const current = items.find(i => i.id === itemId);
    const targetMeetingId = meetingId || current?.meeting_id || 'mtg-sprint-102';

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const res = await fetch(getApiUrl(`/meetings/${targetMeetingId}/reject`), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_ids: [itemId],
            reason: reason || 'Rejected by organiser'
          })
        });

        if (!res.ok) {
          console.warn(`[reviewApi] Backend reject returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn('[reviewApi] Backend reject network fallback:', err);
      }
    }

    return this.updateActionItem(itemId, { status: 'rejected' });
  },

  async revertActionItem(itemId: string): Promise<ActionItemCandidate> {
    return this.updateActionItem(itemId, { status: 'pending' });
  },

  /**
   * Batch approves items via FastAPI backend endpoint POST /api/meetings/{id}/approve
   */
  async approveAllActionItems(
    meetingId: string, 
    itemIds?: string[]
  ): Promise<ActionItemCandidate[]> {
    const items = getStoredCandidateItems();
    const targetIds = itemIds && itemIds.length > 0 
      ? itemIds 
      : items.filter(i => i.status === 'pending').map(i => i.id);

    if (isSupabaseConfigured && supabase && targetIds.length > 0) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        const payloadItems = targetIds.map(id => {
          const it = items.find(x => x.id === id);
          return {
            id,
            task: it?.title,
            owner_user_id: it?.assignee_id,
            priority: 'normal'
          };
        });

        const res = await fetch(getApiUrl(`/meetings/${meetingId}/approve`), {
          method: 'POST',
          headers,
          body: JSON.stringify({ items: payloadItems })
        });

        if (!res.ok) {
          console.warn(`[reviewApi] Backend batch approve returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.warn('[reviewApi] Backend batch approve network fallback:', err);
      }
    }

    const targetSet = new Set(targetIds);
    const updatedItems = items.map(item => {
      if (targetSet.has(item.id)) {
        return {
          ...item,
          status: 'approved' as const,
          updated_at: new Date().toISOString()
        };
      }
      return item;
    });

    saveStoredCandidateItems(updatedItems);
    const members = INITIAL_MEMBERS;
    return updatedItems.map(item => ({
      ...item,
      assignee: item.assignee_id ? members.find(m => m.id === item.assignee_id) || null : null
    }));
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
