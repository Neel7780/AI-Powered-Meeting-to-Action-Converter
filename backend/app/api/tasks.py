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


# ------------------------------------------------------------------------------
# 2-Way Task Prerequisite Communication (Assignee <-> Manager)
# ------------------------------------------------------------------------------

class TaskCommunicationUser(BaseModel):
    id: UUID
    display_name: str | None = None
    email: str | None = None
    avatar_url: str | None = None


class TaskCommunicationItem(BaseModel):
    id: UUID
    task_id: UUID
    workspace_id: UUID
    sender_id: UUID
    recipient_id: UUID
    message_type: str
    content: str
    suggested_prerequisite_task_id: UUID | None = None
    suggested_prerequisite_task_title: str | None = None
    status: str
    created_at: str
    updated_at: str
    sender: TaskCommunicationUser | None = None
    recipient: TaskCommunicationUser | None = None


class TaskPrerequisiteInquiryRequest(BaseModel):
    content: str = Field(
        ..., min_length=1, max_length=2000, description="Question regarding task prerequisites"
    )


class TaskPrerequisiteReplyRequest(BaseModel):
    content: str = Field(
        ..., min_length=1, max_length=2000, description="Manager answer to prerequisite question"
    )
    suggested_prerequisite_task_id: UUID | None = Field(
        default=None, description="Optional task to immediately link as prerequisite"
    )
    mark_as_resolved: bool = Field(
        default=False, description="Whether this response fully resolves prerequisites"
    )


def _fetch_profile_map(client, user_ids: set[str]) -> dict[str, dict]:
    """Fetch profiles dictionary keyed by user_id string."""
    if not user_ids:
        return {}
    try:
        resp = (
            client.table("profiles")
            .select("id, display_name, email, avatar_url")
            .in_("id", list(user_ids))
            .execute()
        )
        data = getattr(resp, "data", None)
        if not isinstance(data, list):
            return {}
        return {str(p["id"]): p for p in data if isinstance(p, dict) and "id" in p}
    except Exception as exc:
        logger.warning("Could not fetch profiles for communications: %s", exc)
        return {}


