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
    meeting_id: str,
    payload: DraftFollowUpRequest,
    user: CurrentUser = Depends(get_current_user)
) -> DraftFollowUpResponse:
    """Generate a personalized follow-up draft from a meeting.
    
    Synthesizes transcript segments, confirmed tasks, and key decisions.
    Supports targeting a specific member or the whole team, with tone presets:
    'executive' (brief), 'action_focused' (task grid), or 'chat' (Slack/WhatsApp).
    """
    try:
        m_uuid = UUID(str(meeting_id))
    except (ValueError, AttributeError):
        m_uuid = UUID("11111111-1111-1111-1111-111111111111")

    require_meeting_role(m_uuid, ORGANISER_ROLES, user)

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


@router.post(
    "/{meeting_id}/send-followup",
    response_model=SendFollowUpResponse,
    status_code=status.HTTP_200_OK,
    summary="Dispatch finalized follow-up via email"
)
def send_followup(
    meeting_id: str,
    payload: SendFollowUpRequest,
    user: CurrentUser = Depends(get_current_user)
) -> SendFollowUpResponse:
    """Dispatch the follow-up email to specified recipient addresses.
    
    Uses zero-budget Brevo HTTPS API or standard smtplib.
    """
    try:
        m_uuid = UUID(str(meeting_id))
    except (ValueError, AttributeError):
        m_uuid = UUID("11111111-1111-1111-1111-111111111111")

    require_meeting_role(m_uuid, ORGANISER_ROLES, user)

    if not payload.recipient_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one recipient email address must be provided"
        )

    html_content = payload.content_html or payload.content_markdown

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
