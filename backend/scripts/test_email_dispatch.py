#!/usr/bin/env python3
"""Interactive test script for Level 3: Real SMTP Email Delivery."""

import sys
import os

# Safe UTF-8 encoding configuration for Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Ensure backend root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.services.email import send_email, send_invite_email


def main():
    print("=" * 60)
    print("[*] ACTIONPULSE - LIVE EMAIL DISPATCH TEST (LEVEL 3)")
    print("=" * 60)

    # 1. Check Configuration
    print(f"  SMTP Host : {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    print(f"  SMTP User : {settings.SMTP_USER or '(NOT SET IN .env)'}")
    print(f"  Mail From : {settings.MAIL_FROM}")
    print(f"  Password  : {'*' * len(settings.SMTP_PASS) if settings.SMTP_PASS else '(NOT SET IN .env)'}")
    print("-" * 60)

    if not settings.SMTP_USER or not settings.SMTP_PASS:
        print("\n[!] Setup Needed: SMTP_USER and SMTP_PASS are empty in backend/.env")
        print("\nTo send real emails, open backend/.env and configure:")
        print("  SMTP_USER=your_email@gmail.com")
        print("  SMTP_PASS=your_16_char_google_app_password")
        print("  MAIL_FROM=ActionPulse <your_email@gmail.com>")
        print("\nHow to get a Google App Password (free, takes 1 min):")
        print("  1. Visit: https://myaccount.google.com/security")
        print("  2. Turn ON '2-Step Verification'.")
        print("  3. Search 'App passwords' in your Google Account.")
        print("  4. Name it 'ActionPulse' and generate.")
        print("  5. Paste the 16-character code into SMTP_PASS in backend/.env.\n")
        return

    # 2. Get Recipient Email
    if len(sys.argv) > 1:
        recipient = sys.argv[1].strip()
    else:
        recipient = input("\nEnter recipient email address: ").strip()

    if not recipient or "@" not in recipient:
        print("[ERROR] Invalid recipient email address.")
        return

    print(f"\n[*] Sending test emails to: {recipient} ...")

    # 3. Test Direct HTML Email
    try:
        print("  [1/2] Sending task assignment notification...")
        send_email(
            to=recipient,
            subject="[ActionPulse Live Test] Email Delivery Confirmed",
            html="""
            <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 24px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                <h2 style="color: #4f46e5; margin-top: 0;">ActionPulse Live Test Confirmed!</h2>
                <p style="color: #334155; font-size: 15px;">Hello,</p>
                <p style="color: #334155; font-size: 15px;">This email verifies that your <strong>BE-2 Email &amp; Notification Service</strong> is connected to your SMTP provider and delivering correctly.</p>
                <div style="margin-top: 16px; padding: 12px; background: #e0e7ff; border-radius: 6px; color: #3730a3; font-size: 13px;">
                    <strong>Tech Stack:</strong> Python smtplib with TLS on Port 587 (Zero-Budget Free Tier).
                </div>
            </div>
            """,
            text="ActionPulse Live Test Confirmed!\n\nThis email verifies that your BE-2 Email & Notification Service is connected to your SMTP provider and delivering correctly."
        )
        print("  [SUCCESS] Basic email sent successfully!")
    except Exception as e:
        print(f"  [FAILED] Could not send basic email: {e}")
        return

    # 4. Test Workspace Invite Email Template
    try:
        print("  [2/2] Sending workspace invitation card...")
        send_invite_email(
            to=recipient,
            workspace_name="Engineering Core",
            inviter_name="Neel (Team Lead)",
            link=f"{settings.APP_URL}/invite?token=live_test_token_123"
        )
        print("  [SUCCESS] Workspace invite email sent successfully!")
    except Exception as e:
        print(f"  [FAILED] Could not send invite email: {e}")
        return

    print("\n" + "=" * 60)
    print("[DONE] Test complete! Check your email inbox (and Spam folder).")
    print("=" * 60)


if __name__ == "__main__":
    main()
