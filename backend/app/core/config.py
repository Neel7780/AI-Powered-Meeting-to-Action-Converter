import os

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
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite")
    LLM_PROVIDER_ALLOWLIST: list[str] = [
        p.strip() for p in os.getenv("LLM_PROVIDER_ALLOWLIST", "gemini").split(",") if p.strip()
    ]
    AI_NOTICE_VERSION: str = os.getenv("AI_NOTICE_VERSION", "2026-09-v1")
    STORAGE_BUCKET_TRANSCRIPTS: str = "meeting-transcripts"

    # Google Calendar Integration (OAuth 2.0)
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "")
    CALENDAR_ENCRYPTION_SECRET: str = os.getenv("CALENDAR_ENCRYPTION_SECRET", "")

    # SMTP Configuration (Free tier: Gmail App Password or Brevo)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", os.getenv("SMTP_PASSWORD", ""))
    MAIL_FROM: str = os.getenv("MAIL_FROM", os.getenv("EMAIL_FROM", "ActionPulse <noreply@actionpulse.app>"))
    # Brevo HTTPS API key (xkeysib-...). When set it is used instead of SMTP,
    # which Render's free tier blocks.
    BREVO_API_KEY: str = os.getenv("BREVO_API_KEY", "")
    # Backwards compatibility aliases
    SMTP_PASSWORD: str = SMTP_PASS
    EMAIL_FROM: str = MAIL_FROM

    # Application Frontend URL (for email links and redirects)
    # Supports FRONTEND_URL (e.g. Vercel deployment), falling back to APP_URL or localhost
    APP_URL: str = os.getenv("FRONTEND_URL", os.getenv("APP_URL", "http://localhost:5173"))

    # Internal tick keep-alive secret
    INTERNAL_TICK_SECRET: str = os.getenv("INTERNAL_TICK_SECRET", "")

    # CORS: CORS_ORIGINS (comma-separated) replaces the local dev defaults; the deployed
    # frontend is always allowed so an env override can't lock it out. Origins never end
    # in "/", so a trailing slash in an env value would silently never match.
    CORS_ORIGINS: list[str] = [
        origin.strip().rstrip("/")
        for origin in [
            *os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","),
            "https://ai-powered-meeting-to-action-conver.vercel.app",
            os.getenv("FRONTEND_URL", ""),
        ]
        if origin.strip()
    ]

settings = Settings()
