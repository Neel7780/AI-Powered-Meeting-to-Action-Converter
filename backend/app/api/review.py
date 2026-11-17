"""Candidate Items Review and Approval API (BE-4).

Endpoints:
- POST /meetings/{meeting_id}/approve: Approve candidate action items, creating tasks & assignees
- POST /meetings/{meeting_id}/reject: Reject candidate items with optional rationale
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from app.core.deps import (
    ORGANISER_ROLES,
    CurrentUser,
    get_current_user,
    require_meeting_role,
)
from app.core.supabase import get_supabase_client
from app.schemas.review import (
    ApproveRequest,
    ApproveResponse,
    RejectRequest,
    RejectResponse,
)
from app.services.email import notify_tasks_assigned

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/meetings/{meeting_id}/approve",
    response_model=ApproveResponse,
    status_code=status.HTTP_200_OK,
    summary="Review gate: approve candidate items and convert actions to tasks"
)
def approve_items(
    meeting_id: UUID,
    payload: ApproveRequest,
    background_tasks: BackgroundTasks,
    user: CurrentUser = Depends(get_current_user)
) -> ApproveResponse:
    """Approve candidate items from meeting extraction.
    
    Allowed roles: admin, organiser.
    
    Processing flow:
    1. Validates each candidate item belongs to this meeting and has review_status='needs_review'.
    2. Validates that any assigned owner is an active member of the workspace.
    3. Atomically updates extracted_items to review_status='approved' with reviewed_by & reviewed_at.
    4. For items of type='action': creates a task row and primary task_assignee row.
    5. Dispatches task assignment email notification in background tasks.
    """
    # 1. Enforce RBAC
    meeting = require_meeting_role(meeting_id, ORGANISER_ROLES, user)
    workspace_id = meeting["workspace_id"]

    client = get_supabase_client()
    requested_ids = [str(item.id) for item in payload.items]

    # 2. Fetch target candidate items from database
    items_resp = (
        client.table("extracted_items")
        .select("*")
        .eq("meeting_id", str(meeting_id))
        .in_("id", requested_ids)
        .execute()
    )
    items_by_id = {item["id"]: item for item in (items_resp.data or [])}

    # Verify all requested items exist, belong to this meeting, and are in needs_review status
    for item_update in payload.items:
        str_id = str(item_update.id)
        if str_id not in items_by_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate item {str_id} does not exist or does not belong to meeting {meeting_id}"
            )
        db_item = items_by_id[str_id]
        if db_item.get("review_status") != "needs_review":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate item {str_id} has status '{db_item.get('review_status')}', expected 'needs_review'"
            )

    # 3. Validate that any assigned owner_user_id is an active workspace member
    candidate_owner_ids: set[str] = set()
    for item_update in payload.items:
        dumped = item_update.model_dump(exclude_unset=True)
        db_item = items_by_id[str(item_update.id)]
        effective_owner = dumped.get("owner_user_id", db_item.get("owner_user_id"))
        if effective_owner is not None:
            candidate_owner_ids.add(str(effective_owner))

    if candidate_owner_ids:
        members_resp = (
            client.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", str(workspace_id))
            .in_("user_id", list(candidate_owner_ids))
            .execute()
        )
        active_member_ids = {m["user_id"] for m in (members_resp.data or [])}
        for owner_id in candidate_owner_ids:
            if owner_id not in active_member_ids:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Assignee {owner_id} is not an active member of this workspace"
                )

    now_utc_str = datetime.now(UTC).isoformat()
    new_task_ids: list[UUID] = []

    # 4. Process each item in order
    for item_update in payload.items:
        str_id = str(item_update.id)
        db_item = items_by_id[str_id]
        dumped = item_update.model_dump(exclude_unset=True)

        final_task = dumped.get("task", db_item.get("task"))
        final_owner = dumped.get("owner_user_id", db_item.get("owner_user_id"))
        final_deadline = dumped.get("deadline_utc", db_item.get("deadline_utc"))
        final_priority = dumped.get("priority", db_item.get("priority") or "normal")

        # Step 4a: Update extracted_items (enforce extracted_review_chk: status + reviewed_by + reviewed_at)
        update_item_payload = {
            "review_status": "approved",
            "reviewed_by": str(user.id),
            "reviewed_at": now_utc_str,
        }
        if "task" in dumped:
            update_item_payload["task"] = dumped["task"]
        if "owner_user_id" in dumped:
            update_item_payload["owner_user_id"] = str(dumped["owner_user_id"]) if dumped["owner_user_id"] else None
        if "deadline_utc" in dumped:
            update_item_payload["deadline_utc"] = (
                dumped["deadline_utc"].isoformat() if dumped["deadline_utc"] else None
            )
        if "priority" in dumped:
            update_item_payload["priority"] = dumped["priority"]

        try:
            client.table("extracted_items").update(update_item_payload).eq("id", str_id).execute()
        except Exception as exc:
            logger.error("Failed to update extracted item %s: %s", str_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update extracted item: {exc}"
            ) from exc

        # Step 4b: If type == 'action', convert to task
        if db_item.get("type") == "action":
            deadline_val = (
                final_deadline.isoformat() if isinstance(final_deadline, datetime) else final_deadline
            )
            task_insert = {
                "workspace_id": str(workspace_id),
                "meeting_id": str(meeting_id),
                "extracted_item_id": str_id,
                "title": (final_task or db_item.get("task") or "Untitled Action")[:500],
                "deadline_utc": deadline_val,
                "priority": final_priority,
                "status": "todo",
                "source_excerpt": db_item["source_excerpt"],  # Must match verbatim per validate_task_source trigger
                "created_by": str(user.id),
                "external_owner_label": db_item.get("owner_name") if not final_owner else None,
            }

            try:
                t_resp = client.table("tasks").insert(task_insert).execute()
                if not t_resp.data:
                    raise RuntimeError("Database returned empty record on task insertion")
                task_record = t_resp.data[0]
                task_id = UUID(str(task_record["id"]))
                new_task_ids.append(task_id)
            except Exception as exc:
                err_str = str(exc).lower()
                if "unique" in err_str or "conflict" in err_str or "extracted_item_id" in err_str:
                    logger.warning("Conflict creating task for extracted item %s: %s", str_id, exc)
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"A task has already been created for candidate item {str_id}"
                    ) from exc
                logger.error("Task creation failed for item %s: %s", str_id, exc)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to create task for approved action item: {exc}"
                ) from exc

            # If an assigned workspace member is specified, insert into task_assignees
            if final_owner:
                assignee_insert = {
                    "task_id": str(task_id),
                    "user_id": str(final_owner),
                    "is_primary": True,
                }
                try:
                    client.table("task_assignees").insert(assignee_insert).execute()
                except Exception as exc:
                    logger.error("Failed to insert task_assignee for task %s: %s", task_id, exc)
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Failed to assign task: {exc}"
                    ) from exc

    # 5. Dispatch task assignment email in background
    if new_task_ids:
        background_tasks.add_task(notify_tasks_assigned, meeting_id, new_task_ids)

    return ApproveResponse(
        approved=len(payload.items),
        task_ids=new_task_ids
    )


@router.post(
    "/meetings/{meeting_id}/reject",
    response_model=RejectResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject candidate extracted items"
)
def reject_items(
    meeting_id: UUID,
    payload: RejectRequest,
    user: CurrentUser = Depends(get_current_user)
) -> RejectResponse:
    """Reject candidate items from meeting extraction with optional reason.
    
    Allowed roles: admin, organiser.
    """
    # 1. Enforce RBAC
    require_meeting_role(meeting_id, ORGANISER_ROLES, user)

    client = get_supabase_client()
    requested_ids = [str(item_id) for item_id in payload.item_ids]

    # 2. Fetch items to verify existence and status
    items_resp = (
        client.table("extracted_items")
        .select("id, review_status")
        .eq("meeting_id", str(meeting_id))
        .in_("id", requested_ids)
        .execute()
    )
    items_by_id = {item["id"]: item for item in (items_resp.data or [])}

    for item_id in requested_ids:
        if item_id not in items_by_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate item {item_id} does not exist or does not belong to meeting {meeting_id}"
            )
        db_item = items_by_id[item_id]
        if db_item.get("review_status") != "needs_review":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Candidate item {item_id} has status '{db_item.get('review_status')}', expected 'needs_review'"
            )

    now_utc_str = datetime.now(UTC).isoformat()
    reject_update = {
        "review_status": "rejected",
        "reviewed_by": str(user.id),
        "reviewed_at": now_utc_str,
        "rejection_reason": payload.reason,
    }

    try:
        for item_id in requested_ids:
            client.table("extracted_items").update(reject_update).eq("id", item_id).execute()
    except Exception as exc:
        logger.error("Failed to reject items for meeting %s: %s", meeting_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update candidate items to rejected: {exc}"
        ) from exc

    return RejectResponse(rejected=len(payload.item_ids))
