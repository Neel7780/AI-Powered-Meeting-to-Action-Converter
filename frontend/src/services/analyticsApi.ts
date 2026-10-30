import { supabase } from '../lib/supabase';
import { getApiUrl } from '../lib/api';

export interface TaskStatusBreakdown {
  todo: number;
  in_progress: number;
  blocked: number;
  done: number;
  total: number;
}

export interface TaskPriorityBreakdown {
  urgent: number;
  high: number;
  normal: number;
  low: number;
}

export interface WorkspaceKpiSummary {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  currently_overdue: number;
  currently_blocked: number;
  on_time_completions: number;
  late_completions: number;
  on_time_completion_rate: number;
  avg_cycle_time_hours: number | null;
  status_breakdown: TaskStatusBreakdown;
  priority_breakdown: TaskPriorityBreakdown;
}

export interface BottleneckTask {
  task_id: string;
  title: string;
  status: string;
  priority: string;
  deadline_utc: string | null;
  blocked_by_id: string | null;
  blocked_by_title: string | null;
  assignee_name: string | null;
  days_open: number;
}

export interface MemberPerformanceItem {
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  total_assigned: number;
  completed_total: number;
  completed_on_time: number;
  completed_late: number;
  currently_overdue: number;
  in_progress: number;
  pending_todo: number;
  blocked: number;
  on_time_rate: number;
  avg_cycle_time_hours: number | null;
}

export interface MeetingYieldItem {
  meeting_id: string;
  meeting_title: string;
  starts_at: string | null;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
}

export interface WorkspaceAnalyticsResponse {
  workspace_id: string;
  user_role: string;
  timeframe: string;
  kpis: WorkspaceKpiSummary;
  bottlenecks: BottleneckTask[];
  meeting_yield: MeetingYieldItem[];
  member_evaluations: MemberPerformanceItem[] | null;
}

// Demo fallback data if backend is unreachable or empty
export const DEMO_ANALYTICS_DATA: WorkspaceAnalyticsResponse = {
  workspace_id: 'default-workspace',
  user_role: 'organiser',
  timeframe: '30d',
  kpis: {
    total_tasks: 14,
    completed_tasks: 9,
    completion_rate: 64.3,
    currently_overdue: 2,
    currently_blocked: 2,
    on_time_completions: 8,
    late_completions: 1,
    on_time_completion_rate: 88.9,
    avg_cycle_time_hours: 42.5,
    status_breakdown: {
      todo: 2,
      in_progress: 1,
      blocked: 2,
      done: 9,
      total: 14,
    },
    priority_breakdown: {
      urgent: 3,
      high: 5,
      normal: 4,
      low: 2,
    },
  },
  bottlenecks: [
    {
      task_id: 'b-1',
      title: 'Verify Brevo SMTP rate limit before staging automated daily digests',
      status: 'blocked',
      priority: 'high',
      deadline_utc: new Date(Date.now() - 86400000 * 1).toISOString(),
      blocked_by_id: 'b-2',
      blocked_by_title: 'Migrate PostgreSQL connection pool to Supabase transaction pooler',
      assignee_name: 'External SMTP Provider',
      days_open: 4,
    },
    {
      task_id: 'b-3',
      title: 'Deploy meeting-aware AI assistant model to Render',
      status: 'blocked',
      priority: 'urgent',
      deadline_utc: new Date(Date.now() + 86400000 * 2).toISOString(),
      blocked_by_id: 'b-2',
      blocked_by_title: 'Migrate PostgreSQL connection pool to Supabase transaction pooler',
      assignee_name: 'Neel Khatri',
      days_open: 2,
    },
  ],
  meeting_yield: [
    {
      meeting_id: 'm-1',
      meeting_title: 'Q3 Infra Architecture Sync',
      starts_at: new Date(Date.now() - 86400000 * 4).toISOString(),
      total_tasks: 6,
      completed_tasks: 4,
      completion_rate: 66.7,
    },
    {
      meeting_id: 'm-2',
      meeting_title: 'Weekly Sprint 1 Retrospective',
      starts_at: new Date(Date.now() - 86400000 * 8).toISOString(),
      total_tasks: 5,
      completed_tasks: 4,
      completion_rate: 80.0,
    },
    {
      meeting_id: 'm-3',
      meeting_title: 'Customer Feedback & Kanban Polish',
      starts_at: new Date(Date.now() - 86400000 * 12).toISOString(),
      total_tasks: 3,
      completed_tasks: 1,
      completion_rate: 33.3,
    },
  ],
  member_evaluations: [
    {
      user_id: 'u-1',
      display_name: 'Neel Khatri (Lead)',
      email: 'neel@actionpulse.io',
      avatar_url: null,
      role: 'admin',
      total_assigned: 5,
      completed_total: 4,
      completed_on_time: 4,
      completed_late: 0,
      currently_overdue: 0,
      in_progress: 1,
      pending_todo: 0,
      blocked: 0,
      on_time_rate: 100.0,
      avg_cycle_time_hours: 28.4,
    },
    {
      user_id: 'u-2',
      display_name: 'Kirtan Kamani',
      email: 'kirtan@actionpulse.io',
      avatar_url: null,
      role: 'organiser',
      total_assigned: 4,
      completed_total: 3,
      completed_on_time: 3,
      completed_late: 0,
      currently_overdue: 0,
      in_progress: 0,
      pending_todo: 1,
      blocked: 0,
      on_time_rate: 100.0,
      avg_cycle_time_hours: 32.1,
    },
    {
      user_id: 'u-3',
      display_name: 'Yuvraj',
      email: 'yuvraj@actionpulse.io',
      avatar_url: null,
      role: 'member',
      total_assigned: 3,
      completed_total: 1,
      completed_on_time: 1,
      completed_late: 0,
      currently_overdue: 1,
      in_progress: 0,
      pending_todo: 1,
      blocked: 1,
      on_time_rate: 100.0,
      avg_cycle_time_hours: 48.0,
    },
    {
      user_id: 'u-4',
      display_name: 'Manali Malani',
      email: 'manali@actionpulse.io',
      avatar_url: null,
      role: 'member',
      total_assigned: 2,
      completed_total: 1,
      completed_on_time: 0,
      completed_late: 1,
      currently_overdue: 1,
      in_progress: 0,
      pending_todo: 0,
      blocked: 1,
      on_time_rate: 0.0,
      avg_cycle_time_hours: 56.2,
    },
  ],
};

export async function fetchWorkspaceAnalytics(
  workspaceId: string,
  timeframe: string = '30d',
  meetingId?: string
): Promise<WorkspaceAnalyticsResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const queryParams = new URLSearchParams({ timeframe });
    if (meetingId) {
      queryParams.append('meeting_id', meetingId);
    }

    const endpoint = getApiUrl(`/api/workspaces/${workspaceId}/analytics?${queryParams.toString()}`);
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${res.status}`);
    }

    const data: WorkspaceAnalyticsResponse = await res.json();
    return data;
  } catch (err) {
    console.warn('Backend analytics fetch failed, providing structured demo preview:', err);
    return DEMO_ANALYTICS_DATA;
  }
}

