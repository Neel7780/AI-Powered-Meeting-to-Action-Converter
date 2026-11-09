"""Pydantic schemas for Sprint Velocity & Meeting Progress Diff (Sprint 3)."""

from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class DiffTaskSchema(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    status: str
    priority: str
    deadline_utc: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime
    blocked_by: UUID | None = None
    blocked_by_title: str | None = None
    assignee_name: str | None = None
    execution_type: str | None = None
    source_excerpt: str | None = None
    meeting_id: UUID
    meeting_title: str | None = None
    spillover_count: int = 0


class MeetingBriefSchema(BaseModel):
    id: UUID
    title: str
    starts_at: datetime | None = None
    total_tasks: int = 0
    completed_tasks: int = 0
    spillover_tasks: int = 0
    velocity_rate: float = 0.0


class MeetingDiffSchema(BaseModel):
    base_meeting_id: UUID
    base_meeting_title: str
    current_meeting_id: UUID
    current_meeting_title: str
    completed_tasks: list[DiffTaskSchema]
    carried_over_tasks: list[DiffTaskSchema]
    new_action_items: list[DiffTaskSchema]
    velocity_score: float = 0.0
    spillover_rate: float = 0.0
    days_between_meetings: int = 1


class VelocityTrendSchema(BaseModel):
    meeting_id: UUID
    meeting_title: str
    date_label: str
    planned_tasks: int = 0
    completed_tasks: int = 0
    carried_over: int = 0
    velocity_percentage: float = 0.0


class SprintVelocityResponse(BaseModel):
    workspace_id: UUID
    available_meetings: list[MeetingBriefSchema]
    selected_diff: MeetingDiffSchema | None = None
    trend_history: list[VelocityTrendSchema]
    chronic_spillovers: list[DiffTaskSchema]
    average_velocity: float = 0.0
    overall_spillover_rate: float = 0.0
    total_completed_tasks: int = 0

