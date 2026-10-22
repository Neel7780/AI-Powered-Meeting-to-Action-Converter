export interface MeetingChapter {
  id: string;
  title: string;
  timestamp: string; // e.g. "20:47"
  start_seconds: number;
  duration_seconds: number;
  duration_str: string;
  summary: string;
  speakers: string[];
  key_points: string[];
  action_item_ids: string[];
  decision_count: number;
}

export interface SummaryDecision {
  id: string;
  text: string;
  timestamp: string;
  speaker: string;
  segment_id?: string;
  excerpt?: string;
}

export interface SummaryDiscussionPoint {
  topic: string;
  points: string[];
  timestamp?: string;
  speakers?: string[];
}

export interface MeetingSummaryData {
  overview: string;
  key_discussion_points: SummaryDiscussionPoint[];
  decisions: SummaryDecision[];
  outcomes: string[];
  next_steps: string[];
  speaker_insights: Array<{
    speaker: string;
    talk_percentage: number;
    duration_min: number;
    key_contribution: string;
  }>;
  generated_at: string;
  model_used: string;
}

export interface TimelineTrackSegment {
  start_pct: number;
  width_pct: number;
  start_seconds: number;
  end_seconds: number;
  speaker: string;
}

export interface SpeakerTimelineTrack {
  speaker: string;
  role?: string;
  avatar?: string;
  percentage: number;
  duration_min: number;
  color: 'emerald' | 'purple' | 'cyan' | 'blue' | 'amber';
  segments: TimelineTrackSegment[];
}

export interface TimelineEventItem {
  id: string;
  type: 'comment' | 'clip' | 'action_item' | 'decision';
  timestamp: string;
  seconds: number;
  percentage: number;
  author?: string;
  text: string;
}

export interface MeetingComment {
  id: string;
  author: string;
  avatar: string;
  timestamp: string;
  seconds: number;
  text: string;
}

export interface MeetingClip {
  id: string;
  title: string;
  start_timestamp: string;
  end_timestamp: string;
  start_seconds: number;
  end_seconds: number;
  speaker: string;
  tag: string;
}

export interface MeetingTracker {
  keyword: string;
  category: 'feature' | 'decision' | 'blocker' | 'architecture';
  occurrences: number;
  timestamps: string[];
}

export interface MeetingMetricsData {
  total_duration_str: string;
  total_duration_seconds: number;
  pacing_wpm: number;
  sentiment_score: string;
  action_items_count: number;
  decisions_count: number;
  questions_count: number;
  speaker_talk_ratios: Array<{ speaker: string; percentage: number; minutes: number }>;
}

export interface RichMeetingDetails {
  id: string;
  title: string;
  workspace_name: string;
  workspace_id: string;
  breadcrumb: string[];
  date_formatted: string;
  tags: string[];
  total_duration_seconds: number;
  total_duration_formatted: string;
  participants: Array<{
    name: string;
    initials: string;
    avatar?: string;
    role: string;
    online: boolean;
  }>;
  summary: MeetingSummaryData;
  chapters: MeetingChapter[];
  speaker_tracks: SpeakerTimelineTrack[];
  comments: MeetingComment[];
  clips: MeetingClip[];
  trackers: MeetingTracker[];
  metrics: MeetingMetricsData;
}
