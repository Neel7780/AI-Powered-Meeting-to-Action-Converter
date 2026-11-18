"""Meeting and Task Chatbot API Router."""

import logging
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import DEV_USER_ID, CurrentUser, WORKSPACE_ROLES, get_current_user, require_role
from app.core.supabase import get_supabase_client
from app.schemas.chat import (
    ChatMessageRecord,
    ChatRequest,
    ChatResponse,
    ChatSessionDetail,
    ChatSessionSummary,
    CreateSessionRequest,
)
from app.services.llm.chat_assistant import answer_workspace_chat

logger = logging.getLogger(__name__)

router = APIRouter()


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

    # 2. If meeting_id is supplied, verify it belongs to this workspace
    if payload.meeting_id:
        try:
            db = get_supabase_client()
            resp = (
                db.table("meetings")
                .select("id, workspace_id")
                .eq("id", str(payload.meeting_id))
                .execute()
            )
            data = resp.data or []
            if not data or str(data[0]["workspace_id"]) != str(payload.workspace_id):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Meeting not found or does not belong to specified workspace"
                )
        except HTTPException:
            raise
        except Exception as exc:
            logger.debug("Meeting existence check fallback in dev: %s", exc)

    # 3. Answer question
    query_clean = payload.query.strip()
    if not query_clean:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Query cannot be empty or whitespace only"
        )

    # Validate session ownership and workspace scoping if session_id is provided
    session_row = None
    if payload.session_id:
        db = get_supabase_client()
        s_resp = (
            db.table("chat_sessions")
            .select("id, workspace_id, user_id, title")
            .eq("id", str(payload.session_id))
            .execute()
        )
        if not s_resp.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Chat session not found"
            )
        session_row = s_resp.data[0]
        if (
            str(session_row.get("user_id")) != str(user.id)
            or str(session_row.get("workspace_id")) != str(payload.workspace_id)
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this chat session"
            )

    try:
        response = answer_workspace_chat(
            workspace_id=payload.workspace_id,
            user_id=user.id,
            query=query_clean,
            history=payload.history,
            meeting_id=payload.meeting_id
        )

        # 4. If session_id provided, persist conversation turn in database
        if payload.session_id:
            response.session_id = payload.session_id
            try:
                db = get_supabase_client()
                # Save user message
                db.table("chat_messages").insert({
                    "session_id": str(payload.session_id),
                    "role": "user",
                    "content": query_clean,
                }).execute()

                # Save assistant message with citations
                citations_payload = [c.model_dump() for c in response.citations]
                db.table("chat_messages").insert({
                    "session_id": str(payload.session_id),
                    "role": "assistant",
                    "content": response.answer,
                    "citations": citations_payload,
                    "suggested_followups": response.suggested_followups,
                }).execute()

                # Auto-generate title if session is brand new
                if session_row and session_row.get("title") in ("New Conversation", "New Chat", ""):
                    title_candidate = query_clean[:32] + ("..." if len(query_clean) > 32 else "")
                    db.table("chat_sessions").update({
                        "title": title_candidate,
                        "updated_at": "now()"
                    }).eq("id", str(payload.session_id)).execute()
                else:
                    db.table("chat_sessions").update({
                        "updated_at": "now()"
                    }).eq("id", str(payload.session_id)).execute()
            except Exception as exc:
                logger.warning("Optional chat persistence skipped: %s", exc)

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

    try:
        db = get_supabase_client()
        resp = (
            db.table("meetings")
            .select("id, title, starts_at, status")
            .eq("workspace_id", str(workspace_id))
            .neq("lifecycle", "deleted")
            .order("starts_at", desc=True)
            .limit(50)
            .execute()
        )
        raw = resp.data or []
        return [
            MeetingSummaryItem(
                id=UUID(m["id"]),
                title=m.get("title") or "Untitled Meeting",
                starts_at=str(m.get("starts_at") or ""),
                status=m.get("status") or "draft"
            )
            for m in raw
        ]
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error in list_chat_meetings: %s", exc)
        if settings.ENVIRONMENT == "development" and user.id == DEV_USER_ID:
            return [
                MeetingSummaryItem(
                    id=UUID("11111111-1111-1111-1111-111111111111"),
                    title="Sprint 1 Architecture & Action Item Sync",
                    starts_at="2026-10-24T10:00:00Z",
                    status="ready"
                ),
                MeetingSummaryItem(
                    id=UUID("22222222-2222-2222-2222-222222222222"),
                    title="Product Roadmap & AI Extraction Review",
                    starts_at="2026-10-22T14:30:00Z",
                    status="ready"
                ),
            ]
        return []


