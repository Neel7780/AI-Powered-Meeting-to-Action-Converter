import { requestApi } from '../lib/api';

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

export function fetchWorkspaceAnalytics(
  workspaceId: string,
  timeframe: string = '30d',
  meetingId?: string,
): Promise<WorkspaceAnalyticsResponse> {
  const query = new URLSearchParams({ timeframe });
  if (meetingId) query.set('meeting_id', meetingId);
  return requestApi<WorkspaceAnalyticsResponse>(`/api/workspaces/${workspaceId}/analytics?${query}`);
}
