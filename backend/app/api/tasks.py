"""Tasks mutation and dependency router (Sprint 2 - Task 6).

Provides authorized backend endpoints for managing task dependencies,
circular dependency validation, and workflow state transitions.
"""

import logging
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, get_current_user, require_role
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

router = APIRouter()


class TaskDependencyUpdateRequest(BaseModel):
    blocked_by: UUID | None = Field(default=None, description="Prerequisite task UUID; null removes dependency")
    execution_type: Literal["human", "agent"] | None = Field(
        default=None, description="Execution routing: human team member or automated AI agent"
    )


class TaskDependencyUpdateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    blocked_by: UUID | None
    status: str
    execution_type: str | None = None
    updated_at: str


@router.patch(
    "/{workspace_id}/tasks/{task_id}/dependency",
    response_model=TaskDependencyUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update task prerequisite dependency and execution mode with cycle prevention"
)
def update_task_dependency(
    workspace_id: UUID,
    task_id: UUID,
    payload: TaskDependencyUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskDependencyUpdateResponse:
    """Update task dependency in the workspace.

    Verifies workspace membership, checks that both tasks belong to the same workspace,
    prevents circular dependency chains, and automatically synchronizes task status:
    - If blocked_by is set to a task not yet 'done', marks this task as 'blocked'.
    - If blocked_by is cleared (or the prerequisite is already 'done'), restores to 'todo' if previously blocked.
    """
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    # 1. Fetch target task
    target_resp = (
        client.table("tasks")
        .select("id, workspace_id, status, blocked_by, external_owner_label")
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not target_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace"
        )
    target_task = target_resp.data[0]

    blocked_by_id = payload.blocked_by
    new_status = target_task.get("status", "todo")

    # 2. If a prerequisite is provided, validate it
    if blocked_by_id:
        if blocked_by_id == task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A task cannot depend on itself"
            )

        prereq_resp = (
            client.table("tasks")
            .select("id, workspace_id, status, blocked_by")
            .eq("id", str(blocked_by_id))
            .eq("workspace_id", str(workspace_id))
            .execute()
        )
        if not prereq_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prerequisite task not found in this workspace"
            )
        prereq_task = prereq_resp.data[0]

        # Prevent circular dependency (prerequisite depending on target)
        if prereq_task.get("blocked_by") == str(task_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular dependency detected: the selected prerequisite already depends on this task"
            )

        # Transitive cycle check
        visited = {str(task_id), str(blocked_by_id)}
        curr_blocked = prereq_task.get("blocked_by")
        while curr_blocked:
            if curr_blocked == str(task_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Circular dependency detected across multi-step chain"
                )
            if curr_blocked in visited:
                break
            visited.add(curr_blocked)
            next_t = client.table("tasks").select("blocked_by").eq("id", curr_blocked).execute()
            curr_blocked = next_t.data[0].get("blocked_by") if next_t.data else None

        # Automatic status resolution
        if new_status != "done":
            if prereq_task.get("status") != "done":
                new_status = "blocked"
            elif new_status == "blocked":
                new_status = "todo"
    else:
        # Dependency removed: unblock if previously blocked
        if new_status == "blocked":
            new_status = "todo"

    now_iso = datetime.now(UTC).isoformat()
    update_payload: dict = {
        "blocked_by": str(blocked_by_id) if blocked_by_id else None,
        "status": new_status,
        "updated_at": now_iso,
    }

    if payload.execution_type == "agent":
        update_payload["external_owner_label"] = "AI Agent"

    try:
        updated_resp = client.table("tasks").update(update_payload).eq("id", str(task_id)).execute()
        if not updated_resp.data:
            raise RuntimeError("Database returned empty record on task update")
    except Exception as exc:
        logger.error("Failed to update task dependency: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update task dependency: {exc}"
        ) from exc

    return TaskDependencyUpdateResponse(
        id=task_id,
        workspace_id=workspace_id,
        blocked_by=blocked_by_id,
        status=new_status,
        execution_type=payload.execution_type,
        updated_at=now_iso,
    )


class TaskStatusUpdateRequest(BaseModel):
    status: Literal["todo", "in_progress", "blocked", "done"] = Field(
        ..., description="New task status"
    )


class TaskStatusUpdateResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    status: str
    completed_at: str | None = None
    updated_at: str
    unblocked_tasks_count: int = 0
    reblocked_tasks_count: int = 0


@router.patch(
    "/{workspace_id}/tasks/{task_id}/status",
    response_model=TaskStatusUpdateResponse,
    status_code=status.HTTP_200_OK,
    summary="Update task status with automatic dependency cascading and RLS resolution",
)
def update_task_status(
    workspace_id: UUID,
    task_id: UUID,
    payload: TaskStatusUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskStatusUpdateResponse:
    """Update task status in workspace.

    Verifies workspace membership, checks that prerequisites are met before advancing to in_progress/done,
    and automatically cascades downstream dependencies:
    - If status is 'done', any downstream task blocked_by this task is unblocked to 'todo'.
    - If status moves back from 'done', any downstream task is re-blocked.
    """
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    target_resp = (
        client.table("tasks")
        .select("id, workspace_id, status, blocked_by")
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not target_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace",
        )
    target_task = target_resp.data[0]
    previous_status = target_task.get("status", "todo")
    new_status = payload.status

    # Prerequisite verification: If new status is not 'blocked', prerequisite must be done
    if new_status in ("todo", "in_progress", "done") and target_task.get("blocked_by"):
        prereq_id = target_task.get("blocked_by")
        prereq_resp = client.table("tasks").select("status").eq("id", str(prereq_id)).execute()
        if prereq_resp.data and prereq_resp.data[0].get("status") != "done":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot advance task: prerequisite is not completed yet",
            )

    now_iso = datetime.now(UTC).isoformat()
    completed_at = now_iso if new_status == "done" else None

    update_payload = {
        "status": new_status,
        "completed_at": completed_at,
        "updated_at": now_iso,
    }

    try:
        updated_resp = client.table("tasks").update(update_payload).eq("id", str(task_id)).execute()
        if not updated_resp.data:
            raise RuntimeError("Database returned empty record on task update")
    except Exception as exc:
        logger.error("Failed to update task status: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update task status: {exc}",
        ) from exc

    unblocked_count = 0
    reblocked_count = 0

    # Auto-unblock downstream tasks if completed
    if new_status == "done":
        try:
            unblock_resp = (
                client.table("tasks")
                .update({"status": "todo", "updated_at": now_iso})
                .eq("workspace_id", str(workspace_id))
                .eq("blocked_by", str(task_id))
                .eq("status", "blocked")
                .execute()
            )
            unblocked_count = len(unblock_resp.data) if unblock_resp.data else 0
        except Exception as exc:
            logger.warning("Downstream unblock warning: %s", exc)

    # Re-block downstream tasks if previously done task was moved back
    elif previous_status == "done" and new_status != "done":
        try:
            reblock_resp = (
                client.table("tasks")
                .update({"status": "blocked", "updated_at": now_iso})
                .eq("workspace_id", str(workspace_id))
                .eq("blocked_by", str(task_id))
                .neq("status", "blocked")
                .execute()
            )
            reblocked_count = len(reblock_resp.data) if reblock_resp.data else 0
        except Exception as exc:
            logger.warning("Downstream reblock warning: %s", exc)

    return TaskStatusUpdateResponse(
        id=task_id,
        workspace_id=workspace_id,
        status=new_status,
        completed_at=completed_at,
        updated_at=now_iso,
        unblocked_tasks_count=unblocked_count,
        reblocked_tasks_count=reblocked_count,
    )
