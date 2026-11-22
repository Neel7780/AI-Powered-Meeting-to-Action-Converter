"""Meeting Chatbot & Workspace Chat API Router."""

from datetime import datetime, timezone
import html
import ipaddress
import logging
import re
import socket
from typing import Optional
from urllib.parse import urljoin, urlparse
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import DEV_USER_ID, WORKSPACE_ROLES, CurrentUser, get_current_user, require_role
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

MAX_REDIRECT_HOPS = 3
ENABLE_RICH_LINK_PREVIEWS: bool = False
MAX_PREVIEW_BYTES: int = 65536  # Bounded response size (64 KB)
CHAT_ATTACHMENTS_BUCKET = "chat-attachments"

class MeetingSummaryItem(BaseModel):
    id: UUID
    title: str
    starts_at: str
    status: str


class LinkPreviewResponse(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    site_name: Optional[str] = None


class DeleteMessageResponse(BaseModel):
    message_id: UUID
    deleted: bool
    deleted_attachments_count: int = 0
    failed_attachments_count: int = 0
    storage_cleanup_ok: bool = True
    pending_storage_cleanup: bool = False
    detail: Optional[str] = None


def _clean_meta_text(raw: Optional[str]) -> Optional[str]:
    if raw is None:
        return None
    decoded = html.unescape(raw).strip()
    return decoded or None


def _is_public_ip(ip_str: str) -> bool:
    ip_obj = ipaddress.ip_address(ip_str)
    if isinstance(ip_obj, ipaddress.IPv6Address) and ip_obj.ipv4_mapped is not None:
        ip_obj = ip_obj.ipv4_mapped
    return not (
        ip_obj.is_private
        or ip_obj.is_loopback
        or ip_obj.is_reserved
        or ip_obj.is_link_local
        or ip_obj.is_multicast
        or ip_obj.is_unspecified
    )


def _sanitize_http_url(candidate: Optional[str], base_url: str) -> Optional[str]:
    if not candidate:
        return None
    trimmed = candidate.strip()
    if not trimmed:
        return None
    resolved = urljoin(base_url, trimmed)
    parsed = urlparse(resolved)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None
    return resolved


def is_safe_url(target_url: str) -> bool:
    """SSRF guard: disallows loopback, private IPs (IPv4 & IPv6), link-local, multicast, and reserved networks."""
    try:
        parsed = urlparse(target_url)
        if parsed.scheme not in ("http", "https"):
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False

        # Resolve all IPv4 and IPv6 addresses and ensure every single one is public
        try:
            addr_infos = socket.getaddrinfo(hostname, None)
            if not addr_infos:
                return False
            for info in addr_infos:
                ip_str = info[4][0]
                if not _is_public_ip(ip_str):
                    return False
        except Exception:
            return False

        return True
    except Exception:
        return False


@router.post(
    "/message",
    response_model=ChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Query the meeting chatbot for facts, decisions, and tasks",
)
def chat_message(
    payload: ChatRequest,
    user: CurrentUser = Depends(get_current_user),
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
                    detail="Meeting not found or does not belong to specified workspace",
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
            meeting_id=payload.meeting_id,
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
            detail=f"Chat processing failed: {exc}",
        ) from exc


@router.get(
    "/workspaces/{workspace_id}/meetings",
    response_model=list[MeetingSummaryItem],
    status_code=status.HTTP_200_OK,
    summary="List available meetings for chatbot scoping",
)
def list_chat_meetings(
    workspace_id: UUID,
    user: CurrentUser = Depends(get_current_user),
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
                    status="ready",
                ),
                MeetingSummaryItem(
                    id=UUID("22222222-2222-2222-2222-222222222222"),
                    title="Product Roadmap & AI Extraction Review",
                    starts_at="2026-10-22T14:30:00Z",
                    status="ready",
                ),
            ]
        return []


