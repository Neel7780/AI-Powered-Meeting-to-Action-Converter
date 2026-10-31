export type UserRole = 'admin' | 'meeting_organiser' | 'team_member';

export interface WorkspaceMember {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  initials?: string;
}

export interface TranscriptSegment {
  id: string;
  transcript_id?: string;
  meeting_id?: string;
  segment_index?: number;
  speaker_name: string;
  speaker_color?: string;
  start_ms?: number | null;
  end_ms?: number | null;
  start_seconds: number;
  timestamp: string; // e.g. "02:14"
  text: string;
}

export type ActionItemStatus = 'pending' | 'approved' | 'rejected';

export interface ActionItemCandidate {
  id: string;
  meeting_id: string;
  workspace_id?: string;
  title: string;
  description: string;
  due_date: string | null; // ISO YYYY-MM-DD
  assignee_id: string | null;
  assignee?: WorkspaceMember | null;
  status: ActionItemStatus;
  confidence_score: number; // 0.0 to 1.0 (e.g. 0.95 for 95%)
  transcript_timestamp: string; // e.g. "04:15"
  transcript_segment_id?: string;
  suggested_tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface MeetingDetails {
  id: string;
  workspace_id: string;
  title: string;
  date: string;
  timezone: string;
  duration: string;
  organiser_name: string;
  status: 'draft' | 'extracting' | 'review_ready' | 'completed';
  candidate_count: number;
}


export type FollowUpTone = 'executive' | 'action_focused' | 'chat';

export interface FollowUpParticipant {
  user_id?: string | null;
  name: string;
  email?: string | null;
  is_organiser: boolean;
  task_count: number;
}

export interface DraftFollowUpResponse {
  meeting_id: string;
  meeting_title: string;
  target_user_id?: string | null;
  target_name?: string | null;
  tone: FollowUpTone;
  subject: string;
  content_markdown: string;
  content_html: string;
  whatsapp_share_url: string;
  recipient_emails: string[];
  participants: FollowUpParticipant[];
}

export interface SendFollowUpResponse {
  success: boolean;
  recipients_count: number;
  message: string;
  failed_recipients?: string[];
}
