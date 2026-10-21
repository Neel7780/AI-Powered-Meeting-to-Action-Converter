"""Email delivery and notification service for ActionPulse (BE-2).

Zero-Budget Tech Stack: Standard Python smtplib with TLS (port 587)
Free-tier providers: Gmail App Password or Brevo SMTP.
No paid APIs (Resend, SendGrid, etc. are strictly forbidden).
"""

import html
import hmac
import logging
import smtplib
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from typing import Any, List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)


def send_email(
    to: str,
    subject: str,
    html: Optional[str] = None,
    text: Optional[str] = None,
    *,
    html_body: Optional[str] = None,
    text_body: Optional[str] = None,
) -> None:
    """Send a transactional email using Python's standard smtplib.
    
    Accepts (to, subject, html, text) per project specification,
    or keyword arguments (html_body=..., text_body=...).
    Raises an exception on failure.
    Security Rule: Never log the email body (PII / security risk).
    """
    final_html = html if html is not None else html_body
    final_text = text if text is not None else text_body

    if final_html is None or final_text is None:
        raise ValueError("Both HTML and text body must be provided to send_email.")

    if not settings.SMTP_HOST or not settings.SMTP_PORT:
        raise RuntimeError("SMTP_HOST and SMTP_PORT are not configured.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.MAIL_FROM
    msg["To"] = to

    # Plain text version first, then HTML alternative
    msg.set_content(final_text)
    msg.add_alternative(final_html, subtype="html")

    logger.info("Connecting to SMTP server at %s:%s", settings.SMTP_HOST, settings.SMTP_PORT)
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
        server.ehlo()
        server.starttls()
        server.ehlo()
        if settings.SMTP_USER and settings.SMTP_PASS:
            server.login(settings.SMTP_USER, settings.SMTP_PASS)
        server.send_message(msg)
    
    logger.info("Email delivered successfully to %s", to)


def send_invite_email(to: str, workspace_name: str, inviter_name: str, link: str) -> None:
    """Send a workspace invitation email to a teammate."""
    safe_workspace = html.escape(workspace_name)
    safe_inviter = html.escape(inviter_name)
    safe_link = html.escape(link, quote=True)

    subject = f"You've been invited to join {workspace_name} on ActionPulse"

    text_body = (
        f"Hello,\n\n"
        f"{inviter_name} has invited you to collaborate on the \"{workspace_name}\" workspace on ActionPulse.\n\n"
        f"Accept your invitation here:\n"
        f"{link}\n\n"
        f"This invitation link will expire in 7 days.\n"
        f"If you did not expect this invitation, you can safely ignore this email.\n\n"
        f"— The ActionPulse Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{safe_workspace} Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 32px 32px 24px 32px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">ActionPulse</h1>
        <p style="color: #c7d2fe; margin: 6px 0 0 0; font-size: 14px;">Meeting-to-Action Converter</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">You've been invited to join a workspace</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155;">
          <strong>{safe_inviter}</strong> has invited you to collaborate on <strong>{safe_workspace}</strong>.
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="{safe_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">Accept Invitation</a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          This link will expire in 7 days. If you did not expect this invitation, you can safely ignore this email.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 32px; background-color: #f1f5f9; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ActionPulse &bull; Zero-Budget Meeting Automation</p>
      </td>
    </tr>
  </table>
</body>
</html>"""

    send_email(to=to, subject=subject, html_body=html_body, text_body=text_body)


def _format_deadline(deadline_utc_str: Optional[str], tz_name: str) -> str:
    """Format UTC ISO deadline into the user's local timezone."""
    if not deadline_utc_str:
        return "No deadline specified"
    try:
        dt = datetime.fromisoformat(deadline_utc_str.replace("Z", "+00:00"))
        try:
            tz = ZoneInfo(tz_name)
        except Exception:
            tz = ZoneInfo("Asia/Kolkata")
        local_dt = dt.astimezone(tz)
        return local_dt.strftime("%d %b %Y, %I:%M %p (%Z)")
    except Exception:
        return str(deadline_utc_str)


def notify_tasks_assigned(meeting_id: UUID | str, task_ids: List[UUID | str]) -> None:
    """Notify primary assignees of newly confirmed tasks after meeting review.
    
    This function is run as a FastAPI BackgroundTask.
    It MUST NEVER RAISE an unhandled exception.
    """
    meeting_id_str = str(meeting_id)
    task_ids_str = [str(tid) for tid in task_ids]

    if not task_ids_str:
        logger.info("notify_tasks_assigned: No task IDs provided for meeting %s", meeting_id_str)
        return

    try:
        supabase = get_supabase_client()
    except Exception as e:
        logger.error("notify_tasks_assigned: Failed to get Supabase client: %s", e)
        return

    try:
        # 1. Fetch meeting & workspace
        meeting_resp = supabase.table("meetings").select("id, title, workspace_id").eq("id", meeting_id_str).execute()
        if not meeting_resp.data:
            logger.warning("notify_tasks_assigned: Meeting %s not found", meeting_id_str)
            return
        
        meeting = meeting_resp.data[0]
        workspace_id = meeting["workspace_id"]
        meeting_title = meeting.get("title") or "Meeting"

        # 2. Fetch tasks
        tasks_resp = (
            supabase.table("tasks")
            .select("id, title, deadline_utc, priority, source_excerpt, external_owner_label")
            .in_("id", task_ids_str)
            .execute()
        )
        tasks_map = {t["id"]: t for t in (tasks_resp.data or [])}

        # 3. Fetch primary assignees (Note: tasks do NOT have user_id, use task_assignees)
        assignees_resp = (
            supabase.table("task_assignees")
            .select("task_id, user_id, is_primary")
            .in_("task_id", task_ids_str)
            .eq("is_primary", True)
            .execute()
        )
        task_primary_assignee = {a["task_id"]: a["user_id"] for a in (assignees_resp.data or [])}

        # Group task IDs by primary assignee
        user_tasks_map: dict[str, list[dict]] = defaultdict(list)
        for tid, task in tasks_map.items():
            # Skip tasks with external owner labels or no primary member assignee
            if task.get("external_owner_label"):
                continue
            assignee_id = task_primary_assignee.get(tid)
            if not assignee_id:
                continue
            user_tasks_map[assignee_id].append(task)

        if not user_tasks_map:
            logger.info("notify_tasks_assigned: No member-assigned tasks found for meeting %s", meeting_id_str)
            return

        candidate_user_ids = list(user_tasks_map.keys())

        # 4. Filter: verify assignees are STILL active workspace members
        members_resp = (
            supabase.table("workspace_members")
            .select("user_id")
            .eq("workspace_id", workspace_id)
            .in_("user_id", candidate_user_ids)
            .execute()
        )
        active_member_ids = {m["user_id"] for m in (members_resp.data or [])}

        # 5. Fetch profiles of active member assignees
        if not active_member_ids:
            logger.info("notify_tasks_assigned: No active workspace members among assignees for meeting %s", meeting_id_str)
            return

        profiles_resp = (
            supabase.table("profiles")
            .select("id, email, display_name, timezone")
            .in_("id", list(active_member_ids))
            .execute()
        )
        profiles_map = {p["id"]: p for p in (profiles_resp.data or [])}

        emails_sent_count = 0
        tasks_notified_count = 0

        # 6. Process each active assignee
        for user_id, assigned_tasks in user_tasks_map.items():
            if user_id not in active_member_ids or user_id not in profiles_map:
                continue

            profile = profiles_map[user_id]
            user_email = profile.get("email")
            if not user_email:
                continue

            user_display_name = profile.get("display_name") or user_email.split("@")[0]
            user_tz = profile.get("timezone") or "Asia/Kolkata"

            # Check idempotency per task before batching
            tasks_to_email: list[dict] = []
            idempotency_keys: list[str] = []

            for task in assigned_tasks:
                task_id = task["id"]
                key = f"task_assigned:email:{task_id}:{user_id}"

                # Try inserting pending row
                try:
                    supabase.table("notifications").insert({
                        "user_id": user_id,
                        "task_id": task_id,
                        "channel": "email",
                        "event_type": "task_assigned",
                        "status": "pending",
                        "attempt": 0,
                        "idempotency_key": key
                    }).execute()
                    tasks_to_email.append(task)
                    idempotency_keys.append(key)
                except Exception as insert_err:
                    # If conflict or already present, skip this task
                    logger.debug("notify_tasks_assigned: Notification key %s exists or failed: %s", key, insert_err)
                    continue

                # SHOULD: Also record in-app notification row for UI bell
                in_app_key = f"task_assigned:in_app:{task_id}:{user_id}"
                try:
                    supabase.table("notifications").insert({
                        "user_id": user_id,
                        "task_id": task_id,
                        "channel": "in_app",
                        "event_type": "task_assigned",
                        "status": "sent",
                        "attempt": 0,
                        "idempotency_key": in_app_key
                    }).execute()
                except Exception:
                    # In-app conflict or failure is non-blocking
                    pass

            # If all tasks were already emailed, skip sending email
            if not tasks_to_email:
                continue

            # Build consolidated email
            board_url = f"{settings.APP_URL.rstrip('/')}/w/{workspace_id}/board"
            task_count = len(tasks_to_email)
            subject = (
                f"[ActionPulse] New Task Assigned: {tasks_to_email[0]['title']}"
                if task_count == 1
                else f"[ActionPulse] {task_count} New Tasks Assigned from \"{meeting_title}\""
            )

            # Build text body
            text_lines = [
                f"Hello {user_display_name},",
                f"",
                f"You have been assigned {task_count} new action item{'s' if task_count > 1 else ''} from \"{meeting_title}\":",
                f""
            ]
            for t in tasks_to_email:
                deadline_str = _format_deadline(t.get("deadline_utc"), user_tz)
                text_lines.append(f"• {t.get('title')}")
                text_lines.append(f"  Priority: {t.get('priority', 'normal').upper()} | Deadline: {deadline_str}")
                if t.get("source_excerpt"):
                    text_lines.append(f"  Quote: \"{t.get('source_excerpt')}\"")
                text_lines.append("")
            text_lines.append(f"View your task board: {board_url}")
            text_lines.append("")
            text_lines.append("— ActionPulse Notification System")
            text_body = "\n".join(text_lines)

            # Build HTML body
            task_cards_html = []
            for t in tasks_to_email:
                deadline_str = html.escape(_format_deadline(t.get("deadline_utc"), user_tz))
                t_title = html.escape(t.get("title", "Untitled Task"))
                t_priority = html.escape(t.get("priority", "normal").capitalize())
                t_quote = html.escape(t.get("source_excerpt", ""))
                
                badge_bg = "#fef3c7" if t_priority.lower() == "urgent" else "#e0e7ff"
                badge_color = "#92400e" if t_priority.lower() == "urgent" else "#3730a3"

                quote_block = (
                    f'<blockquote style="margin: 8px 0 0 0; padding: 6px 12px; background: #f8fafc; border-left: 3px solid #cbd5e1; font-style: italic; color: #475569; font-size: 13px;">"{t_quote}"</blockquote>'
                    if t_quote else ""
                )

                task_cards_html.append(f"""
                <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                    <strong style="font-size: 15px; color: #0f172a;">{t_title}</strong>
                    <span style="display: inline-block; background-color: {badge_bg}; color: {badge_color}; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 9999px; text-transform: uppercase;">{t_priority}</span>
                  </div>
                  <p style="margin: 4px 0; font-size: 13px; color: #64748b;">
                    ⏰ <strong>Deadline:</strong> {deadline_str}
                  </p>
                  {quote_block}
                </div>
                """)

            cards_markup = "\n".join(task_cards_html)
            safe_board_url = html.escape(board_url, quote=True)
            safe_meeting_title = html.escape(meeting_title)
            safe_user_name = html.escape(user_display_name)

            html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Action Item Assignment</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 28px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">ActionPulse</h1>
        <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 13px;">New Action Items Assigned</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <h2 style="font-size: 17px; margin-top: 0; color: #0f172a;">Hello {safe_user_name},</h2>
        <p style="font-size: 14px; line-height: 1.5; color: #334155;">
          You have been assigned <strong>{task_count}</strong> new action item{'s' if task_count > 1 else ''} from the meeting <em>"{safe_meeting_title}"</em>:
        </p>
        <div style="margin: 20px 0;">
          {cards_markup}
        </div>
        <div style="margin: 24px 0; text-align: center;">
          <a href="{safe_board_url}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Open Kanban Board</a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 28px; background-color: #f1f5f9; text-align: center; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">ActionPulse Notification System &bull; Zero-Budget Meeting Automation</p>
      </td>
    </tr>
  </table>
</body>
</html>"""

            # Send email & update status
            now_iso = datetime.now(timezone.utc).isoformat()
            try:
                send_email(to=user_email, subject=subject, html_body=html_body, text_body=text_body)
                emails_sent_count += 1
                tasks_notified_count += len(tasks_to_email)

                # Mark notifications as sent
                for key in idempotency_keys:
                    try:
                        supabase.table("notifications").update({
                            "status": "sent",
                            "sent_at": now_iso
                        }).eq("idempotency_key", key).execute()
                    except Exception as upd_err:
                        logger.warning("notify_tasks_assigned: Failed to mark sent for key %s: %s", key, upd_err)

            except Exception as send_err:
                logger.error("notify_tasks_assigned: Failed to send email to %s: %s", user_email, send_err)
                next_try = (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()
                for key in idempotency_keys:
                    try:
                        supabase.table("notifications").update({
                            "status": "failed",
                            "last_error": str(send_err)[:500],
                            "attempt": 1,
                            "next_attempt_at": next_try
                        }).eq("idempotency_key", key).execute()
                    except Exception:
                        pass

        logger.info(
            "notify_tasks_assigned complete for meeting %s: sent %d email(s) covering %d task(s)",
            meeting_id_str, emails_sent_count, tasks_notified_count
        )

    except Exception as exc:
        # Crucial: background job must never raise
        logger.error("notify_tasks_assigned: Unexpected error in background job: %s", exc, exc_info=True)