# ==============================================================================
# Chat Session History CRUD Endpoints
# ==============================================================================

@router.get(
    "/sessions",
    response_model=list[ChatSessionSummary],
    status_code=status.HTTP_200_OK,
    summary="List past chat sessions for user in workspace"
)
def list_chat_sessions(
    workspace_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> list[ChatSessionSummary]:
    require_role(workspace_id, WORKSPACE_ROLES, user)
    try:
        db = get_supabase_client()
        resp = (
            db.table("chat_sessions")
            .select("id, workspace_id, title, selected_meeting_id, created_at, updated_at")
            .eq("workspace_id", str(workspace_id))
            .eq("user_id", str(user.id))
            .order("updated_at", desc=True)
            .limit(50)
            .execute()
        )
        return resp.data or []
    except Exception as exc:
        logger.warning("Error fetching chat sessions: %s", exc)
        return []


@router.post(
    "/sessions",
    response_model=ChatSessionSummary,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new chat session"
)
def create_chat_session(
    payload: CreateSessionRequest,
    user: CurrentUser = Depends(get_current_user)
) -> ChatSessionSummary:
    require_role(payload.workspace_id, WORKSPACE_ROLES, user)
    try:
        db = get_supabase_client()
        resp = (
            db.table("chat_sessions")
            .insert({
                "workspace_id": str(payload.workspace_id),
                "user_id": str(user.id),
                "title": payload.title,
                "selected_meeting_id": str(payload.selected_meeting_id) if payload.selected_meeting_id else None
            })
            .execute()
        )
        if resp.data and len(resp.data) > 0:
            return resp.data[0]
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist chat session in database"
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error creating chat session: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error creating chat session: {exc}"
        )


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetail,
    status_code=status.HTTP_200_OK,
    summary="Get chat session details and message history"
)
def get_chat_session(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user)
) -> ChatSessionDetail:
    try:
        db = get_supabase_client()
        s_resp = (
            db.table("chat_sessions")
            .select("id, workspace_id, user_id, title, selected_meeting_id, created_at, updated_at")
            .eq("id", str(session_id))
            .execute()
        )
        if not s_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
        
        session_data = s_resp.data[0]
        if str(session_data.get("user_id")) != str(user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this chat session")

        # Enforce current workspace membership before returning content
        workspace_id = UUID(str(session_data["workspace_id"]))
        require_role(workspace_id, WORKSPACE_ROLES, user)

        m_resp = (
            db.table("chat_messages")
            .select("id, session_id, role, content, citations, suggested_followups, created_at")
            .eq("session_id", str(session_id))
            .order("created_at", desc=False)
            .execute()
        )
        session_data["messages"] = m_resp.data or []
        return session_data
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Error fetching chat session detail: %s", exc)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat session and all its messages"
)
def delete_chat_session(
    session_id: UUID,
    user: CurrentUser = Depends(get_current_user)
):
    try:
        db = get_supabase_client()
        s_resp = (
            db.table("chat_sessions")
            .select("id, workspace_id, user_id")
            .eq("id", str(session_id))
            .execute()
        )
        if not s_resp.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
        
        session_data = s_resp.data[0]
        if str(session_data.get("user_id")) != str(user.id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this chat session")

        # Enforce current workspace membership before deletion
        workspace_id = UUID(str(session_data["workspace_id"]))
        require_role(workspace_id, WORKSPACE_ROLES, user)

        db.table("chat_sessions").delete().eq("id", str(session_id)).execute()
        return None
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error deleting chat session: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database error deleting chat session: {exc}"
        )
