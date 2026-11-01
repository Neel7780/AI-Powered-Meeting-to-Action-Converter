"""Unit tests for Meeting Follow-Up Drafting and Dispatch API."""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from langchain_core.messages import AIMessage

from app.api.followup import draft_followup, send_followup
from app.core.deps import CurrentUser, DEV_USER_ID
from app.schemas.followup import (
    DraftFollowUpRequest,
    FollowUpTone,
    SendFollowUpRequest,
)


def test_draft_followup_team_wide_success():
    """Admin or organiser can generate a team-wide follow-up draft."""
    meeting_id = uuid4()
    mock_user = CurrentUser(id=DEV_USER_ID, email="admin@actionpulse.app")

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "title": "Sprint 2 Architecture Sync",
        "status": "ready"
    }

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = AIMessage(
        content="SUBJECT: [ActionPulse] Follow-Up: Sprint 2 Architecture Sync\n---BODY---\n### Executive Summary\nThe team aligned on Sprint 2 milestones.\n- [ ] Configure Brevo"
    )

    with patch("app.api.followup.require_meeting_role", return_value=meeting_record), \
         patch("app.services.llm.followup_generator.get_supabase_client", side_effect=RuntimeError("offline")), \
         patch("app.services.llm.followup_generator.ChatGoogleGenerativeAI", return_value=mock_llm):
        res = draft_followup(
            meeting_id=meeting_id,
            payload=DraftFollowUpRequest(tone=FollowUpTone.EXECUTIVE),
            user=mock_user
        )
        assert str(res.meeting_id) == str(meeting_id)
        assert res.tone == FollowUpTone.EXECUTIVE
        assert "Sprint 2" in res.subject
        assert len(res.content_markdown) > 0
        assert len(res.content_html) > 0
        assert res.whatsapp_share_url.startswith("https://wa.me/?text=")
        assert len(res.participants) > 0


def test_draft_followup_personalized_member_success():
    """Generating personalized 1-to-1 follow-up targets specific member."""
    meeting_id = uuid4()
    target_user_id = uuid4()
    mock_user = CurrentUser(id=DEV_USER_ID, email="admin@actionpulse.app")

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "title": "Sprint 2 Architecture Sync",
        "status": "ready"
    }

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = AIMessage(
        content="SUBJECT: [ActionPulse] Follow-Up for Bharat Odedara: Sprint 2 Architecture Sync\n---BODY---\nHi Bharat Odedara,\nHere are your deliverables for this week:\n- [ ] Configure Brevo SMTP"
    )

    with patch("app.api.followup.require_meeting_role", return_value=meeting_record), \
         patch("app.services.llm.followup_generator.get_supabase_client", side_effect=RuntimeError("offline")), \
         patch("app.services.llm.followup_generator.ChatGoogleGenerativeAI", return_value=mock_llm):
        res = draft_followup(
            meeting_id=meeting_id,
            payload=DraftFollowUpRequest(
                target_user_id=target_user_id,
                target_name="Bharat Odedara",
                tone=FollowUpTone.ACTION_FOCUSED
            ),
            user=mock_user
        )
        assert res.target_name == "Bharat Odedara"
        assert res.tone == FollowUpTone.ACTION_FOCUSED
        assert "Bharat Odedara" in res.content_markdown
        assert res.whatsapp_share_url.startswith("https://wa.me/?text=")


def test_draft_followup_chat_tone():
    """Chat tone produces Slack/WhatsApp formatted message with emojis and bullets."""
    meeting_id = uuid4()
    mock_user = CurrentUser(id=DEV_USER_ID, email="admin@actionpulse.app")

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "title": "Product Design Huddle",
        "status": "ready"
    }

    mock_llm = MagicMock()
    mock_llm.invoke.return_value = AIMessage(
        content="SUBJECT: [ActionPulse] Quick Sync Recap\n---BODY---\n👋 Quick recap from today's sync!\n- Deliverables: @Harshil on wa.me link"
    )

    with patch("app.api.followup.require_meeting_role", return_value=meeting_record), \
         patch("app.services.llm.followup_generator.get_supabase_client", side_effect=RuntimeError("offline")), \
         patch("app.services.llm.followup_generator.ChatGoogleGenerativeAI", return_value=mock_llm):
        res = draft_followup(
            meeting_id=meeting_id,
            payload=DraftFollowUpRequest(tone=FollowUpTone.CHAT),
            user=mock_user
        )
        assert res.tone == FollowUpTone.CHAT
        assert "recap" in res.content_markdown.lower()
        assert "https://wa.me/?text=" in res.whatsapp_share_url


def test_send_followup_success():
    """Dispatching email calls zero-budget email service."""
    meeting_id = uuid4()
    mock_user = CurrentUser(id=DEV_USER_ID, email="admin@actionpulse.app")

    meeting_record = {
        "id": str(meeting_id),
        "workspace_id": str(uuid4()),
        "title": "Sprint 2 Architecture Sync",
        "status": "ready"
    }

    with patch("app.api.followup.require_meeting_role", return_value=meeting_record), \
         patch("app.api.followup.send_meeting_followup", return_value=(2, [])):
        res = send_followup(
            meeting_id=meeting_id,
            payload=SendFollowUpRequest(
                recipient_emails=["member1@workspace.io", "member2@workspace.io"],
                subject="[ActionPulse] Follow-Up: Sprint 2 Architecture Sync",
                content_markdown="## Meeting Follow-Up\nKey takeaways...",
                content_html="<p>Meeting Follow-Up</p>"
            ),
            user=mock_user
        )
        assert res.success is True
        assert res.recipients_count == 2
