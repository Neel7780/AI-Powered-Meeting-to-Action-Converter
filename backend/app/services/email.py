"""Email delivery and notification service for ActionPulse (BE-2).

Zero-Budget Tech Stack: Brevo free HTTPS API when BREVO_API_KEY is set (Render's
free tier blocks outbound SMTP ports), else standard smtplib with TLS (port 587).
No paid APIs (Resend, SendGrid, etc. are strictly forbidden).
"""

import html
import hmac
import logging
import smtplib
from collections import defaultdict
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Any, List, Optional
from uuid import UUID
from zoneinfo import ZoneInfo

import httpx

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

    if settings.BREVO_API_KEY:
        sender_name, sender_email = parseaddr(settings.MAIL_FROM)
        resp = httpx.post(
            "https://api.brevo.com/v3/smtp/email",
            headers={"api-key": settings.BREVO_API_KEY},
            json={
                "sender": {"name": sender_name or "ActionPulse", "email": sender_email},
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": final_html,
                "textContent": final_text,
            },
            timeout=10,
        )
        if resp.is_error:
            raise RuntimeError(f"Brevo API error {resp.status_code}: {resp.text[:300]}")
        logger.info("Email delivered via Brevo API to %s", to)
        return

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


def send_meeting_reminder_email(
    to: str,
    user_name: str,
    meeting_title: str,
    starts_at_str: str,
    tz_name: str = "Asia/Kolkata",
    conference_url: Optional[str] = None,
    meeting_link: str = "",
) -> None:
    """Send an upcoming meeting reminder email with call details."""
    safe_name = html.escape(user_name)
    safe_title = html.escape(meeting_title)
    formatted_time = _format_deadline(starts_at_str, tz_name)
    safe_time = html.escape(formatted_time)
    safe_meeting_link = html.escape(meeting_link, quote=True) if meeting_link else ""
    safe_conf_url = html.escape(conference_url, quote=True) if conference_url else ""

    subject = f"[ActionPulse] Upcoming Meeting: {meeting_title}"

    text_body = (
        f"Hello {user_name},\n\n"
        f"This is a reminder that your meeting \"{meeting_title}\" is starting soon:\n"
        f"Scheduled: {formatted_time}\n"
    )
    if conference_url:
        text_body += f"Join Call: {conference_url}\n"
    if meeting_link:
        text_body += f"View in ActionPulse: {meeting_link}\n"
    text_body += (
        f"\nAfter the meeting, upload your notes or transcript to ActionPulse "
        f"to extract grounded action items and sync with your task board.\n\n"
        f"— The ActionPulse Team"
    )

    conf_button = ""
    if safe_conf_url:
        conf_button = (
            f'<a href="{safe_conf_url}" style="background-color: #059669; color: #ffffff; padding: 11px 22px; '
            f'text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block; '
            f'margin-right: 12px;">Join Video Call</a>'
        )

    actionpulse_button = ""
    if safe_meeting_link:
        actionpulse_button = (
            f'<a href="{safe_meeting_link}" style="background-color: #4f46e5; color: #ffffff; padding: 11px 22px; '
            f'text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">'
            f'Open in ActionPulse</a>'
        )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upcoming Meeting Reminder</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 28px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">ActionPulse</h1>
        <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 13px;">Upcoming Meeting Reminder</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Hello {safe_name},</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          You have an upcoming meeting scheduled:
        </p>
        <div style="margin: 20px 0; padding: 18px; background: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 6px;">
          <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #0f172a;">{safe_title}</h3>
          <p style="margin: 0; font-size: 14px; color: #475569;">
            <strong>Scheduled:</strong> {safe_time}
          </p>
        </div>
        <div style="margin: 24px 0;">
          {conf_button}
          {actionpulse_button}
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-top: 24px;">
          Tip: After the meeting concludes, upload the transcript to ActionPulse to automatically extract action items, owners, and deadlines.
        </p>
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

    send_email(to=to, subject=subject, html_body=html_body, text_body=text_body)


