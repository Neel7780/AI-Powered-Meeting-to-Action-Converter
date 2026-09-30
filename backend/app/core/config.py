import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "ActionPulse Backend"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Gemini 3.1 Flash-Lite
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # SMTP Configuration (Free tier: Gmail App Password or Brevo)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", os.getenv("SMTP_PASSWORD", ""))
    MAIL_FROM: str = os.getenv("MAIL_FROM", os.getenv("EMAIL_FROM", "ActionPulse <noreply@actionpulse.app>"))
    # Backwards compatibility aliases
    SMTP_PASSWORD: str = SMTP_PASS
    EMAIL_FROM: str = MAIL_FROM

    # Application Frontend URL (for email links and redirects)
    APP_URL: str = os.getenv("APP_URL", "http://localhost:5173")

    # Internal tick keep-alive secret
    INTERNAL_TICK_SECRET: str = os.getenv("INTERNAL_TICK_SECRET", "")

    # CORS
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://localhost:3000"
        ).split(",")
        if origin.strip()
    ]

settings = Settings()
