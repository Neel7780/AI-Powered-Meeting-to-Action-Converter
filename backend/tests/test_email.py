"""Tests for BE-2 Email & Notification Service."""

import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4

from app.core.config import settings
from app.services.email import (
    send_email,
    send_invite_email,
    notify_tasks_assigned,
    _format_deadline,
)


def create_mock_supabase(tables: dict):
    """Helper to create a mock Supabase client where each table returns isolated data."""
    client = MagicMock()
    table_mocks = {}

    for name, data in tables.items():
        tm = MagicMock()
        tm.select.return_value = tm
        tm.in_.return_value = tm
        tm.eq.return_value = tm
        tm.limit.return_value = tm
        tm.insert.return_value = tm
        tm.update.return_value = tm
        tm.execute.return_value = MagicMock(data=data)
        table_mocks[name] = tm

    client.table.side_effect = lambda tname: table_mocks.get(tname, MagicMock())
    return client, table_mocks


class TestEmailDelivery:
    """Unit tests for low-level send_email and invite templates."""

    @patch("smtplib.SMTP")
    def test_send_email_success(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        send_email(
            to="test@example.com",
            subject="Test Subject",
            html_body="<p>Test HTML</p>",
            text_body="Test Text"
        )

        mock_smtp_cls.assert_called_once_with(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        mock_server.starttls.assert_called_once()
        mock_server.send_message.assert_called_once()

        # Verify message headers
        sent_msg = mock_server.send_message.call_args[0][0]
        assert sent_msg["To"] == "test@example.com"
        assert sent_msg["Subject"] == "Test Subject"
        assert sent_msg["From"] == settings.MAIL_FROM

    @patch("smtplib.SMTP")
    def test_send_email_positional_and_keywords(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        # Test positional: send_email(to, subject, html, text)
        send_email("pos@example.com", "Pos Subject", "<p>Pos HTML</p>", "Pos Text")
        sent_msg = mock_server.send_message.call_args[0][0]
        assert sent_msg["To"] == "pos@example.com"

        # Test keyword: send_email(to=..., subject=..., html=..., text=...)
        send_email(to="kw@example.com", subject="KW Subject", html="<p>KW HTML</p>", text="KW Text")
        sent_msg2 = mock_server.send_message.call_args[0][0]
        assert sent_msg2["To"] == "kw@example.com"

    def test_send_email_missing_body_raises_value_error(self):
        with pytest.raises(ValueError, match="Both HTML and text body must be provided"):
            send_email(to="test@example.com", subject="Test")

    @patch("smtplib.SMTP")
    def test_send_email_raises_on_failure(self, mock_smtp_cls):
        mock_server = MagicMock()
        mock_server.send_message.side_effect = Exception("SMTP Connection Failed")
        mock_smtp_cls.return_value.__enter__.return_value = mock_server

        with pytest.raises(Exception, match="SMTP Connection Failed"):
            send_email(
                to="fail@example.com",
                subject="Fail",
                html_body="<p>Fail</p>",
                text_body="Fail"
            )

    @patch("smtplib.SMTP")
    @patch("app.services.email.httpx.post")
    def test_send_email_uses_brevo_api_when_key_set(self, mock_post, mock_smtp_cls):
        mock_post.return_value = MagicMock(is_error=False)
        with patch.object(settings, "BREVO_API_KEY", "xkeysib-test"), \
             patch.object(settings, "MAIL_FROM", "ActionPulse <noreply@example.com>"):
            send_email("api@example.com", "API Subject", "<p>H</p>", "T")

        mock_smtp_cls.assert_not_called()
        payload = mock_post.call_args.kwargs["json"]
        assert mock_post.call_args.kwargs["headers"] == {"api-key": "xkeysib-test"}
        assert payload["sender"] == {"name": "ActionPulse", "email": "noreply@example.com"}
        assert payload["to"] == [{"email": "api@example.com"}]

        mock_post.return_value = MagicMock(is_error=True, status_code=401, text="unauthorized")
        with patch.object(settings, "BREVO_API_KEY", "bad"), pytest.raises(RuntimeError, match="401"):
            send_email("api@example.com", "S", "<p>H</p>", "T")

    @patch("app.services.email.send_email")
    def test_send_invite_email(self, mock_send_email):
        send_invite_email(
            to="invitee@example.com",
            workspace_name="Engineering Core",
            inviter_name="Aman Shah",
            link="https://actionpulse.app/invite?token=xyz123"
        )

        mock_send_email.assert_called_once()
        args, kwargs = mock_send_email.call_args
        assert kwargs["to"] == "invitee@example.com"
        assert "Engineering Core" in kwargs["subject"]
        assert "Aman Shah" in kwargs["text_body"]
        assert "https://actionpulse.app/invite?token=xyz123" in kwargs["text_body"]


class TestDeadlineFormatting:
    """Unit tests for deadline timezone formatting."""

    def test_format_deadline_utc_to_ist(self):
        # 12:30 UTC = 18:00 IST
        formatted = _format_deadline("2026-10-05T12:30:00Z", "Asia/Kolkata")
        assert "05 Oct 2026" in formatted
        assert "06:00 PM" in formatted

    def test_format_deadline_none(self):
        assert _format_deadline(None, "Asia/Kolkata") == "No deadline specified"

    def test_format_deadline_invalid_tz_fallback(self):
        formatted = _format_deadline("2026-10-05T12:30:00Z", "Invalid/Timezone")
        assert "05 Oct 2026" in formatted


class TestNotifyTasksAssigned:
    """Unit tests for task notification workflow, batching, and idempotency."""

    @patch("app.services.email.send_email")
    @patch("app.services.email.get_supabase_client")
    def test_notify_skips_unassigned_and_external_tasks(self, mock_get_client, mock_send_email):
        meeting_id = str(uuid4())
        t1_id = str(uuid4())
        t2_id = str(uuid4())

        client, _ = create_mock_supabase({
            "meetings": [{"id": meeting_id, "title": "Weekly Sync", "workspace_id": "ws-1"}],
            "tasks": [
                {"id": t1_id, "title": "External Task", "external_owner_label": "Vendor Corp"},
                {"id": t2_id, "title": "Unassigned Task", "external_owner_label": None}
            ],
            "task_assignees": []
        })
        mock_get_client.return_value = client

        notify_tasks_assigned(meeting_id, [t1_id, t2_id])
        mock_send_email.assert_not_called()

    @patch("app.services.email.send_email")
    @patch("app.services.email.get_supabase_client")
    def test_notify_skips_former_workspace_member(self, mock_get_client, mock_send_email):
        meeting_id = str(uuid4())
        task_id = str(uuid4())
        former_user_id = str(uuid4())

        client, _ = create_mock_supabase({
            "meetings": [{"id": meeting_id, "title": "Sprint Planning", "workspace_id": "ws-1"}],
            "tasks": [{"id": task_id, "title": "Fix Auth Bug", "external_owner_label": None, "priority": "high", "source_excerpt": "Quote"}],
            "task_assignees": [{"task_id": task_id, "user_id": former_user_id, "is_primary": True}],
            "workspace_members": []  # Former user is not in workspace
        })
        mock_get_client.return_value = client

        notify_tasks_assigned(meeting_id, [task_id])
        mock_send_email.assert_not_called()

    @patch("app.services.email.send_email")
    @patch("app.services.email.get_supabase_client")
    def test_notify_batches_multiple_tasks_for_same_user(self, mock_get_client, mock_send_email):
        meeting_id = str(uuid4())
        t1_id = str(uuid4())
        t2_id = str(uuid4())
        user_id = str(uuid4())

        client, table_mocks = create_mock_supabase({
            "meetings": [{"id": meeting_id, "title": "Architecture Review", "workspace_id": "ws-1"}],
            "tasks": [
                {"id": t1_id, "title": "Task 1", "priority": "high", "source_excerpt": "Ex 1", "external_owner_label": None},
                {"id": t2_id, "title": "Task 2", "priority": "normal", "source_excerpt": "Ex 2", "external_owner_label": None}
            ],
            "task_assignees": [
                {"task_id": t1_id, "user_id": user_id, "is_primary": True},
                {"task_id": t2_id, "user_id": user_id, "is_primary": True}
            ],
            "workspace_members": [{"user_id": user_id}],
            "profiles": [
                {"id": user_id, "email": "priya@example.com", "display_name": "Priya Nair", "timezone": "Asia/Kolkata"}
            ],
            "notifications": []
        })
        mock_get_client.return_value = client

        notify_tasks_assigned(meeting_id, [t1_id, t2_id])

        # Assert exactly ONE email was sent to Priya containing both tasks
        assert mock_send_email.call_count == 1
        kwargs = mock_send_email.call_args[1]
        assert kwargs["to"] == "priya@example.com"
        assert "2 New Tasks Assigned" in kwargs["subject"]
        assert "Task 1" in kwargs["text_body"]
        assert "Task 2" in kwargs["text_body"]

    @patch("app.services.email.send_email")
    @patch("app.services.email.get_supabase_client")
    def test_notify_idempotency_skips_already_notified_task(self, mock_get_client, mock_send_email):
        meeting_id = str(uuid4())
        task_id = str(uuid4())
        user_id = str(uuid4())

        client, table_mocks = create_mock_supabase({
            "meetings": [{"id": meeting_id, "title": "Review", "workspace_id": "ws-1"}],
            "tasks": [{"id": task_id, "title": "Task 1", "priority": "normal", "source_excerpt": "quote", "external_owner_label": None}],
            "task_assignees": [{"task_id": task_id, "user_id": user_id, "is_primary": True}],
            "workspace_members": [{"user_id": user_id}],
            "profiles": [{"id": user_id, "email": "aman@example.com", "display_name": "Aman", "timezone": "Asia/Kolkata"}],
            "notifications": []
        })
        # Simulate insert error due to unique constraint on idempotency_key
        table_mocks["notifications"].insert.return_value.execute.side_effect = Exception("duplicate key value")
        mock_get_client.return_value = client

        notify_tasks_assigned(meeting_id, [task_id])

        # No email should be sent if all tasks were already notified
        mock_send_email.assert_not_called()


class TestMeetingRemindersAndNudges:
    """Unit tests for pre-meeting reminders and post-meeting transcript nudges."""

    @patch("app.services.email.send_email")
    def test_send_meeting_reminder_email(self, mock_send_email):
        from app.services.email import send_meeting_reminder_email

        send_meeting_reminder_email(
            to="attendee@example.com",
            user_name="Arnav",
            meeting_title="Sprint 2 Planning",
            starts_at_str="2026-10-27T10:00:00Z",
            tz_name="Asia/Kolkata",
            conference_url="https://meet.google.com/abc-defg-hij",
            meeting_link="https://actionpulse.app/meetings/123/review"
        )

        assert mock_send_email.call_count == 1
        kwargs = mock_send_email.call_args[1]
        assert kwargs["to"] == "attendee@example.com"
        assert "Upcoming Meeting: Sprint 2 Planning" in kwargs["subject"]
        assert "meet.google.com/abc-defg-hij" in kwargs["html_body"]
        assert "Arnav" in kwargs["text_body"]

    @patch("app.services.email.send_email")
    def test_send_meeting_transcript_nudge_email(self, mock_send_email):
        from app.services.email import send_meeting_transcript_nudge_email

        send_meeting_transcript_nudge_email(
            to="lead@example.com",
            organiser_name="Lead Organiser",
            meeting_title="Sprint 1 Retrospective",
            upload_link="https://actionpulse.app/meetings/456/review"
        )

        assert mock_send_email.call_count == 1
        kwargs = mock_send_email.call_args[1]
        assert kwargs["to"] == "lead@example.com"
        assert "Action Required: Upload notes" in kwargs["subject"]
        assert "Upload Transcript & Extract Tasks" in kwargs["html_body"]
        assert "Sprint 1 Retrospective" in kwargs["text_body"]

    @patch("app.services.email.send_meeting_reminder_email")
    @patch("app.services.email.get_supabase_client")
    def test_process_pre_meeting_reminders(self, mock_get_client, mock_send_reminder):
        from app.services.email import process_pre_meeting_reminders

        meeting_id = str(uuid4())
        organiser_id = str(uuid4())
        participant_id = str(uuid4())
        workspace_id = str(uuid4())

        client = MagicMock()
        meetings_mock = MagicMock()
        meetings_mock.select.return_value.gte.return_value.lte.return_value.eq.return_value.neq.return_value.execute.return_value = MagicMock(
            data=[{
                "id": meeting_id,
                "title": "Upcoming Standup",
                "starts_at": "2026-10-27T10:00:00Z",
                "timezone": "Asia/Kolkata",
                "organiser_id": organiser_id,
                "workspace_id": workspace_id,
                "conference_url": "https://meet.google.com/xyz",
            }]
        )

        parts_mock = MagicMock()
        parts_mock.select.return_value.eq.return_value.not_.is_.return_value.execute.return_value = MagicMock(
            data=[{"user_id": participant_id}]
        )

        wm_mock = MagicMock()
        wm_mock.select.return_value.eq.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"user_id": organiser_id}, {"user_id": participant_id}]
        )

        prof_mock = MagicMock()
        prof_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[
                {"id": organiser_id, "email": "org@example.com", "display_name": "Org", "timezone": "Asia/Kolkata"},
                {"id": participant_id, "email": "part@example.com", "display_name": "Part", "timezone": "Asia/Kolkata"},
            ]
        )

        notif_mock = MagicMock()
        notif_mock.insert.return_value.execute.return_value = MagicMock(data=[{"id": "1"}])
        notif_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "1"}])

        def table_router(name):
            if name == "meetings":
                return meetings_mock
            elif name == "meeting_participants":
                return parts_mock
            elif name == "workspace_members":
                return wm_mock
            elif name == "profiles":
                return prof_mock
            elif name == "notifications":
                return notif_mock
            return MagicMock()

        client.table.side_effect = table_router
        mock_get_client.return_value = client

        sent_count = process_pre_meeting_reminders(window_minutes=60)
        assert sent_count == 2
        assert mock_send_reminder.call_count == 2

    @patch("app.services.email.send_meeting_transcript_nudge_email")
    @patch("app.services.email.get_supabase_client")
    def test_process_post_meeting_nudges(self, mock_get_client, mock_send_nudge):
        from app.services.email import process_post_meeting_nudges

        meeting_id = str(uuid4())
        organiser_id = str(uuid4())
        workspace_id = str(uuid4())

        client = MagicMock()
        meetings_mock = MagicMock()
        meetings_mock.select.return_value.gte.return_value.lte.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{
                "id": meeting_id,
                "title": "Ended Meeting",
                "starts_at": "2026-10-27T08:00:00Z",
                "organiser_id": organiser_id,
                "workspace_id": workspace_id,
            }]
        )

        transcripts_mock = MagicMock()
        # No transcript uploaded for this meeting yet
        transcripts_mock.select.return_value.in_.return_value.execute.return_value = MagicMock(data=[])

        wm_mock = MagicMock()
        wm_mock.select.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"user_id": organiser_id}]
        )

        prof_mock = MagicMock()
        prof_mock.select.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[{"email": "org@example.com", "display_name": "Org"}]
        )

        notif_mock = MagicMock()
        notif_mock.insert.return_value.execute.return_value = MagicMock(data=[{"id": "1"}])
        notif_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[{"id": "1"}])

        def table_router(name):
            if name == "meetings":
                return meetings_mock
            elif name == "transcripts":
                return transcripts_mock
            elif name == "workspace_members":
                return wm_mock
            elif name == "profiles":
                return prof_mock
            elif name == "notifications":
                return notif_mock
            return MagicMock()

        client.table.side_effect = table_router
        mock_get_client.return_value = client

        nudges_sent = process_post_meeting_nudges(min_age_minutes=15, max_age_hours=24)
        assert nudges_sent == 1
        assert mock_send_nudge.call_count == 1
