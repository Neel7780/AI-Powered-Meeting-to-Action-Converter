"""Candidate Items Review and Approval API (BE-4).

Endpoints:
- POST /meetings/{meeting_id}/approve: Approve candidate action items, creating tasks & assignees
- POST /meetings/{meeting_id}/reject: Reject candidate items with optional rationale
"""

import logging
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
from app.utils.dates import to_utc

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
    changes = []
    for item in payload.items:
        change = item.model_dump(mode="json", exclude_unset=True)
        if "deadline_date" in change:
            due = to_utc(change.pop("deadline_date"), None, meeting["timezone"]) if item.deadline_date else None
            if item.deadline_date and due is None:
                raise HTTPException(422, "Invalid meeting timezone for due date")
            change["deadline_utc"] = due.isoformat() if due else None
        changes.append(change)
    result = _review_transaction(meeting_id, user.id, changes, "approved")
    new_task_ids = [UUID(tid) for tid in result["task_ids"]]

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

    result = _review_transaction(meeting_id, user.id, [{"id": str(i)} for i in payload.item_ids], "rejected", payload.reason)
    return RejectResponse(rejected=result["rejected"])


def _review_transaction(meeting_id, actor_id, items, decision, reason=None):
    try:
        result = get_supabase_client().rpc("review_meeting_items", {
            "p_meeting_id": str(meeting_id), "p_actor_id": str(actor_id),
            "p_items": items, "p_decision": decision, "p_reason": reason,
        }).execute().data
        if not isinstance(result, dict) or "task_ids" not in result:
            raise RuntimeError("Review transaction returned no result")
        return result
    except Exception as exc:
        code = getattr(exc, "code", None)
        status_code = {"42501": 403, "P0002": 404, "40001": 409, "23505": 409,
                       "22023": 422, "23514": 422, "22P02": 422}.get(code, 500)
        logger.error("Review transaction failed: %s", type(exc).__name__)
        detail = str(getattr(exc, "message", "Review could not be confirmed. Refresh before retrying."))
        raise HTTPException(status_code, detail) from exc