def send_meeting_transcript_nudge_email(
    to: str,
    organiser_name: str,
    meeting_title: str,
    upload_link: str,
) -> None:
    """Send a post-meeting nudge to the organiser to upload notes/transcript."""
    safe_name = html.escape(organiser_name)
    safe_title = html.escape(meeting_title)
    safe_upload_link = html.escape(upload_link, quote=True)

    subject = f"[ActionPulse] Action Required: Upload notes for \"{meeting_title}\""

    text_body = (
        f"Hello {organiser_name},\n\n"
        f"Your meeting \"{meeting_title}\" recently concluded. Don't let action items get lost in unstructured chat!\n\n"
        f"Upload your transcript (.vtt, .srt, .docx, .txt) or paste your meeting notes to extract action items with AI grounding:\n"
        f"{upload_link}\n\n"
        f"— The ActionPulse Team"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Upload Meeting Notes</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <tr>
      <td style="padding: 28px; background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700;">ActionPulse</h1>
        <p style="color: #c7d2fe; margin: 4px 0 0 0; font-size: 13px;">Post-Meeting Action Required</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 28px;">
        <h2 style="font-size: 18px; margin-top: 0; color: #0f172a;">Hello {safe_name},</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Your meeting <strong>"{safe_title}"</strong> has finished. Don't let key commitments and tasks get lost in chat groups or forgotten notes.
        </p>
        <div style="margin: 20px 0; padding: 18px; background: #fdf4ff; border-left: 4px solid #a855f7; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #581c87; font-weight: 500;">
            Upload your notes or transcript to extract action items, owners, and deadlines backed by verbatim transcript quotes.
          </p>
        </div>
        <div style="margin: 28px 0; text-align: center;">
          <a href="{safe_upload_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Upload Transcript & Extract Tasks</a>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Once extracted, you can quickly review, approve, and automatically dispatch tasks directly to your team's Kanban board.
        </p>
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

    send_email(to=to, subject=subject, html_body=html_body, text_body=text_body)


def process_pre_meeting_reminders(window_minutes: int = 60) -> int:
    """Find meetings starting within window_minutes and notify participants.
    
    Ensures idempotency via unique key in notifications table.
    """
    try:
        supabase = get_supabase_client()
    except Exception as exc:
        logger.error("process_pre_meeting_reminders: Supabase connection failed: %s", exc)
        return 0

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(minutes=window_minutes)

    try:
        meetings_resp = (
            supabase.table("meetings")
            .select("id, title, starts_at, timezone, organiser_id, workspace_id, conference_url")
            .gte("starts_at", now.isoformat())
            .lte("starts_at", window_end.isoformat())
            .eq("lifecycle", "active")
            .neq("status", "archived")
            .execute()
        )
        meetings = meetings_resp.data or []
        if not meetings:
            return 0

        total_reminders_sent = 0

        for m in meetings:
            m_id = m["id"]
            m_title = m.get("title") or "Meeting"
            starts_at_str = m.get("starts_at")
            tz = m.get("timezone") or "Asia/Kolkata"
            conf_url = m.get("conference_url")
            meeting_link = f"{settings.APP_URL.rstrip('/')}/meetings/{m_id}/review"

            # Gather participants
            user_ids_to_notify: set[str] = set()
            if m.get("organiser_id"):
                user_ids_to_notify.add(str(m["organiser_id"]))

            parts_resp = (
                supabase.table("meeting_participants")
                .select("user_id")
                .eq("meeting_id", m_id)
                .not_.is_("user_id", "null")
                .execute()
            )
            for p in (parts_resp.data or []):
                if p.get("user_id"):
                    user_ids_to_notify.add(str(p["user_id"]))

            if not user_ids_to_notify:
                continue

            # Verify active workspace membership
            wm_resp = (
                supabase.table("workspace_members")
                .select("user_id")
                .eq("workspace_id", m["workspace_id"])
                .in_("user_id", list(user_ids_to_notify))
                .execute()
            )
            active_ids = {row["user_id"] for row in (wm_resp.data or [])}
            if not active_ids:
                continue

            # Fetch profiles
            prof_resp = (
                supabase.table("profiles")
                .select("id, email, display_name, timezone")
                .in_("id", list(active_ids))
                .execute()
            )
            profiles_map = {row["id"]: row for row in (prof_resp.data or [])}

            for uid in active_ids:
                prof = profiles_map.get(uid)
                if not prof or not prof.get("email"):
                    continue

                user_email = prof["email"]
                user_name = prof.get("display_name") or user_email.split("@")[0]
                user_tz = prof.get("timezone") or tz

                key = f"meeting_reminder:email:{m_id}:{uid}"
                now_iso = datetime.now(timezone.utc).isoformat()

                # Idempotent insert in notifications table
                try:
                    payload = {
                        "user_id": uid,
                        "channel": "email",
                        "event_type": "meeting_reminder",
                        "status": "pending",
                        "attempt": 0,
                        "idempotency_key": key,
                    }
                    try:
                        payload["meeting_id"] = str(m_id)
                        supabase.table("notifications").insert(payload).execute()
                    except Exception:
                        # Fallback if meeting_id column isn't migrated yet
                        payload.pop("meeting_id", None)
                        supabase.table("notifications").insert(payload).execute()
                except Exception as insert_err:
                    # Duplicate key or already present -> skip
                    continue

                # In-app notification
                in_app_key = f"meeting_reminder:in_app:{m_id}:{uid}"
                try:
                    in_app_payload = {
                        "user_id": uid,
                        "channel": "in_app",
                        "event_type": "meeting_reminder",
                        "status": "sent",
                        "sent_at": now_iso,
                        "idempotency_key": in_app_key,
                    }
                    try:
                        in_app_payload["meeting_id"] = str(m_id)
                        supabase.table("notifications").insert(in_app_payload).execute()
                    except Exception:
                        in_app_payload.pop("meeting_id", None)
                        supabase.table("notifications").insert(in_app_payload).execute()
                except Exception:
                    pass

                # Dispatch email
                try:
                    send_meeting_reminder_email(
                        to=user_email,
                        user_name=user_name,
                        meeting_title=m_title,
                        starts_at_str=starts_at_str,
                        tz_name=user_tz,
                        conference_url=conf_url,
                        meeting_link=meeting_link,
                    )
                    supabase.table("notifications").update({
                        "status": "sent",
                        "sent_at": now_iso,
                    }).eq("idempotency_key", key).execute()
                    total_reminders_sent += 1
                except Exception as send_err:
                    logger.error("Failed to send pre-meeting reminder to %s: %s", user_email, send_err)
                    supabase.table("notifications").update({
                        "status": "failed",
                        "last_error": str(send_err)[:500],
                        "attempt": 1,
                    }).eq("idempotency_key", key).execute()

        return total_reminders_sent
    except Exception as exc:
        logger.error("process_pre_meeting_reminders error: %s", exc, exc_info=True)
        return 0


def process_post_meeting_nudges(min_age_minutes: int = 15, max_age_hours: int = 24) -> int:
    """Find ended meetings without transcripts and nudge the organiser."""
    try:
        supabase = get_supabase_client()
    except Exception as exc:
        logger.error("process_post_meeting_nudges: Supabase connection failed: %s", exc)
        return 0

    now = datetime.now(timezone.utc)
    min_time = now - timedelta(hours=max_age_hours)
    max_time = now - timedelta(minutes=min_age_minutes)

    try:
        meetings_resp = (
            supabase.table("meetings")
            .select("id, title, starts_at, organiser_id, workspace_id")
            .gte("starts_at", min_time.isoformat())
            .lte("starts_at", max_time.isoformat())
            .eq("status", "draft")
            .eq("lifecycle", "active")
            .execute()
        )
        meetings = meetings_resp.data or []
        if not meetings:
            return 0

        # Check which of these already have transcripts
        meeting_ids = [m["id"] for m in meetings]
        transcripts_resp = (
            supabase.table("transcripts")
            .select("meeting_id")
            .in_("meeting_id", meeting_ids)
            .execute()
        )
        transcribed_ids = {row["meeting_id"] for row in (transcripts_resp.data or [])}

        total_nudges_sent = 0

        for m in meetings:
            m_id = m["id"]
            if m_id in transcribed_ids:
                continue

            organiser_id = str(m.get("organiser_id"))
            if not organiser_id:
                continue

            # Verify organiser is still an active workspace member
            wm_resp = (
                supabase.table("workspace_members")
                .select("user_id")
                .eq("workspace_id", m["workspace_id"])
                .eq("user_id", organiser_id)
                .execute()
            )
            if not (wm_resp.data or []):
                continue

            # Fetch organiser profile
            prof_resp = (
                supabase.table("profiles")
                .select("email, display_name")
                .eq("id", organiser_id)
                .execute()
            )
            profiles = prof_resp.data or []
            if not profiles or not profiles[0].get("email"):
                continue

            organiser_email = profiles[0]["email"]
            organiser_name = profiles[0].get("display_name") or organiser_email.split("@")[0]
            m_title = m.get("title") or "Meeting"
            upload_link = f"{settings.APP_URL.rstrip('/')}/meetings/{m_id}/review"

            key = f"meeting_transcript_nudge:email:{m_id}:{organiser_id}"
            now_iso = datetime.now(timezone.utc).isoformat()

            # Idempotent insert
            try:
                payload = {
                    "user_id": organiser_id,
                    "channel": "email",
                    "event_type": "meeting_transcript_nudge",
                    "status": "pending",
                    "attempt": 0,
                    "idempotency_key": key,
                }
                try:
                    payload["meeting_id"] = str(m_id)
                    supabase.table("notifications").insert(payload).execute()
                except Exception:
                    payload.pop("meeting_id", None)
                    supabase.table("notifications").insert(payload).execute()
            except Exception:
                # Already nudged -> skip
                continue

            # In-app notification
            in_app_key = f"meeting_transcript_nudge:in_app:{m_id}:{organiser_id}"
            try:
                in_app_payload = {
                    "user_id": organiser_id,
                    "channel": "in_app",
                    "event_type": "meeting_transcript_nudge",
                    "status": "sent",
                    "sent_at": now_iso,
                    "idempotency_key": in_app_key,
                }
                try:
                    in_app_payload["meeting_id"] = str(m_id)
                    supabase.table("notifications").insert(in_app_payload).execute()
                except Exception:
                    in_app_payload.pop("meeting_id", None)
                    supabase.table("notifications").insert(in_app_payload).execute()
            except Exception:
                pass

            # Dispatch email
            try:
                send_meeting_transcript_nudge_email(
                    to=organiser_email,
                    organiser_name=organiser_name,
                    meeting_title=m_title,
                    upload_link=upload_link,
                )
                supabase.table("notifications").update({
                    "status": "sent",
                    "sent_at": now_iso,
                }).eq("idempotency_key", key).execute()
                total_nudges_sent += 1
            except Exception as send_err:
                logger.error("Failed to send post-meeting nudge to %s: %s", organiser_email, send_err)
                supabase.table("notifications").update({
                    "status": "failed",
                    "last_error": str(send_err)[:500],
                    "attempt": 1,
                }).eq("idempotency_key", key).execute()

        return total_nudges_sent
    except Exception as exc:
        logger.error("process_post_meeting_nudges error: %s", exc, exc_info=True)
        return 0


def process_all_meeting_notifications() -> dict[str, int]:
    """Execute both pre-meeting reminders and post-meeting transcript nudges safely."""
    reminders = process_pre_meeting_reminders()
    nudges = process_post_meeting_nudges()
    return {
        "pre_meeting_reminders_sent": reminders,
        "post_meeting_nudges_sent": nudges,
    }