@router.get("/link-preview", response_model=LinkPreviewResponse)
def get_link_preview(
    url: str = Query(..., description="Target URL for link metadata preview"),
    user: CurrentUser = Depends(get_current_user),
):
    """Safely retrieves OpenGraph metadata (title, description, image) for rich link rendering in chat.

    Guarded against SSRF (including redirect-based and IPv6 SSRF) and internal network probing.
    """
    clean_url = url.strip()
    if not is_safe_url(clean_url):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL is invalid or resolves to a private/internal network",
        )

    # Security policy: Rich previews are kept disabled until connection-level
    # destination policy and bounded streaming response enforcement are active.
    # Plain links remain available and fully functional in chat.
    if not ENABLE_RICH_LINK_PREVIEWS:
        return LinkPreviewResponse(url=clean_url)

    headers = {
        "User-Agent": "ActionPulseBot/1.0 (+https://actionpulse.app)",
        "Accept": "text/html,application/xhtml+xml",
    }

    current_url = clean_url
    resp = None
    try:
        with httpx.Client(timeout=3.5, follow_redirects=False) as client:
            for _ in range(MAX_REDIRECT_HOPS + 1):
                resp = client.get(current_url, headers=headers)
                if resp.status_code in (301, 302, 303, 307, 308):
                    location = resp.headers.get("location")
                    if not location:
                        return LinkPreviewResponse(url=clean_url)
                    next_url = urljoin(current_url, location.strip())
                    if not is_safe_url(next_url):
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Redirect URL is invalid or resolves to a private/internal network",
                        )
                    current_url = next_url
                    continue
                break
            else:
                return LinkPreviewResponse(url=clean_url)

            if resp is None or resp.status_code != 200:
                return LinkPreviewResponse(url=clean_url)

            content_type = resp.headers.get("content-type", "").lower()
            if "text/html" not in content_type and "xhtml" not in content_type:
                return LinkPreviewResponse(url=clean_url)

            # Bounded read: enforce MAX_PREVIEW_BYTES limit
            if hasattr(resp, "text") and isinstance(resp.text, str):
                page_html = resp.text[:MAX_PREVIEW_BYTES]
            elif hasattr(resp, "iter_bytes"):
                chunks = []
                total_bytes = 0
                for chunk in resp.iter_bytes(chunk_size=8192):
                    chunks.append(chunk)
                    total_bytes += len(chunk)
                    if total_bytes >= MAX_PREVIEW_BYTES:
                        break
                page_html = b"".join(chunks)[:MAX_PREVIEW_BYTES].decode("utf-8", errors="replace")
            else:
                page_html = ""

            # Extract OpenGraph / Meta tags with regex and safely decode HTML entities
            title_match = (
                re.search(r'<meta\s+property=["\']og:title["\']\s+content=["\'](.*?)["\']', page_html, re.I)
                or re.search(r'<meta\s+name=["\']twitter:title["\']\s+content=["\'](.*?)["\']', page_html, re.I)
                or re.search(r"<title>(.*?)</title>", page_html, re.I)
            )
            title = _clean_meta_text(title_match.group(1)) if title_match else None

            desc_match = (
                re.search(r'<meta\s+property=["\']og:description["\']\s+content=["\'](.*?)["\']', page_html, re.I)
                or re.search(r'<meta\s+name=["\']twitter:description["\']\s+content=["\'](.*?)["\']', page_html, re.I)
                or re.search(r'<meta\s+name=["\']description["\']\s+content=["\'](.*?)["\']', page_html, re.I)
            )
            description = _clean_meta_text(desc_match.group(1)) if desc_match else None

            img_match = (
                re.search(r'<meta\s+property=["\']og:image["\']\s+content=["\'](.*?)["\']', page_html, re.I)
                or re.search(r'<meta\s+name=["\']twitter:image["\']\s+content=["\'](.*?)["\']', page_html, re.I)
            )
            raw_image = _clean_meta_text(img_match.group(1)) if img_match else None
            image = _sanitize_http_url(raw_image, current_url)

            site_match = re.search(
                r'<meta\s+property=["\']og:site_name["\']\s+content=["\'](.*?)["\']',
                page_html,
                re.I,
            )
            site_name = _clean_meta_text(site_match.group(1)) if site_match else urlparse(current_url).hostname

            return LinkPreviewResponse(
                url=clean_url,
                title=title,
                description=description,
                image=image,
                site_name=site_name,
            )
    except HTTPException:
        raise
    except Exception:
        return LinkPreviewResponse(url=clean_url)


