"""Meeting Follow-Up Drafting and Dispatch API."""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.deps import (
    ORGANISER_ROLES,
    CurrentUser,
    get_current_user,
    require_meeting_role,
)
from app.schemas.followup import (
    DraftFollowUpRequest,
    DraftFollowUpResponse,
    SendFollowUpRequest,
    SendFollowUpResponse,
)
from app.services.email import send_meeting_followup
from app.services.llm.followup_generator import generate_meeting_followup

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/{meeting_id}/draft-followup",
    response_model=DraftFollowUpResponse,
    status_code=status.HTTP_200_OK,
    summary="1-Click personalized follow-up generation"
)
def draft_followup(
    meeting_id: UUID,
    payload: DraftFollowUpRequest,
    user: CurrentUser = Depends(get_current_user)
) -> DraftFollowUpResponse:
    """Generate a personalized follow-up draft from a meeting.
    
    Synthesizes transcript segments, confirmed tasks, and key decisions.
    Supports targeting a specific member or the whole team, with tone presets:
    'executive' (brief), 'action_focused' (task grid), or 'chat' (Slack/WhatsApp).
    """
    require_meeting_role(meeting_id, ORGANISER_ROLES, user)

    try:
        response = generate_meeting_followup(
            meeting_id=meeting_id,
            target_user_id=payload.target_user_id,
            target_name=payload.target_name,
            tone=payload.tone
        )
        return response
    except Exception as exc:
        logger.error("Failed to generate follow-up draft for meeting %s: %s", meeting_id, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Follow-up generation failed: {exc}"
        ) from exc


def _markdown_to_simple_html(md_text: str) -> str:
    """Convert basic markdown syntax to email-safe HTML for follow-up emails."""
    import html as py_html
    import re
    lines = md_text.splitlines()
    html_lines = []
    in_list = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append("<br/>")
            continue

        if stripped.startswith("### "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h3 style='margin:16px 0 8px 0; color:#312e81;'>{py_html.escape(stripped[4:])}</h3>")
            continue
        if stripped.startswith("## "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h2 style='margin:18px 0 10px 0; color:#312e81;'>{py_html.escape(stripped[3:])}</h2>")
            continue
        if stripped.startswith("# "):
            if in_list:
                html_lines.append("</ul>")
                in_list = False
            html_lines.append(f"<h1 style='margin:20px 0 12px 0; color:#312e81;'>{py_html.escape(stripped[2:])}</h1>")
            continue

        if stripped.startswith("- ") or stripped.startswith("* "):
            if not in_list:
                html_lines.append("<ul style='margin:8px 0; padding-left:20px;'>")
                in_list = True
            item_text = py_html.escape(stripped[2:])
            item_text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", item_text)
            html_lines.append(f"<li style='margin-bottom:4px;'>{item_text}</li>")
            continue

        if in_list:
            html_lines.append("</ul>")
            in_list = False

        item_text = py_html.escape(stripped)
        item_text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", item_text)
        html_lines.append(f"<p style='margin:6px 0;'>{item_text}</p>")

    if in_list:
        html_lines.append("</ul>")

    body_inner = "\n".join(html_lines)
    return (
        f"<div style='font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;"
        f"font-size:14px;line-height:1.6;color:#18181b;max-width:650px;'>{body_inner}</div>"
    )


@router.post(
    "/{meeting_id}/send-followup",
    response_model=SendFollowUpResponse,
    status_code=status.HTTP_200_OK,
    summary="Dispatch finalized follow-up via email"
)
def send_followup(
    meeting_id: UUID,
    payload: SendFollowUpRequest,
    user: CurrentUser = Depends(get_current_user)
) -> SendFollowUpResponse:
    """Dispatch the follow-up email to specified recipient addresses.
    
    Uses zero-budget Brevo HTTPS API or standard smtplib.
    """
    require_meeting_role(meeting_id, ORGANISER_ROLES, user)

    if not payload.recipient_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient email address must be provided"
        )

    html_content = payload.content_html
    if not html_content or (payload.content_markdown and payload.content_markdown not in html_content):
        html_content = _markdown_to_simple_html(payload.content_markdown)

    sent_count, failed = send_meeting_followup(
        to_emails=payload.recipient_emails,
        subject=payload.subject,
        html_body=html_content,
        text_body=payload.content_markdown,
        meeting_id=meeting_id
    )

    if sent_count == 0 and failed:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to deliver follow-up email to: {', '.join(failed)}"
        )

    return SendFollowUpResponse(
        success=True,
        recipients_count=sent_count,
        message=f"Follow-up successfully delivered to {sent_count} recipient(s).",
        failed_recipients=failed
    )
