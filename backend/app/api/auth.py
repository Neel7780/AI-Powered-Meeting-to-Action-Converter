"""Authentication helper endpoints for ActionPulse.

Endpoints:
- POST /api/auth/forgot-password: Generate and dispatch password recovery verification code + fallback link.
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
    code_length: int = 6


@router.post(
    "/forgot-password",
    response_model=ForgotPasswordResponse,
    status_code=status.HTTP_200_OK,
)
async def request_password_reset(payload: ForgotPasswordRequest):
    """Generate a Supabase recovery OTP code and dispatch it via ActionPulse email.

    Dispatches a branded email with:
    1. Prominently displayed OTP code for in-app verification.
    2. Direct 1-click fallback reset link.
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
        # Return generic message to avoid user enumeration while still failing gracefully
        return ForgotPasswordResponse(
            success=True,
            message=f"If an account with {email} exists, a verification code has been sent.",
            code_length=6,
        )

    otp = getattr(link_res.properties, "email_otp", "")
    action_link = getattr(link_res.properties, "action_link", redirect_url)

    if not otp:
        logger.error(f"Supabase did not return an email_otp in generate_link response for {email}.")
        return ForgotPasswordResponse(
            success=True,
            message=f"If an account with {email} exists, a verification code has been sent.",
            code_length=6,
        )

    # Send ActionPulse Branded Verification Email via Brevo / SMTP
    card_style = (
        "max-width: 520px; margin: 0 auto; background: #111827; border-radius: 16px; "
        "border: 1px solid rgba(255, 255, 255, 0.1); overflow: hidden; "
        "box-shadow: 0 10px 25px rgba(0,0,0,0.5);"
    )
    header_style = "padding: 28px 32px 20px; text-align: center; background: linear-gradient(135deg, #0284c7, #0369a1);"
    otp_box_style = (
        "background: rgba(15, 23, 42, 0.7); border: 2px dashed #0284c7; "
        "border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0;"
    )
    btn_style = (
        "display: inline-block; background: #0284c7; color: #ffffff; text-decoration: none; "
        "padding: 10px 22px; border-radius: 8px; font-size: 13px; font-weight: 600;"
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
          We received a request to reset your password. Use the verification code below on the recovery screen:
        </p>

        <div style="{otp_box_style}">
          <span style="font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; color: #38bdf8;">
            Verification Code
          </span>
          <span style="font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #fff;">
            {otp}
          </span>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 28px;">
          This code expires in 1 hour. If you did not make this request, you can safely ignore this email.
        </p>

        <div style="padding-top: 20px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 12px;">Prefer to reset with a 1-click link?</p>
          <a href="{action_link}" style="{btn_style}">Reset Password Directly &rarr;</a>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>"""

    text_body = f"""ActionPulse - Password Reset

We received a request to reset your password.
Your verification code is: {otp}

Enter this code on the password reset screen to verify your email and set a new password.

Alternatively, you can reset your password directly using this link:
{action_link}

This code will expire in 1 hour. If you did not request this reset, you can safely ignore this message."""

    try:
        send_email(
            to=email,
            subject="ActionPulse - Your Password Reset Verification Code",
            html=html_body,
            text=text_body,
        )
    except Exception as mail_exc:
        logger.error(f"Failed to dispatch password reset email to {email}: {mail_exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send email verification code: {mail_exc}",
        ) from mail_exc

    return ForgotPasswordResponse(
        success=True,
        message=f"Verification code sent to {email}",
        code_length=len(otp),
    )
