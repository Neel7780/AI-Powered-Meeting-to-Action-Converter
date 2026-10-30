"""Pydantic schemas for Workspace Analytics (Sprint 2 - Task 7).

Includes workspace-level progress, duration metrics, bottleneck analysis,
and role-restricted employee performance evaluations.
"""

from datetime import datetime

from pydantic import BaseModel, Field


class TaskStatusBreakdown(BaseModel):
    todo: int = 0
    in_progress: int = 0
    blocked: int = 0
    done: int = 0
    total: int = 0


class TaskPriorityBreakdown(BaseModel):
    urgent: int = 0
    high: int = 0
    normal: int = 0
    low: int = 0


class WorkspaceKpiSummary(BaseModel):
    total_tasks: int = 0
    completed_tasks: int = 0
    completion_rate: float = Field(0.0, description="Percentage of completed tasks (0.0 to 100.0)")
    currently_overdue: int = 0
    currently_blocked: int = 0
    on_time_completions: int = 0
    late_completions: int = 0
    on_time_completion_rate: float = Field(0.0, description="Percentage of completions that met deadline")
    avg_cycle_time_hours: float | None = Field(None, description="Average hours from creation to completion")
    status_breakdown: TaskStatusBreakdown = Field(default_factory=TaskStatusBreakdown)
    priority_breakdown: TaskPriorityBreakdown = Field(default_factory=TaskPriorityBreakdown)


class BottleneckTask(BaseModel):
    task_id: str
    title: str
    status: str
    priority: str
    deadline_utc: datetime | None = None
    blocked_by_id: str | None = None
    blocked_by_title: str | None = None
    assignee_name: str | None = None
    days_open: int = 0


class MemberPerformanceItem(BaseModel):
    user_id: str
    display_name: str
    email: str
    avatar_url: str | None = None
    role: str
    total_assigned: int = 0
    completed_total: int = 0
    completed_on_time: int = 0
    completed_late: int = 0
    currently_overdue: int = 0
    in_progress: int = 0
    pending_todo: int = 0
    blocked: int = 0
    on_time_rate: float = Field(0.0, description="Percentage of tasks completed on-time (0.0 to 100.0)")
    avg_cycle_time_hours: float | None = None


class MeetingYieldItem(BaseModel):
    meeting_id: str
    meeting_title: str
    starts_at: datetime | None = None
    total_tasks: int = 0
    completed_tasks: int = 0
    completion_rate: float = 0.0


class WorkspaceAnalyticsResponse(BaseModel):
    workspace_id: str
    user_role: str
    timeframe: str
    kpis: WorkspaceKpiSummary
    bottlenecks: list[BottleneckTask]
    meeting_yield: list[MeetingYieldItem]
    # Sensitive evaluation: populated ONLY for admin / organiser roles
    member_evaluations: list[MemberPerformanceItem] | None = Field(
        None,
        description="Employee performance evaluations. Restricted to workspace admin and organiser roles."
    )