@router.delete(
    "/messages/{message_id}",
    response_model=DeleteMessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a workspace chat message and clean up its Storage attachments",
)
def delete_chat_message(
    message_id: UUID,
    user: CurrentUser = Depends(get_current_user),
) -> DeleteMessageResponse:
    """Soft-delete a chat message and delete its underlying Storage objects using service_role.

    Enforces the exact same membership-based privacy and moderation rules as public.soft_delete_message:
    1. Caller must belong to the message's workspace.
    2. For private channels and DMs, caller MUST be an explicit conversation member
       (non-member workspace admins/owners receive 404 anti-enumeration).
    3. Caller must be the message sender OR a workspace owner/admin (otherwise 403).
    4. Message is soft-deleted first (immediately activating RLS blocks on attachments),
       then associated Storage objects strictly scoped to this message are removed.
       If Storage cleanup fails, the message remains soft-deleted, the error is logged,
       and calling DELETE again retries Storage cleanup cleanly.
    """
    db = get_supabase_client()
    msg_id_str = str(message_id)
    caller_id_str = str(user.id)

    # 1. Load target message
    msg_resp = (
        db.table("messages")
        .select("id, conversation_id, workspace_id, sender_id, deleted_at")
        .eq("id", msg_id_str)
        .execute()
    )
    msg_rows = msg_resp.data or []
    if not msg_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or access denied",
        )

    msg = msg_rows[0]
    conv_id = str(msg["conversation_id"])
    ws_id = str(msg["workspace_id"])
    sender_id = str(msg["sender_id"])
    already_deleted = msg.get("deleted_at") is not None

    # 2. Load parent conversation
    conv_resp = (
        db.table("conversations")
        .select("id, workspace_id, type, is_private")
        .eq("id", conv_id)
        .execute()
    )
    conv_rows = conv_resp.data or []
    if not conv_rows or str(conv_rows[0]["workspace_id"]) != ws_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or access denied",
        )
    conv = conv_rows[0]

    # 3. Verify workspace membership
    wm_resp = (
        db.table("workspace_members")
        .select("role")
        .eq("workspace_id", ws_id)
        .eq("user_id", caller_id_str)
        .execute()
    )
    wm_rows = wm_resp.data or []
    if not wm_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found or access denied",
        )
    caller_role = wm_rows[0].get("role")

    # 4. Membership-based privacy gate FIRST (non-member admins/owners cannot access private channels/DMs)
    if conv.get("is_private") or conv.get("type") == "dm":
        cm_resp = (
            db.table("conversation_members")
            .select("user_id")
            .eq("conversation_id", conv_id)
            .eq("user_id", caller_id_str)
            .execute()
        )
        if not (cm_resp.data or []):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Message not found or access denied",
            )

    # 5. Moderation authority gate SECOND
    is_sender = sender_id == caller_id_str
    is_workspace_admin = caller_role in ("owner", "admin")
    if not (is_sender or is_workspace_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized to delete this message",
        )

    # 6. Soft-delete message first (idempotent so partial Storage cleanup can be retried)
    if not already_deleted:
        now_iso = datetime.now(timezone.utc).isoformat()
        (
            db.table("messages")
            .update({
                "deleted_at": now_iso,
                "content": "This message was deleted.",
                "updated_at": now_iso,
            })
            .eq("id", msg_id_str)
            .execute()
        )

    # 7. Collect attachment storage paths strictly scoped to this message & conversation
    att_resp = (
        db.table("message_attachments")
        .select("id, storage_path")
        .eq("message_id", msg_id_str)
        .eq("conversation_id", conv_id)
        .eq("workspace_id", ws_id)
        .execute()
    )
    att_rows = att_resp.data or []
    expected_prefix = f"{ws_id}/{conv_id}/"
    storage_paths = list(
        dict.fromkeys(
            row["storage_path"]
            for row in att_rows
            if isinstance(row.get("storage_path"), str)
            and row["storage_path"].startswith(expected_prefix)
            and ".." not in row["storage_path"]
        )
    )

    # 8. Delete Storage objects per-path via service_role to immediately invalidate previously issued signed URLs.
    #    Removing per-path ensures one transient Storage error does not block other files from being cleaned up,
    #    and deleting message_attachments rows only for succeeded paths guarantees retries only process remaining files
    #    while RLS continues blocking any file still pending cleanup.
    deleted_paths: list[str] = []
    failed_paths: list[str] = []

    for path in storage_paths:
        try:
            remove_result = db.storage.from_(CHAT_ATTACHMENTS_BUCKET).remove([path])
            if isinstance(remove_result, dict) and remove_result.get("error"):
                raise RuntimeError(str(remove_result["error"]))
            deleted_paths.append(path)
        except Exception as exc:
            failed_paths.append(path)
            logger.error(
                "Soft-deleted message %s but failed to remove Storage attachment %s: %s",
                msg_id_str,
                path,
                exc,
            )

    # Remove metadata rows only for paths whose Storage cleanup succeeded (keep failed rows for retry + RLS protection)
    for path in deleted_paths:
        try:
            (
                db.table("message_attachments")
                .delete()
                .eq("message_id", msg_id_str)
                .eq("conversation_id", conv_id)
                .eq("workspace_id", ws_id)
                .eq("storage_path", path)
                .execute()
            )
        except Exception as exc:
            logger.error(
                "Removed Storage object %s for message %s but failed to delete attachment row: %s",
                path,
                msg_id_str,
                exc,
            )

    failed_count = len(failed_paths)
    storage_cleanup_ok = failed_count == 0
    pending_storage_cleanup = failed_count > 0
    detail = (
        f"Message deleted, but {failed_count} attachment(s) are pending Storage cleanup. "
        "Retry DELETE to finish cleanup."
        if pending_storage_cleanup
        else None
    )

    return DeleteMessageResponse(
        message_id=message_id,
        deleted=True,
        deleted_attachments_count=len(deleted_paths),
        failed_attachments_count=failed_count,
        storage_cleanup_ok=storage_cleanup_ok,
        pending_storage_cleanup=pending_storage_cleanup,
        detail=detail,
    )


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
