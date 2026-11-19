"""Pydantic schemas for Candidate Items Review and Approval API (BE-4)."""

from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ApproveItemUpdate(BaseModel):
    id: UUID = Field(..., description="ID of the extracted_items candidate to approve")
    task: str | None = Field(default=None, min_length=1, max_length=500, description="Edited task description. If omitted, retains extracted value")
    owner_user_id: UUID | None = Field(
        default=None, description="Assigned workspace member UUID. Null clears the owner"
    )
    deadline_utc: datetime | None = Field(default=None, description="Explicit deadline in UTC")
    deadline_date: date | None = Field(default=None, description="Edited due date in the meeting timezone; null clears it")
    priority: Literal["low", "normal", "high", "urgent"] | None = Field(
        default=None, description="Task priority (low, normal, high, urgent)"
    )
    blocked_by_id: UUID | None = Field(
        default=None, description="Prerequisite candidate item UUID or existing task UUID"
    )
    execution_type: Literal["human"] | None = Field(
        default=None, description="Manual team task; automatic execution is unavailable"
    )


    @model_validator(mode="after")
    def valid_edits(self):
        if "task" in self.model_fields_set and (self.task is None or not self.task.strip()):
            raise ValueError("Task description cannot be blank")
        if "priority" in self.model_fields_set and self.priority is None:
            raise ValueError("Priority cannot be null")
        return self


class ApproveRequest(BaseModel):
    items: list[ApproveItemUpdate] = Field(..., min_length=1, description="List of candidate items to approve")


    @model_validator(mode="after")
    def unique_items(self):
        if len({item.id for item in self.items}) != len(self.items):
            raise ValueError("Candidate IDs must be unique")
        return self


class ApproveResponse(BaseModel):
    approved: int
    task_ids: list[UUID]


class RejectRequest(BaseModel):
    item_ids: list[UUID] = Field(..., min_length=1, description="List of candidate item IDs to reject")
    reason: str | None = Field(default=None, max_length=500, description="Optional rejection rationale")


class RejectResponse(BaseModel):
    rejected: int
