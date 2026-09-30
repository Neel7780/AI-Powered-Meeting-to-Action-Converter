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