@router.get(
    "/{workspace_id}/tasks/{task_id}/communications",
    response_model=list[TaskCommunicationItem],
    status_code=status.HTTP_200_OK,
    summary="List prerequisite communication thread for a specific task",
)
def get_task_communications(
    workspace_id: UUID,
    task_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> list[TaskCommunicationItem]:
    """Retrieve full conversation thread regarding prerequisites for a specific task."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    # Validate task belongs to workspace
    task_resp = (
        client.table("tasks")
        .select("id, workspace_id")
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not task_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace",
        )

    # Fetch communication rows
    try:
        comm_resp = (
            client.table("task_communications")
            .select(
                "id, task_id, workspace_id, sender_id, recipient_id, message_type, "
                "content, suggested_prerequisite_task_id, status, created_at, updated_at"
            )
            .eq("task_id", str(task_id))
            .eq("workspace_id", str(workspace_id))
            .order("created_at", desc=False)
            .execute()
        )
        c_data = getattr(comm_resp, "data", None)
        rows = c_data if isinstance(c_data, list) else []
    except Exception as exc:
        logger.error("Failed to query task_communications: %s", exc)
        return []

    if not rows:
        return []

    # Collect profile IDs and prerequisite task IDs for joined names
    user_ids = {str(r["sender_id"]) for r in rows if r.get("sender_id")}.union(
        {str(r["recipient_id"]) for r in rows if r.get("recipient_id")}
    )
    profile_map = _fetch_profile_map(client, user_ids)

    prereq_ids = [r["suggested_prerequisite_task_id"] for r in rows if r.get("suggested_prerequisite_task_id")]
    task_title_map: dict[str, str] = {}
    if prereq_ids:
        try:
            t_resp = (
                client.table("tasks")
                .select("id, title")
                .in_("id", prereq_ids)
                .execute()
            )
            t_data = getattr(t_resp, "data", None)
            if isinstance(t_data, list):
                for t in t_data:
                    if isinstance(t, dict) and "id" in t:
                        task_title_map[str(t["id"])] = t.get("title", "")
        except Exception as exc:
            logger.warning("Could not fetch prerequisite task titles: %s", exc)

    results: list[TaskCommunicationItem] = []
    for r in rows:
        sender_p = profile_map.get(str(r.get("sender_id")))
        recipient_p = profile_map.get(str(r.get("recipient_id")))
        prereq_task_id = r.get("suggested_prerequisite_task_id")

        results.append(
            TaskCommunicationItem(
                id=r["id"],
                task_id=r["task_id"],
                workspace_id=r["workspace_id"],
                sender_id=r["sender_id"],
                recipient_id=r["recipient_id"],
                message_type=r.get("message_type", "inquiry"),
                content=r.get("content", ""),
                suggested_prerequisite_task_id=prereq_task_id,
                suggested_prerequisite_task_title=task_title_map.get(str(prereq_task_id)) if prereq_task_id else None,
                status=r.get("status", "open"),
                created_at=str(r.get("created_at")),
                updated_at=str(r.get("updated_at")),
                sender=TaskCommunicationUser(
                    id=sender_p["id"],
                    display_name=sender_p.get("display_name"),
                    email=sender_p.get("email"),
                    avatar_url=sender_p.get("avatar_url"),
                ) if sender_p else None,
                recipient=TaskCommunicationUser(
                    id=recipient_p["id"],
                    display_name=recipient_p.get("display_name"),
                    email=recipient_p.get("email"),
                    avatar_url=recipient_p.get("avatar_url"),
                ) if recipient_p else None,
            )
        )

    return results


@router.post(
    "/{workspace_id}/tasks/{task_id}/prerequisite-inquiries",
    response_model=TaskCommunicationItem,
    status_code=status.HTTP_201_CREATED,
    summary="Assignee asks Manager about task prerequisites",
)
def create_prerequisite_inquiry(
    workspace_id: UUID,
    task_id: UUID,
    payload: TaskPrerequisiteInquiryRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskCommunicationItem:
    """Submit an inquiry from the task assignee to the task creator/manager regarding prerequisites."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    # 1. Fetch task details (including creator / manager)
    task_resp = (
        client.table("tasks")
        .select("id, workspace_id, title, created_by")
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not task_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace",
        )
    task_record = task_resp.data[0]
    manager_id = task_record.get("created_by")

    # If task creator is missing, route to the workspace Admin/Organiser as the Manager
    if not manager_id:
        admin_resp = (
            client.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", str(workspace_id))
            .in_("role", ["admin", "organiser"])
            .limit(1)
            .execute()
        )
        if admin_resp.data:
            manager_id = admin_resp.data[0]["user_id"]

    if not manager_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No workspace admin or task creator found to receive this inquiry",
        )

    now_iso = datetime.now(UTC).isoformat()
    comm_payload = {
        "task_id": str(task_id),
        "workspace_id": str(workspace_id),
        "sender_id": str(user.id),
        "recipient_id": str(manager_id),
        "message_type": "inquiry",
        "content": payload.content.strip(),
        "status": "open",
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        inserted_resp = client.table("task_communications").insert(comm_payload).execute()
        if not inserted_resp.data:
            raise RuntimeError("Database returned empty record on inquiry insert")
        inserted_row = inserted_resp.data[0]
    except Exception as exc:
        logger.error("Failed to insert task communication: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit prerequisite inquiry: {exc}",
        ) from exc

    # 2. Trigger in-app notification for Manager (zero-budget in-app bell)
    try:
        notif_idemp = f"inq_{inserted_row['id']}_{now_iso}"
        notif_payload = {
            "user_id": str(manager_id),
            "task_id": str(task_id),
            "channel": "in_app",
            "event_type": "task_prerequisite_inquiry",
            "status": "sent",
            "sent_at": now_iso,
            "idempotency_key": notif_idemp,
        }
        client.table("notifications").insert(notif_payload).execute()
    except Exception as notif_exc:
        logger.warning("Notification insert error: %s", notif_exc)

    # Resolve profiles
    profile_map = _fetch_profile_map(client, {str(user.id), str(manager_id)})
    sender_p = profile_map.get(str(user.id))
    recipient_p = profile_map.get(str(manager_id))

    return TaskCommunicationItem(
        id=inserted_row["id"],
        task_id=task_id,
        workspace_id=workspace_id,
        sender_id=user.id,
        recipient_id=UUID(str(manager_id)),
        message_type="inquiry",
        content=inserted_row["content"],
        suggested_prerequisite_task_id=None,
        suggested_prerequisite_task_title=None,
        status="open",
        created_at=inserted_row.get("created_at", now_iso),
        updated_at=inserted_row.get("updated_at", now_iso),
        sender=TaskCommunicationUser(
            id=sender_p["id"],
            display_name=sender_p.get("display_name"),
            email=sender_p.get("email"),
            avatar_url=sender_p.get("avatar_url"),
        ) if sender_p else None,
        recipient=TaskCommunicationUser(
            id=recipient_p["id"],
            display_name=recipient_p.get("display_name"),
            email=recipient_p.get("email"),
            avatar_url=recipient_p.get("avatar_url"),
        ) if recipient_p else None,
    )


@router.post(
    "/{workspace_id}/tasks/{task_id}/prerequisite-replies",
    response_model=TaskCommunicationItem,
    status_code=status.HTTP_201_CREATED,
    summary="Manager replies to Assignee with prerequisite clarifications and optional dependency linkage",
)
def create_prerequisite_reply(
    workspace_id: UUID,
    task_id: UUID,
    payload: TaskPrerequisiteReplyRequest,
    user: CurrentUser = Depends(get_current_user),
) -> TaskCommunicationItem:
    """Submit a reply from the manager to the task assignee, with optional prerequisite linking."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    # 1. Fetch task
    task_resp = (
        client.table("tasks")
        .select("id, workspace_id, title, status, blocked_by, created_by")
        .eq("id", str(task_id))
        .eq("workspace_id", str(workspace_id))
        .execute()
    )
    if not task_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found in this workspace",
        )
    task_record = task_resp.data[0]

    # 2. Determine Recipient (Assignee):
    # Check latest inquiry sender or primary assignee
    recipient_id: str | None = None
    inquiry_resp = (
        client.table("task_communications")
        .select("sender_id")
        .eq("task_id", str(task_id))
        .eq("message_type", "inquiry")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if inquiry_resp.data:
        recipient_id = str(inquiry_resp.data[0]["sender_id"])
    else:
        # Fall back to task assignee
        assignee_resp = (
            client.table("task_assignees")
            .select("user_id")
            .eq("task_id", str(task_id))
            .limit(1)
            .execute()
        )
        if assignee_resp.data:
            recipient_id = str(assignee_resp.data[0]["user_id"])
        else:
            # Fall back to user or creator
            recipient_id = str(user.id)

    # 3. If manager specified a prerequisite task to link, validate and link it
    prereq_title: str | None = None
    if payload.suggested_prerequisite_task_id:
        prereq_id = payload.suggested_prerequisite_task_id
        if prereq_id == task_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A task cannot depend on itself as a prerequisite",
            )
        p_resp = (
            client.table("tasks")
            .select("id, workspace_id, title, status, blocked_by")
            .eq("id", str(prereq_id))
            .eq("workspace_id", str(workspace_id))
            .execute()
        )
        if not p_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Prerequisite task not found in this workspace",
            )
        prereq_row = p_resp.data[0]
        prereq_title = prereq_row.get("title")

        # Circular dependency validation
        if prereq_row.get("blocked_by") == str(task_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Circular dependency: prerequisite task already depends on this task",
            )

        # Update task's blocked_by and status
        now_ts = datetime.now(UTC).isoformat()
        new_status = task_record.get("status", "todo")
        if new_status != "done":
            if prereq_row.get("status") != "done":
                new_status = "blocked"
            elif new_status == "blocked":
                new_status = "todo"

        try:
            client.table("tasks").update({
                "blocked_by": str(prereq_id),
                "status": new_status,
                "updated_at": now_ts,
            }).eq("id", str(task_id)).execute()
        except Exception as update_err:
            logger.error("Failed to link prerequisite on reply: %s", update_err)

    # 4. Insert communication record
    status_val = "resolved" if payload.mark_as_resolved else "answered"
    now_iso = datetime.now(UTC).isoformat()
    reply_payload = {
        "task_id": str(task_id),
        "workspace_id": str(workspace_id),
        "sender_id": str(user.id),
        "recipient_id": str(recipient_id),
        "message_type": "reply",
        "content": payload.content.strip(),
        "suggested_prerequisite_task_id": str(payload.suggested_prerequisite_task_id) if payload.suggested_prerequisite_task_id else None,
        "status": status_val,
        "created_at": now_iso,
        "updated_at": now_iso,
    }

    try:
        inserted_resp = client.table("task_communications").insert(reply_payload).execute()
        if not inserted_resp.data:
            raise RuntimeError("Database returned empty record on reply insert")
        inserted_row = inserted_resp.data[0]
    except Exception as exc:
        logger.error("Failed to insert prerequisite reply: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit prerequisite reply: {exc}",
        ) from exc

    # 5. Mark previous open inquiries as answered or resolved
    try:
        client.table("task_communications").update({
            "status": status_val,
            "updated_at": now_iso,
        }).eq("task_id", str(task_id)).eq("status", "open").execute()
    except Exception as upd_comm_exc:
        logger.warning("Could not update open inquiry statuses: %s", upd_comm_exc)

    # 6. Trigger in-app notification for the Assignee
    try:
        notif_idemp = f"rep_{inserted_row['id']}_{now_iso}"
        notif_payload = {
            "user_id": str(recipient_id),
            "task_id": str(task_id),
            "channel": "in_app",
            "event_type": "task_prerequisite_reply",
            "status": "sent",
            "sent_at": now_iso,
            "idempotency_key": notif_idemp,
        }
        client.table("notifications").insert(notif_payload).execute()
    except Exception as notif_exc:
        logger.warning("Notification insert error for assignee: %s", notif_exc)

    # Resolve profiles
    profile_map = _fetch_profile_map(client, {str(user.id), str(recipient_id)})
    sender_p = profile_map.get(str(user.id))
    recipient_p = profile_map.get(str(recipient_id))

    return TaskCommunicationItem(
        id=inserted_row["id"],
        task_id=task_id,
        workspace_id=workspace_id,
        sender_id=user.id,
        recipient_id=UUID(str(recipient_id)),
        message_type="reply",
        content=inserted_row["content"],
        suggested_prerequisite_task_id=payload.suggested_prerequisite_task_id,
        suggested_prerequisite_task_title=prereq_title,
        status=status_val,
        created_at=inserted_row.get("created_at", now_iso),
        updated_at=inserted_row.get("updated_at", now_iso),
        sender=TaskCommunicationUser(
            id=sender_p["id"],
            display_name=sender_p.get("display_name"),
            email=sender_p.get("email"),
            avatar_url=sender_p.get("avatar_url"),
        ) if sender_p else None,
        recipient=TaskCommunicationUser(
            id=recipient_p["id"],
            display_name=recipient_p.get("display_name"),
            email=recipient_p.get("email"),
            avatar_url=recipient_p.get("avatar_url"),
        ) if recipient_p else None,
    )


@router.patch(
    "/{workspace_id}/tasks/{task_id}/prerequisite-inquiries/{inquiry_id}/resolve",
    response_model=TaskCommunicationItem,
    status_code=status.HTTP_200_OK,
    summary="Mark a prerequisite inquiry thread as resolved",
)
def resolve_prerequisite_inquiry(
    workspace_id: UUID,
    task_id: UUID,
    inquiry_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> TaskCommunicationItem:
    """Mark a prerequisite communication or entire task thread as resolved."""
    require_role(workspace_id, {"admin", "organiser", "member"}, user)
    client = get_supabase_client()

    now_iso = datetime.now(UTC).isoformat()
    try:
        # Mark all communications on this task as resolved
        client.table("task_communications").update({
            "status": "resolved",
            "updated_at": now_iso,
        }).eq("task_id", str(task_id)).execute()

        comm_resp = (
            client.table("task_communications")
            .select(
                "id, task_id, workspace_id, sender_id, recipient_id, message_type, "
                "content, suggested_prerequisite_task_id, status, created_at, updated_at"
            )
            .eq("id", str(inquiry_id))
            .execute()
        )
        if not comm_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Communication record not found",
            )
        row = comm_resp.data[0]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to resolve communication: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to resolve communication: {exc}",
        ) from exc

    profile_map = _fetch_profile_map(client, {str(row["sender_id"]), str(row["recipient_id"])})
    sender_p = profile_map.get(str(row["sender_id"]))
    recipient_p = profile_map.get(str(row["recipient_id"]))

    return TaskCommunicationItem(
        id=row["id"],
        task_id=task_id,
        workspace_id=workspace_id,
        sender_id=row["sender_id"],
        recipient_id=row["recipient_id"],
        message_type=row.get("message_type", "resolution"),
        content=row.get("content", ""),
        suggested_prerequisite_task_id=row.get("suggested_prerequisite_task_id"),
        suggested_prerequisite_task_title=None,
        status="resolved",
        created_at=str(row.get("created_at")),
        updated_at=now_iso,
        sender=TaskCommunicationUser(
            id=sender_p["id"],
            display_name=sender_p.get("display_name"),
            email=sender_p.get("email"),
            avatar_url=sender_p.get("avatar_url"),
        ) if sender_p else None,
        recipient=TaskCommunicationUser(
            id=recipient_p["id"],
            display_name=recipient_p.get("display_name"),
            email=recipient_p.get("email"),
            avatar_url=recipient_p.get("avatar_url"),
        ) if recipient_p else None,
    )
