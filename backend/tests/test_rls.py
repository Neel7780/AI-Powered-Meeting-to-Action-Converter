import os
import pytest
import uuid
from supabase import create_client
from app.core.supabase import get_supabase_client

pytestmark = pytest.mark.skipif(
    not os.getenv("SUPABASE_ANON_KEY"),
    reason="SUPABASE_ANON_KEY is required for RLS tests"
)

@pytest.fixture
def service_db():
    return get_supabase_client()

@pytest.fixture
def anon_db():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_ANON_KEY"]
    return create_client(url, key)

def test_rls_cross_workspace_isolation(service_db, anon_db):
    user_a_email = f"a_{uuid.uuid4()}@example.com"
    user_b_email = f"b_{uuid.uuid4()}@example.com"
    password = "password123"

    user_a = None
    user_b = None

    try:
        # 1. Create two users
        user_a = service_db.auth.admin.create_user({"email": user_a_email, "password": password, "email_confirm": True})
        user_b = service_db.auth.admin.create_user({"email": user_b_email, "password": password, "email_confirm": True})

        uid_a = user_a.user.id
        uid_b = user_b.user.id

        # 2. Each user gets a workspace (rpc create_workspace sets them as admin)
        # Sign in as A
        anon_db.auth.sign_in_with_password({"email": user_a_email, "password": password})
        ws_a = anon_db.rpc("create_workspace", {"p_name": "Workspace A"}).execute().data
        
        # Sign in as B
        anon_db.auth.sign_out()
        anon_db.auth.sign_in_with_password({"email": user_b_email, "password": password})
        ws_b = anon_db.rpc("create_workspace", {"p_name": "Workspace B"}).execute().data

        # 3. Create data for B via backend service-role
        meeting_b = service_db.table("meetings").insert({
            "workspace_id": ws_b,
            "title": "Meeting B",
            "organiser_id": uid_b
        }).execute().data[0]["id"]
        
        item_b = service_db.table("extracted_items").insert({
            "meeting_id": meeting_b,
            "type": "action",
            "source_excerpt": "test",
            "task": "task",
            "confidence": 1.0,
            "review_status": "approved"
        }).execute().data[0]["id"]
        
        service_db.table("tasks").insert({
            "workspace_id": ws_b,
            "meeting_id": meeting_b,
            "extracted_item_id": item_b,
            "title": "Task B",
            "created_by": uid_b,
            "source_excerpt": "test"
        }).execute()

        # 4. Sign in as user A
        anon_db.auth.sign_out()
        anon_db.auth.sign_in_with_password({"email": user_a_email, "password": password})

        # 5. User A must see 0 rows of B's data
        meetings = anon_db.table("meetings").select("*").eq("workspace_id", ws_b).execute()
        assert len(meetings.data) == 0
        
        tasks = anon_db.table("tasks").select("*").eq("workspace_id", ws_b).execute()
        assert len(tasks.data) == 0
        
        items = anon_db.table("extracted_items").select("*").eq("meeting_id", meeting_b).execute()
        assert len(items.data) == 0
        
        members = anon_db.table("workspace_members").select("*").eq("workspace_id", ws_b).execute()
        assert len(members.data) == 0

    finally:
        # Cleanup deletes users and everything cascades
        if user_a:
            service_db.auth.admin.delete_user(user_a.user.id)
        if user_b:
            service_db.auth.admin.delete_user(user_b.user.id)


def test_chat_tables_service_role_and_authenticated_permissions(service_db, anon_db):
    """Verify deployed service_role and authenticated roles have table privileges on chat tables."""
    user_email = f"chat_{uuid.uuid4()}@example.com"
    password = "password123"
    user = None

    try:
        user = service_db.auth.admin.create_user({"email": user_email, "password": password, "email_confirm": True})
        uid = user.user.id

        anon_db.auth.sign_in_with_password({"email": user_email, "password": password})
        ws_id = anon_db.rpc("create_workspace", {"p_name": "Chat Test WS"}).execute().data

        # 1. service_role can insert into chat_sessions
        session_res = service_db.table("chat_sessions").insert({
            "workspace_id": ws_id,
            "user_id": uid,
            "title": "Backend Deployed Role Test"
        }).execute()
        assert len(session_res.data) == 1
        s_id = session_res.data[0]["id"]

        # 2. service_role can insert into chat_messages
        msg_res = service_db.table("chat_messages").insert({
            "session_id": s_id,
            "role": "user",
            "content": "Testing service_role table grant"
        }).execute()
        assert len(msg_res.data) == 1

        # 3. service_role can select from both
        s_fetch = service_db.table("chat_sessions").select("*").eq("id", s_id).execute()
        assert len(s_fetch.data) == 1
        m_fetch = service_db.table("chat_messages").select("*").eq("session_id", s_id).execute()
        assert len(m_fetch.data) == 1

        # 4. authenticated role can also select own session
        anon_fetch = anon_db.table("chat_sessions").select("*").eq("id", s_id).execute()
        assert len(anon_fetch.data) == 1

        # 5. Clean up via service_db
        service_db.table("chat_sessions").delete().eq("id", s_id).execute()
    finally:
        if user:
            service_db.auth.admin.delete_user(user.user.id)
