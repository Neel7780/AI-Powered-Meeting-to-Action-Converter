"""Authentication helper endpoints for ActionPulse.

Endpoints:
- POST /api/auth/forgot-password: Generate and dispatch password recovery link via email.
"""

import logging

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.email import send_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
    redirect_to: str | None = None


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
async def request_password_reset(payload: ForgotPasswordRequest):
    """Generate a password recovery link and dispatch it via ActionPulse email service.

    Sends a direct 1-click recovery link that takes the user directly to the
    password reset screen on their active frontend domain.
    """
    email = payload.email.strip().lower()
    redirect_url = payload.redirect_to or f"{settings.APP_URL.rstrip('/')}/reset-password"

    client = get_supabase_client()

    try:
        link_res = client.auth.admin.generate_link({
            "type": "recovery",
            "email": email,
            "options": {"redirect_to": redirect_url},
        })
    except Exception as exc:
        logger.warning(f"Failed to generate recovery link for email {email}: {exc}")
        # Return generic message to avoid user enumeration while failing gracefully
        return ForgotPasswordResponse(
            success=True,
            message=f"If an account with {email} exists, a password reset link has been sent.",
        )

    otp = getattr(link_res.properties, "email_otp", "")
    raw_action_link = getattr(link_res.properties, "action_link", redirect_url)

    # Construct direct reset URL pointing straight to the frontend reset-password route
    if otp:
        reset_link = f"{redirect_url}?token={otp}&email={email}&flow=reset"
    else:
        # Fallback to Supabase action_link with redirect_to rewritten to active frontend
        reset_link = raw_action_link.replace(
            "redirect_to=http%3A%2F%2Flocalhost%3A3000",
            f"redirect_to={redirect_url}",
        ).replace("redirect_to=http://localhost:3000", f"redirect_to={redirect_url}")

    card_style = (
        "max-width: 520px; margin: 0 auto; background: #111827; border-radius: 16px; "
        "border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden; "
        "box-shadow: 0 10px 25px rgba(0,0,0,0.5);"
    )
    header_style = "padding: 28px 32px 20px; text-align: center; background: linear-gradient(135deg, #0284c7, #0369a1);"
    btn_style = (
        "display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; "
        "padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; "
        "box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);"
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Reset Your ActionPulse Password</title>
</head>
<body style="font-family: -apple-system, sans-serif; background: #090d16; margin: 0; padding: 24px 16px;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="{card_style}">
    <tr>
      <td style="{header_style}">
        <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">ActionPulse</h1>
        <p style="color: #e0f2fe; margin: 4px 0 0; font-size: 13px;">AI-Powered Meeting-to-Action Converter</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 32px;">
        <h2 style="font-size: 18px; color: #ffffff; margin-top: 0; font-weight: 600;">Password Reset Request</h2>
        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your account (<strong>{email}</strong>).
          Click the button below to choose a new password:
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="{reset_link}" style="{btn_style}">
            Reset Your Password &rarr;
          </a>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 24px;">
          This link will expire in 1 hour. If you did not make this request, you can safely ignore this email.
        </p>

        <div style="padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
          <p style="font-size: 11px; color: #475569; word-break: break-all; margin: 0;">
            If the button doesn&apos;t work, copy and paste this link into your browser:<br>
            <a href="{reset_link}" style="color: #38bdf8;">{reset_link}</a>
          </p>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""

    text_body = f"""ActionPulse - Password Reset

We received a request to reset your password for {email}.

To reset your password, click the link below:
{reset_link}

This link will expire in 1 hour. If you did not make this request, you can safely ignore this email."""

    try:
        send_email(
            to=email,
            subject="ActionPulse - Password Reset Link",
            html=html_body,
            text=text_body,
        )
    except Exception as mail_exc:
        logger.error(f"Failed to dispatch password reset email to {email}: {mail_exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send password reset email: {mail_exc}",
        ) from mail_exc

    return ForgotPasswordResponse(
        success=True,
        message=f"Password reset link sent to {email}",
    )
