from supabase import create_client, Client
from app.core.config import settings

db: Client = None

if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        db = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    except Exception:
        db = None


def get_supabase_client() -> Client:
    """Get the shared service-role Supabase client.
    
    Never call db.auth.sign_in_* on this client to avoid mutating the shared session.
    """
    global db
    if db is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured in environment.")
        db = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    return db
