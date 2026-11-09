export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done';

export interface DiffTaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  deadline_utc?: string | null;
  completed_at?: string | null;
  created_at: string;
  blocked_by?: string | null;
  blocked_by_title?: string | null;
  assignee_name?: string | null;
  assignee_avatar?: string | null;
  execution_type?: 'human' | 'agent';
  source_excerpt?: string;
  meeting_id: string;
  meeting_title?: string;
  spillover_count?: number; // How many meetings this task has rolled over
}

export interface MeetingSummaryBrief {
  id: string;
  title: string;
  starts_at: string;
  total_tasks: number;
  completed_tasks: number;
  spillover_tasks: number;
  velocity_rate: number; // percentage (0-100)
}

export interface MeetingProgressDiff {
  base_meeting: {
    id: string;
    title: string;
    starts_at: string;
  };
  current_meeting: {
    id: string;
    title: string;
    starts_at: string;
  };
  completed_tasks: DiffTaskItem[]; // Tasks from base meeting completed before or during current meeting
  carried_over_tasks: DiffTaskItem[]; // Tasks from base meeting still open
  new_action_items: DiffTaskItem[]; // Tasks created in current meeting
  velocity_score: number; // % of base tasks completed
  spillover_rate: number; // % of base tasks carried over
  days_between_meetings: number;
}

export interface VelocityTrendPoint {
  meeting_id: string;
  meeting_title: string;
  date_label: string;
  planned_tasks: number;
  completed_tasks: number;
  carried_over: number;
  velocity_percentage: number;
  avg_cycle_days?: number;
}

export interface SprintVelocityData {
  workspace_id: string;
  available_meetings: MeetingSummaryBrief[];
  selected_diff: MeetingProgressDiff | null;
  trend_history: VelocityTrendPoint[];
  chronic_spillovers: DiffTaskItem[];
  kpis: {
    average_velocity: number;
    overall_spillover_rate: number;
    total_meetings_analyzed: number;
    total_completed_tasks: number;
    avg_turnaround_days: number;
  };
}

