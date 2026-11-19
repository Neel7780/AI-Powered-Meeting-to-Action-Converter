"""HTTP review contract; transaction semantics are exercised separately on SQL."""
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.deps import CurrentUser, get_current_user
from main import app


@pytest.fixture
def review_client():
    user = CurrentUser(id=uuid4(), email="admin@example.com")
    app.dependency_overrides[get_current_user] = lambda: user
    db = MagicMock()
    meeting = {"id": str(uuid4()), "workspace_id": str(uuid4()), "timezone": "Asia/Kolkata"}
    with patch("app.api.review.require_meeting_role", return_value=meeting), \
         patch("app.api.review.get_supabase_client", return_value=db), \
         patch("app.api.review.notify_tasks_assigned") as notify:
        yield TestClient(app), db, meeting, user, notify
    app.dependency_overrides.pop(get_current_user, None)


def test_approve_uses_one_transaction_and_notifies_after_commit(review_client):
    client, db, meeting, user, notify = review_client
    tid, iid, owner = (str(uuid4()) for _ in range(3))
    db.rpc.return_value.execute.return_value.data = {"approved": 1, "task_ids": [tid]}
    response = client.post(f"/api/meetings/{meeting['id']}/approve", json={"items": [
        {"id": iid, "owner_user_id": owner, "task": "Ship fix", "deadline_date": "2026-10-21"}]})
    assert response.status_code == 200, response.text
    assert response.json() == {"approved": 1, "task_ids": [tid]}
    name, params = db.rpc.call_args.args
    assert name == "review_meeting_items" and params["p_actor_id"] == str(user.id)
    assert params["p_items"][0]["deadline_utc"] == "2026-10-21T18:29:59+00:00"
    db.table.assert_not_called()
    notify.assert_called_once()


@pytest.mark.parametrize("code, expected", [("40001",409), ("23505",409), ("42501",403), ("22023",422), ("P0002",404), ("XX000",500)])
def test_failed_transaction_has_no_notification_or_write_fallback(review_client, code, expected):
    client, db, meeting, _, notify = review_client
    error = RuntimeError("transaction rejected")
    error.code = code
    db.rpc.return_value.execute.side_effect = error
    result = client.post(f"/api/meetings/{meeting['id']}/approve", json={"items":[{"id":str(uuid4())}]})
    assert result.status_code == expected
    db.table.assert_not_called()
    notify.assert_not_called()


def test_reject_is_atomic(review_client):
    client, db, meeting, _, notify = review_client
    db.rpc.return_value.execute.return_value.data = {"rejected": 2, "task_ids": []}
    response = client.post(f"/api/meetings/{meeting['id']}/reject", json={"item_ids":[str(uuid4()),str(uuid4())], "reason":"Not agreed"})
    assert response.status_code == 200 and response.json() == {"rejected":2}
    assert db.rpc.call_args.args[1]["p_decision"] == "rejected"
    db.table.assert_not_called()
    notify.assert_not_called()


def test_duplicate_items_and_automatic_execution_rejected(review_client):
    client, db, meeting, _, _ = review_client
    iid = str(uuid4())
    for items in ([{"id":iid},{"id":iid}], [{"id":iid,"execution_type":"agent"}]):
        response = client.post(f"/api/meetings/{meeting['id']}/approve",json={"items":items})
        assert response.status_code == 422
    db.rpc.assert_not_called()
