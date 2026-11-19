"""Shared AI consent guard for every model entry point."""


def meeting_ai_allowed(db, meeting: dict) -> bool:
    if not meeting.get("ai_processing", False):
        return False
    return bool(db.table("consents").select("id").eq("meeting_id", str(meeting["id"]))
                .eq("status", "attested").execute().data)
