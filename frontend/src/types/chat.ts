export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: ChatCitation[];
  suggestedFollowups?: string[];
  contextCount?: number;
}

export interface ChatCitation {
  source_type: 'meeting' | 'transcript' | 'decision' | 'action' | 'task';
  meeting_id?: string | null;
  meeting_title?: string | null;
  task_id?: string | null;
  task_title?: string | null;
  task_status?: 'todo' | 'in_progress' | 'blocked' | 'done' | string | null;
  speaker?: string | null;
  excerpt: string;
}

export interface ChatRequestPayload {
  workspace_id: string;
  meeting_id?: string | null;
  query: string;
  history?: Array<{ role: string; content: string }>;
}

export interface ChatApiResponse {
  answer: string;
  citations: ChatCitation[];
  suggested_followups: string[];
  meeting_context_count: number;
}

export interface MeetingOption {
  id: string;
  title: string;
  starts_at: string;
  status: string;
}
