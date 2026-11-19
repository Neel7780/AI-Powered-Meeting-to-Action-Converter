"""Meeting and Task Chatbot API Router."""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import CurrentUser, get_current_user, require_role, require_meeting_role
from app.core.supabase import get_supabase_client
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.llm.chat_assistant import answer_workspace_chat

logger = logging.getLogger(__name__)

router = APIRouter()

WORKSPACE_ROLES = {"admin", "organiser", "member"}


class MeetingSummaryItem(BaseModel):
    id: UUID
    title: str
    starts_at: str
    status: str


@router.post(
    "/message",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Query the meeting chatbot for facts, decisions, and tasks"
)
def chat_message(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user)
) -> ChatResponse:
    """Submit a question to the meeting copilot.
    
    Enforces workspace RBAC: users can only query workspaces they belong to.
    Answers are grounded in meeting transcripts, summaries, decisions, and confirmed tasks.
    """
    # 1. Enforce RBAC
    require_role(payload.workspace_id, WORKSPACE_ROLES, user)

    if payload.meeting_id:
        meeting = require_meeting_role(payload.meeting_id, WORKSPACE_ROLES, user)
        if str(meeting["workspace_id"]) != str(payload.workspace_id):
            raise HTTPException(404, "Meeting not found in this workspace")

    # 3. Answer question
    try:
        response = answer_workspace_chat(
            workspace_id=payload.workspace_id,
            user_id=user.id,
            query=payload.query.strip(),
            history=payload.history,
            meeting_id=payload.meeting_id
        )
        return response
    except Exception as exc:
        logger.error("Error answering chat query: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat processing failed: {exc}"
        ) from exc


@router.get(
    "/workspaces/{workspace_id}/meetings",
    response_model=list[MeetingSummaryItem],
    status_code=status.HTTP_200_OK,
    summary="List available meetings for chatbot scoping"
)
def list_chat_meetings(
    workspace_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> list[MeetingSummaryItem]:
    """Retrieve meetings in this workspace for the meeting selector dropdown."""
    require_role(workspace_id, WORKSPACE_ROLES, user)

    db = get_supabase_client()
    rows = (db.table("meetings").select("id, title, starts_at, status")
            .eq("workspace_id", str(workspace_id)).neq("lifecycle", "deleted")
            .order("starts_at", desc=True).limit(30).execute().data or [])
    visible = []
    for row in rows:
        try:
            require_meeting_role(UUID(str(row["id"])), WORKSPACE_ROLES, user)
        except HTTPException as exc:
            if exc.status_code == 404:
                continue
            raise
        visible.append(MeetingSummaryItem(**row))
    return visible
