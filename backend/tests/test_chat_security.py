"""Comprehensive security test suite for ActionPulse Workspace Chat.

Covers:
1. Original 10 core security guarantees (DM privacy, private channels, attachments,
   unauthenticated denial, non-member DM rejection, concurrent DM deduplication,
   sender forgery, workspace mismatch, cross-conversation attachments).
2. Hardened RLS & privilege-escalation regression tests:
   - Membership takeover via conversation_members UPDATE (blocked)
   - Immutable channel privacy (private -> public blocked)
   - Explicit membership-based privacy (admins & owners cannot access/moderate private
     channels, private DMs, or private storage attachments unless they are members)
   - Atomic private channel creation via create_channel RPC
   - Cross-workspace channel & message moves blocked; message metadata tampering blocked
   - Consistent authorization across channel management, message soft-delete, and
     attachment / storage deletion (including post-removal revocation)
   - Workspace-member removal trigger cleans up removed user's memberships without
     losing the remaining DM participant's history or touching other workspaces
   - Attachment storage_path prefix, file_url scheme, and SVG XSS rejection
   - #general spoofing / rename / deletion protection
   - Realtime postgres_changes subscription authorization AND private Broadcast/Presence
     topic authorization (SELECT + INSERT, malformed topics, wrong extensions)
3. Static SQL verification tests against the actual migration file.
"""

from pathlib import Path
import re
import sqlite3
import threading
import uuid
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "supabase" / "migrations"
CHAT_MIGRATION_PATH = MIGRATIONS_DIR / "20261121000000_slack_chat_system.sql"

UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL
);

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('channel', 'dm')),
  name TEXT,
  topic TEXT,
  description TEXT,
  is_private INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (
    (type = 'dm' AND is_private = 1 AND name IS NOT NULL AND length(trim(name)) > 0)
    OR
    (type = 'channel' AND name IS NOT NULL AND length(trim(name)) BETWEEN 1 AND 80)
  ),
  UNIQUE(id, workspace_id)
);

CREATE UNIQUE INDEX conversations_workspace_dm_unique_idx
  ON conversations(workspace_id, name)
  WHERE type = 'dm';

CREATE UNIQUE INDEX conversations_workspace_channel_name_uq
  ON conversations(workspace_id, lower(trim(name)))
  WHERE type = 'channel';

CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TRIGGER on_workspace_member_removed_cleanup_chat
AFTER DELETE ON workspace_members
FOR EACH ROW
BEGIN
  DELETE FROM conversation_members
  WHERE user_id = OLD.user_id
    AND conversation_id IN (
      SELECT id FROM conversations WHERE workspace_id = OLD.workspace_id
    );
END;

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_sticker INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(content)) > 0 OR is_sticker = 1),
  CHECK (parent_id IS NULL OR parent_id <> id),
  FOREIGN KEY (conversation_id, workspace_id)
    REFERENCES conversations(id, workspace_id)
    ON DELETE CASCADE,
  UNIQUE(id, conversation_id, workspace_id)
);

CREATE TRIGGER messages_validate_thread_parent
BEFORE INSERT ON messages
FOR EACH ROW
WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.parent_id = NEW.id THEN
      RAISE(ABORT, 'Invalid reply: message cannot reply to itself')
    WHEN NOT EXISTS (
      SELECT 1 FROM messages p
      WHERE p.id = NEW.parent_id AND p.conversation_id = NEW.conversation_id
    )
    THEN RAISE(ABORT, 'Invalid reply: parent message belongs to a different conversation')
  END;
END;

CREATE TABLE message_attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  file_name TEXT NOT NULL CHECK (length(trim(file_name)) BETWEEN 1 AND 255),
  file_url TEXT NOT NULL DEFAULT '' CHECK (file_url = '' OR file_url LIKE 'https://%'),
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0 CHECK (file_size BETWEEN 0 AND 10485760),
  storage_path TEXT NOT NULL CHECK (
    storage_path LIKE (workspace_id || '/' || conversation_id || '/%')
    AND instr(storage_path, '..') = 0
    AND length(storage_path) > length(workspace_id) + length(conversation_id) + 2
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id, conversation_id, workspace_id)
    REFERENCES messages(id, conversation_id, workspace_id)
    ON DELETE CASCADE
);

CREATE TABLE message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (length(trim(emoji)) BETWEEN 1 AND 32),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id, conversation_id, workspace_id)
    REFERENCES messages(id, conversation_id, workspace_id)
    ON DELETE CASCADE,
  UNIQUE (message_id, user_id, emoji)
);

CREATE TABLE storage_objects (
  name TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  owner_id TEXT NOT NULL
);
"""


class SecurityGatekeeper:
    """Models the hardened Postgres RLS policies, column grants, triggers, and SECURITY DEFINER RPCs."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self._lock = threading.Lock()

    def user_has_workspace_role(self, user_id: str | None, workspace_id: str) -> bool:
        if not user_id:
            return False
        cur = self.conn.cursor()
        cur.execute(
            "SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ?",
            (workspace_id, user_id),
        )
        return cur.fetchone() is not None

    def user_is_workspace_admin(self, user_id: str | None, workspace_id: str) -> bool:
        if not user_id:
            return False
        cur = self.conn.cursor()
        cur.execute(
            "SELECT 1 FROM workspace_members WHERE workspace_id = ? AND user_id = ? AND role IN ('owner', 'admin')",
            (workspace_id, user_id),
        )
        return cur.fetchone() is not None

    def user_can_access_conversation(self, user_id: str | None, conversation_id: str) -> bool:
        if not user_id:
            return False
        cur = self.conn.cursor()
        cur.execute(
            "SELECT workspace_id, type, is_private FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        conv = cur.fetchone()
        if not conv:
            return False
        ws_id, conv_type, is_private = conv

        if not self.user_has_workspace_role(user_id, ws_id):
            return False

        if conv_type == "channel" and not is_private:
            return True

        # Private channel or DM requires explicit conversation membership (even for admins/owners)
        cur.execute(
            "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
            (conversation_id, user_id),
        )
        return cur.fetchone() is not None

    def user_can_access_realtime_topic(
        self, user_id: str | None, topic: str | None, extension: str | None
    ) -> bool:
        """Models private.user_can_access_realtime_topic(topic, extension) for SELECT and INSERT."""
        if not user_id or not topic or not extension:
            return False

        if extension == "presence" and topic.startswith("presence:"):
            ws_id = topic[len("presence:") :]
            if not UUID_RE.match(ws_id):
                return False
            return self.user_has_workspace_role(user_id, ws_id)

        if extension == "broadcast" and topic.startswith("typing:"):
            conv_id = topic[len("typing:") :]
            if not UUID_RE.match(conv_id):
                return False
            return self.user_can_access_conversation(user_id, conv_id)

        return False

    def user_can_receive_postgres_change(
        self, user_id: str | None, table: str, conversation_id: str
    ) -> bool:
        """Models Supabase Realtime postgres_changes SELECT RLS authorization."""
        if table not in {"conversations", "messages", "message_attachments", "message_reactions"}:
            return False
        return self.user_can_access_conversation(user_id, conversation_id)

    def _parse_storage_path(self, storage_path: str) -> tuple[str, str] | None:
        if not storage_path or ".." in storage_path:
            return None
        parts = storage_path.strip("/").split("/")
        # Strictly 2 folders deep: {workspace_id}/{conversation_id}/{filename}
        if len(parts) != 3 or not parts[2]:
            return None
        return parts[0], parts[1]

    def user_can_access_storage_attachment(self, user_id: str | None, storage_path: str) -> bool:
        if not user_id:
            return False
        parsed = self._parse_storage_path(storage_path)
        if not parsed:
            return False
        ws_id, conv_id = parsed

        cur = self.conn.cursor()
        cur.execute("SELECT workspace_id FROM conversations WHERE id = ?", (conv_id,))
        row = cur.fetchone()
        if not row or row[0] != ws_id:
            return False

        # Block storage reads for attachments linked to soft-deleted messages
        cur.execute(
            """
            SELECT 1
            FROM message_attachments ma
            JOIN messages m ON m.id = ma.message_id
            WHERE ma.storage_path = ?
              AND m.deleted_at IS NOT NULL
            """,
            (storage_path,),
        )
        if cur.fetchone() is not None:
            return False

        return self.user_can_access_conversation(user_id, conv_id)

    def list_message_attachments(self, user_id: str | None, message_id: str) -> list[str]:
        """Models message_attachments_select RLS (requires conversation access AND m.deleted_at is null)."""
        if not user_id:
            return []
        cur = self.conn.cursor()
        cur.execute(
            """
            SELECT ma.id, ma.conversation_id
            FROM message_attachments ma
            JOIN messages m ON m.id = ma.message_id
            WHERE ma.message_id = ?
              AND m.deleted_at IS NULL
            """,
            (message_id,),
        )
        rows = cur.fetchall()
        return [
            att_id
            for att_id, conv_id in rows
            if self.user_can_access_conversation(user_id, conv_id)
        ]

    def upload_storage_attachment(
        self, caller_id: str | None, storage_path: str, mime_type: str
    ) -> None:
        if mime_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Disallowed MIME type: {mime_type}")
        if not self.user_can_access_storage_attachment(caller_id, storage_path):
            raise PermissionError("Storage RLS Violation: Unauthorized upload")
        self.conn.execute(
            "INSERT INTO storage_objects (name, bucket_id, owner_id) VALUES (?, 'chat-attachments', ?)",
            (storage_path, caller_id),
        )
        self.conn.commit()

    def delete_storage_attachment(self, caller_id: str | None, storage_path: str) -> None:
        if not caller_id:
            raise PermissionError("Authentication required")
        parsed = self._parse_storage_path(storage_path)
        if not parsed:
            raise PermissionError("Invalid storage path")
        ws_id, conv_id = parsed

        cur = self.conn.cursor()
        cur.execute(
            "SELECT owner_id FROM storage_objects WHERE bucket_id = 'chat-attachments' AND name = ?",
            (storage_path,),
        )
        obj = cur.fetchone()
        if not obj:
            raise ValueError("Object not found")
        owner_id = obj[0]

        if not self.user_can_access_storage_attachment(caller_id, storage_path):
            raise PermissionError("Storage RLS Violation: Conversation access required to delete")

        if owner_id != caller_id and not self.user_is_workspace_admin(caller_id, ws_id):
            raise PermissionError("Storage RLS Violation: Only uploader or admin member may delete")

        self.conn.execute(
            "DELETE FROM storage_objects WHERE bucket_id = 'chat-attachments' AND name = ?",
            (storage_path,),
        )
        self.conn.commit()

    def create_channel(
        self,
        caller_id: str | None,
        workspace_id: str,
        name: str,
        topic: str | None = None,
        description: str | None = None,
        is_private: bool = False,
    ) -> str:
        """Models public.create_channel SECURITY DEFINER RPC."""
        if not caller_id:
            raise PermissionError("Authentication required")
        if not self.user_has_workspace_role(caller_id, workspace_id):
            raise PermissionError("Unauthorized for workspace")
        clean_name = re.sub(r"[^a-z0-9_-]", "", re.sub(r"\s+", "-", (name or "").strip().lower()))
        if not (1 <= len(clean_name) <= 80):
            raise ValueError("Channel name must be between 1 and 80 valid characters")

        conv_id = str(uuid.uuid4())
        self.conn.execute(
            """
            INSERT INTO conversations (id, workspace_id, type, name, topic, description, is_private, created_by)
            VALUES (?, ?, 'channel', ?, ?, ?, ?, ?)
            """,
            (conv_id, workspace_id, clean_name, topic, description, int(is_private), caller_id),
        )
        self.conn.execute(
            "INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
            (conv_id, caller_id),
        )
        self.conn.commit()
        return conv_id

    def update_conversation(self, caller_id: str | None, conversation_id: str, **updates) -> None:
        """Models conversations column grants + conversations_update RLS + enforce_conversation_invariants."""
        if not caller_id:
            raise PermissionError("Authentication required")
        allowed_cols = {"name", "topic", "description"}
        forbidden = set(updates.keys()) - allowed_cols
        if forbidden:
            raise PermissionError(f"Column-level grant / invariant violation on: {sorted(forbidden)}")

        if not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("RLS Violation: Cannot access conversation")

        cur = self.conn.cursor()
        cur.execute(
            "SELECT workspace_id, type, name, created_by FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        conv = cur.fetchone()
        if not conv:
            raise PermissionError("Conversation not found")
        ws_id, conv_type, old_name, created_by = conv

        if conv_type != "channel":
            raise PermissionError("RLS Violation: Cannot update DM conversations")
        if created_by != caller_id and not self.user_is_workspace_admin(caller_id, ws_id):
            raise PermissionError("RLS Violation: Only channel creator or workspace admin member may update")

        if "name" in updates:
            new_name = updates["name"].strip().lower()
            if old_name.strip().lower() == "general" and new_name != "general":
                raise PermissionError("The default #general channel cannot be renamed")
            updates["name"] = new_name

        assignments = ", ".join(f"{col} = ?" for col in updates)
        self.conn.execute(
            f"UPDATE conversations SET {assignments} WHERE id = ?",
            [*updates.values(), conversation_id],
        )
        self.conn.commit()

    def delete_conversation(self, caller_id: str | None, conversation_id: str) -> None:
        if not caller_id or not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("RLS Violation: Cannot access conversation")
        cur = self.conn.cursor()
        cur.execute(
            "SELECT workspace_id, type, name, created_by FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        ws_id, conv_type, name, created_by = cur.fetchone()
        if conv_type != "channel":
            raise PermissionError("RLS Violation: Cannot delete DM")
        if (name or "").strip().lower() == "general":
            raise PermissionError("RLS Violation: Cannot delete #general")
        if created_by != caller_id and not self.user_is_workspace_admin(caller_id, ws_id):
            raise PermissionError("RLS Violation: Unauthorized channel deletion")
        self.conn.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
        self.conn.commit()

    def update_conversation_member(self, caller_id: str | None, *_args, **_kwargs) -> None:
        """Models dropped conversation_members_update policy and revoked UPDATE grant."""
        raise PermissionError("Permission denied: UPDATE on conversation_members is revoked")

    def invite_channel_member(
        self, caller_id: str | None, conversation_id: str, target_user_id: str
    ) -> None:
        if not caller_id or not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("RLS Violation: Caller cannot access channel")
        cur = self.conn.cursor()
        cur.execute(
            "SELECT workspace_id, type, is_private, created_by FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        ws_id, conv_type, is_private, created_by = cur.fetchone()
        if conv_type != "channel":
            raise PermissionError("RLS Violation: Cannot insert into DM members directly")
        if not self.user_has_workspace_role(target_user_id, ws_id):
            raise PermissionError("RLS Violation: Target user is not a workspace member")

        can_self_join = (not is_private) and (target_user_id == caller_id)
        can_manage = (created_by == caller_id) or self.user_is_workspace_admin(caller_id, ws_id)
        if not (can_self_join or can_manage):
            raise PermissionError("RLS Violation: Unauthorized channel member addition")

        self.conn.execute(
            "INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
            (conversation_id, target_user_id),
        )
        self.conn.commit()

    def get_or_create_dm_conversation(
        self, caller_id: str | None, workspace_id: str, target_user_id: str
    ) -> str:
        if not caller_id:
            raise PermissionError("Authentication required")
        if caller_id == target_user_id:
            raise ValueError("Cannot create a DM with yourself")

        if caller_id < target_user_id:
            dm_key = f"dm:{caller_id}:{target_user_id}"
        else:
            dm_key = f"dm:{target_user_id}:{caller_id}"

        with self._lock:
            if not self.user_has_workspace_role(caller_id, workspace_id):
                raise PermissionError("Unauthorized for workspace")
            if not self.user_has_workspace_role(target_user_id, workspace_id):
                raise ValueError("Target user is not a member of this workspace")

            cur = self.conn.cursor()
            cur.execute(
                """
                INSERT INTO conversations (id, workspace_id, type, name, is_private, created_by)
                VALUES (?, ?, 'dm', ?, 1, ?)
                ON CONFLICT(workspace_id, name) WHERE type = 'dm'
                DO UPDATE SET updated_at = CURRENT_TIMESTAMP
                RETURNING id
                """,
                (str(uuid.uuid4()), workspace_id, dm_key, caller_id),
            )
            conv_id = cur.fetchone()[0]

            cur.execute(
                "INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
                (conv_id, caller_id),
            )
            cur.execute(
                "INSERT OR IGNORE INTO conversation_members (conversation_id, user_id) VALUES (?, ?)",
                (conv_id, target_user_id),
            )
            self.conn.commit()
            return conv_id

    def mark_conversation_read(self, caller_id: str | None, conversation_id: str) -> None:
        if not caller_id:
            raise PermissionError("Authentication required")
        cur = self.conn.cursor()
        cur.execute(
            "SELECT workspace_id, type, is_private FROM conversations WHERE id = ?",
            (conversation_id,),
        )
        conv = cur.fetchone()
        if not conv or not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("Conversation not found or access denied")

        _, conv_type, is_private = conv
        if is_private or conv_type == "dm":
            cur.execute(
                "UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?",
                (conversation_id, caller_id),
            )
        else:
            cur.execute(
                """
                INSERT INTO conversation_members (conversation_id, user_id, last_read_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(conversation_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
                """,
                (conversation_id, caller_id),
            )
        self.conn.commit()

    def send_message(
        self,
        caller_id: str | None,
        workspace_id: str,
        conversation_id: str,
        content: str,
        parent_id: str | None = None,
        sender_id: str | None = None,
        is_sticker: bool = False,
    ) -> str:
        effective_sender = sender_id if sender_id is not None else caller_id
        if not caller_id or effective_sender != caller_id:
            raise PermissionError("RLS Violation: Cannot forge sender_id")
        if not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("RLS Violation: Caller cannot access conversation")

        cur = self.conn.cursor()
        msg_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO messages (id, conversation_id, workspace_id, sender_id, parent_id, content, is_sticker)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (msg_id, conversation_id, workspace_id, effective_sender, parent_id, content, int(is_sticker)),
        )
        self.conn.commit()
        return msg_id

    def edit_message(self, caller_id: str | None, message_id: str, **updates) -> None:
        if not caller_id:
            raise PermissionError("Authentication required")
        forbidden = set(updates.keys()) - {"content"}
        if forbidden:
            raise PermissionError(f"Column-level grant / invariant violation on: {sorted(forbidden)}")
        if "content" not in updates:
            raise ValueError("content is required")

        cur = self.conn.cursor()
        cur.execute(
            "SELECT conversation_id, sender_id, is_sticker, deleted_at FROM messages WHERE id = ?",
            (message_id,),
        )
        row = cur.fetchone()
        if not row:
            raise PermissionError("Message not found")
        conv_id, sender_id, is_sticker, deleted_at = row

        if sender_id != caller_id or not self.user_can_access_conversation(caller_id, conv_id):
            raise PermissionError("RLS Violation: Only active sender may edit message")
        if deleted_at is not None:
            raise PermissionError("Deleted messages cannot be modified")
        if is_sticker:
            raise PermissionError("Sticker messages cannot be edited")

        self.conn.execute(
            "UPDATE messages SET content = ?, edited_at = CURRENT_TIMESTAMP WHERE id = ?",
            (updates["content"], message_id),
        )
        self.conn.commit()

    def soft_delete_message(self, caller_id: str | None, message_id: str) -> None:
        if not caller_id:
            raise PermissionError("Authentication required")
        cur = self.conn.cursor()
        cur.execute(
            "SELECT conversation_id, workspace_id, sender_id, deleted_at FROM messages WHERE id = ?",
            (message_id,),
        )
        row = cur.fetchone()
        if not row or not self.user_can_access_conversation(caller_id, row[0]):
            raise PermissionError("Message not found or access denied")
        _, ws_id, sender_id, deleted_at = row
        if sender_id != caller_id and not self.user_is_workspace_admin(caller_id, ws_id):
            raise PermissionError("Unauthorized to delete this message")
        if deleted_at is not None:
            return
        self.conn.execute(
            "UPDATE messages SET deleted_at = CURRENT_TIMESTAMP, content = 'This message was deleted.' WHERE id = ?",
            (message_id,),
        )
        self.conn.commit()

    def attach_file(
        self,
        caller_id: str | None,
        message_id: str,
        conversation_id: str,
        workspace_id: str,
        file_name: str,
        file_url: str,
        file_type: str,
        file_size: int,
        storage_path: str,
    ) -> str:
        if not caller_id or not self.user_can_access_conversation(caller_id, conversation_id):
            raise PermissionError("RLS Violation: Caller cannot access conversation")
        cur = self.conn.cursor()
        cur.execute(
            "SELECT sender_id, conversation_id, workspace_id, deleted_at FROM messages WHERE id = ?",
            (message_id,),
        )
        msg = cur.fetchone()
        if (
            not msg
            or msg[0] != caller_id
            or msg[1] != conversation_id
            or msg[2] != workspace_id
            or msg[3] is not None
        ):
            raise PermissionError("RLS Violation: Cannot attach to target message")

        att_id = str(uuid.uuid4())
        self.conn.execute(
            """
            INSERT INTO message_attachments
              (id, message_id, conversation_id, workspace_id, file_name, file_url, file_type, file_size, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (att_id, message_id, conversation_id, workspace_id, file_name, file_url, file_type, file_size, storage_path),
        )
        self.conn.commit()
        return att_id


@pytest.fixture
def test_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.executescript(SCHEMA_SQL)
    gate = SecurityGatekeeper(conn)

    ws_id = str(uuid.uuid4())
    ws2_id = str(uuid.uuid4())
    owner_u = str(uuid.uuid4())
    user_a = str(uuid.uuid4())  # admin
    user_b = str(uuid.uuid4())  # member
    user_c = str(uuid.uuid4())  # member
    external_user = str(uuid.uuid4())

    cur = conn.cursor()
    cur.execute("INSERT INTO workspaces (id, name, created_by) VALUES (?, 'Test Workspace', ?)", (ws_id, owner_u))
    cur.execute("INSERT INTO workspaces (id, name, created_by) VALUES (?, 'Second Workspace', ?)", (ws2_id, owner_u))

    for uid, name, email in [
        (owner_u, "Olivia Owner", "olivia@example.com"),
        (user_a, "Alice Admin", "alice@example.com"),
        (user_b, "Bob Member", "bob@example.com"),
        (user_c, "Charlie Member", "charlie@example.com"),
        (external_user, "Dave External", "dave@external.com"),
    ]:
        cur.execute("INSERT INTO profiles (id, display_name, email) VALUES (?, ?, ?)", (uid, name, email))

    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", (ws_id, owner_u))
    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'admin')", (ws_id, user_a))
    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')", (ws_id, user_b))
    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')", (ws_id, user_c))

    # Bob is also in ws2 to verify cross-workspace isolation
    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'owner')", (ws2_id, owner_u))
    cur.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')", (ws2_id, user_b))
    conn.commit()

    return {
        "conn": conn,
        "gate": gate,
        "workspace_id": ws_id,
        "workspace2_id": ws2_id,
        "owner": owner_u,
        "user_a": user_a,
        "user_b": user_b,
        "user_c": user_c,
        "external_user": external_user,
    }


# ============================================================
# 10 CORE SECURITY REQUIREMENTS
# ============================================================


def test_1_user_cannot_read_other_users_private_dm(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    owner, user_a, user_b, user_c = test_db["owner"], test_db["user_a"], test_db["user_b"], test_db["user_c"]

    dm_bc = gate.get_or_create_dm_conversation(user_b, ws_id, user_c)

    assert gate.user_can_access_conversation(user_b, dm_bc) is True
    assert gate.user_can_access_conversation(user_c, dm_bc) is True
    # Neither workspace admin nor workspace owner can access a DM they are not in
    assert gate.user_can_access_conversation(user_a, dm_bc) is False
    assert gate.user_can_access_conversation(owner, dm_bc) is False


def test_2_user_cannot_join_private_channel_without_authorization(test_db):
    gate = test_db["gate"]
    conn = test_db["conn"]
    ws_id = test_db["workspace_id"]
    user_a, user_b = test_db["user_a"], test_db["user_b"]

    priv_chan_id = gate.create_channel(user_a, ws_id, "executive", is_private=True)

    with pytest.raises(PermissionError):
        gate.mark_conversation_read(user_b, priv_chan_id)

    with pytest.raises(PermissionError):
        gate.invite_channel_member(user_b, priv_chan_id, user_b)

    cur = conn.cursor()
    cur.execute(
        "SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?",
        (priv_chan_id, user_b),
    )
    assert cur.fetchone() is None
    assert gate.user_can_access_conversation(user_b, priv_chan_id) is False


def test_3_user_cannot_access_other_users_private_attachment(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    owner, user_a, user_b, user_c = test_db["owner"], test_db["user_a"], test_db["user_b"], test_db["user_c"]

    dm_bc = gate.get_or_create_dm_conversation(user_b, ws_id, user_c)
    storage_path = f"{ws_id}/{dm_bc}/salary_report.pdf"

    assert gate.user_can_access_storage_attachment(user_b, storage_path) is True
    assert gate.user_can_access_storage_attachment(user_c, storage_path) is True
    assert gate.user_can_access_storage_attachment(user_a, storage_path) is False
    assert gate.user_can_access_storage_attachment(owner, storage_path) is False


def test_4_unauthenticated_user_cannot_retrieve_private_attachments(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_b, user_c = test_db["user_b"], test_db["user_c"]

    dm_bc = gate.get_or_create_dm_conversation(user_b, ws_id, user_c)
    storage_path = f"{ws_id}/{dm_bc}/confidential.png"

    assert gate.user_can_access_storage_attachment(None, storage_path) is False


def test_5_workspace_member_cannot_access_another_private_channel_messages(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_a, user_b, user_c = test_db["user_a"], test_db["user_b"], test_db["user_c"]

    priv_chan = gate.create_channel(user_a, ws_id, "founders", is_private=True)
    gate.invite_channel_member(user_a, priv_chan, user_b)

    gate.send_message(user_a, ws_id, priv_chan, "Secret financial figures")

    assert gate.user_can_access_conversation(user_b, priv_chan) is True
    assert gate.user_can_access_conversation(user_c, priv_chan) is False

    with pytest.raises(PermissionError):
        gate.send_message(user_c, ws_id, priv_chan, "I should not be here")


def test_6_user_cannot_create_dm_with_non_member(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_a, external = test_db["user_a"], test_db["external_user"]

    with pytest.raises(ValueError) as excinfo:
        gate.get_or_create_dm_conversation(user_a, ws_id, external)
    assert "not a member of this workspace" in str(excinfo.value)


def test_7_concurrent_dm_requests_do_not_create_duplicates(test_db):
    gate = test_db["gate"]
    conn = test_db["conn"]
    ws_id = test_db["workspace_id"]
    user_b, user_c = test_db["user_b"], test_db["user_c"]

    results = []
    errors = []

    def call_dm(caller, target):
        try:
            cid = gate.get_or_create_dm_conversation(caller, ws_id, target)
            results.append(cid)
        except Exception as e:
            errors.append(e)

    threads = [
        threading.Thread(target=call_dm, args=(user_b, user_c)),
        threading.Thread(target=call_dm, args=(user_c, user_b)),
        threading.Thread(target=call_dm, args=(user_b, user_c)),
        threading.Thread(target=call_dm, args=(user_c, user_b)),
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert len(errors) == 0
    assert len(set(results)) == 1

    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM conversations WHERE workspace_id = ? AND type = 'dm'", (ws_id,))
    assert cur.fetchone()[0] == 1


def test_8_user_cannot_forge_sender_identity(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_a, user_b = test_db["user_a"], test_db["user_b"]

    pub_chan = gate.create_channel(user_a, ws_id, "general", is_private=False)

    # Authorized send succeeds
    msg_id = gate.send_message(user_b, ws_id, pub_chan, "Legitimate message from Bob")
    assert msg_id

    # Forged sender_id rejected by gatekeeper
    with pytest.raises(PermissionError, match="Cannot forge sender_id"):
        gate.send_message(user_b, ws_id, pub_chan, "Impersonating Alice", sender_id=user_a)


def test_9_user_cannot_insert_message_with_mismatched_workspace_id(test_db):
    gate = test_db["gate"]
    ws_id, ws2_id = test_db["workspace_id"], test_db["workspace2_id"]
    user_b = test_db["user_b"]

    conv_id = gate.create_channel(user_b, ws_id, "general", is_private=False)

    with pytest.raises(sqlite3.IntegrityError) as excinfo:
        gate.send_message(user_b, ws2_id, conv_id, "Mismatched workspace payload")
    assert "FOREIGN KEY constraint failed" in str(excinfo.value)


def test_10_user_cannot_attach_file_to_message_in_another_conversation(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_a = test_db["user_a"]

    conv1 = gate.create_channel(user_a, ws_id, "c1", is_private=False)
    conv2 = gate.create_channel(user_a, ws_id, "c2", is_private=False)
    msg1 = gate.send_message(user_a, ws_id, conv1, "Hello")

    with pytest.raises(PermissionError):
        gate.attach_file(
            user_a, msg1, conv2, ws_id, "file.pdf", "", "application/pdf", 123, f"{ws_id}/{conv2}/file.pdf"
        )


# ============================================================
# HARDENED SECURITY, PRIVACY, MODERATION & REALTIME TESTS
# ============================================================


def test_membership_takeover_via_conversation_members_update_is_denied(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    user_a, user_b = test_db["user_a"], test_db["user_b"]

    pub_chan = gate.create_channel(user_a, ws_id, "general", is_private=False)
    priv_chan = gate.create_channel(user_a, ws_id, "secret", is_private=True)
    gate.mark_conversation_read(user_b, pub_chan)

    with pytest.raises(PermissionError, match="revoked"):
        gate.update_conversation_member(user_b, old_conversation_id=pub_chan, new_conversation_id=priv_chan)

    assert gate.user_can_access_conversation(user_b, priv_chan) is False


def test_channel_privacy_is_immutable_and_cross_workspace_move_is_blocked(test_db):
    gate = test_db["gate"]
    ws_id, ws2_id = test_db["workspace_id"], test_db["workspace2_id"]
    user_b = test_db["user_b"]

    priv_chan = gate.create_channel(user_b, ws_id, "ops-private", is_private=True)

    # Authorized metadata edit works
    gate.update_conversation(user_b, priv_chan, topic="On-call rotations", description="Private ops")

    # Converting private -> public is denied
    with pytest.raises(PermissionError):
        gate.update_conversation(user_b, priv_chan, is_private=False)

    # Cross-workspace migration is denied
    with pytest.raises(PermissionError):
        gate.update_conversation(user_b, priv_chan, workspace_id=ws2_id)

    # Ownership reassignment is denied
    with pytest.raises(PermissionError):
        gate.update_conversation(user_b, priv_chan, created_by=test_db["user_c"])


def test_admins_and_owners_cannot_access_or_moderate_private_conversations_without_membership(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    owner, admin, bob, charlie = test_db["owner"], test_db["user_a"], test_db["user_b"], test_db["user_c"]

    # Bob creates a private channel and invites Charlie only
    priv_chan = gate.create_channel(bob, ws_id, "bob-charlie-only", is_private=True)
    gate.invite_channel_member(bob, priv_chan, charlie)
    msg_id = gate.send_message(charlie, ws_id, priv_chan, "Private update")
    path = f"{ws_id}/{priv_chan}/notes.pdf"
    gate.upload_storage_attachment(charlie, path, "application/pdf")

    # Neither owner nor admin can view, invite themselves, edit/delete channel, delete message, or delete storage file
    for non_member in (owner, admin):
        assert gate.user_can_access_conversation(non_member, priv_chan) is False
        with pytest.raises(PermissionError):
            gate.invite_channel_member(non_member, priv_chan, non_member)
        with pytest.raises(PermissionError):
            gate.update_conversation(non_member, priv_chan, topic="Hijacked")
        with pytest.raises(PermissionError):
            gate.delete_conversation(non_member, priv_chan)
        with pytest.raises(PermissionError):
            gate.soft_delete_message(non_member, msg_id)
        with pytest.raises(PermissionError):
            gate.delete_storage_attachment(non_member, path)

    # Once Bob explicitly invites the owner, moderation in that channel becomes authorized
    gate.invite_channel_member(bob, priv_chan, owner)
    assert gate.user_can_access_conversation(owner, priv_chan) is True
    gate.soft_delete_message(owner, msg_id)
    gate.delete_storage_attachment(owner, path)


def test_message_editing_and_soft_delete_authorization_and_invariants(test_db):
    gate = test_db["gate"]
    ws_id, ws2_id = test_db["workspace_id"], test_db["workspace2_id"]
    owner, admin, bob, charlie = test_db["owner"], test_db["user_a"], test_db["user_b"], test_db["user_c"]

    chan1 = gate.create_channel(owner, ws_id, "engineering", is_private=False)
    chan2 = gate.create_channel(owner, ws_id, "design", is_private=False)
    msg_id = gate.send_message(bob, ws_id, chan1, "Original text")

    # Authorized sender edit succeeds
    gate.edit_message(bob, msg_id, content="Updated text")

    # Moving message across conversations or workspaces is denied
    with pytest.raises(PermissionError):
        gate.edit_message(bob, msg_id, conversation_id=chan2)
    with pytest.raises(PermissionError):
        gate.edit_message(bob, msg_id, workspace_id=ws2_id)
    with pytest.raises(PermissionError):
        gate.edit_message(bob, msg_id, created_at="2020-01-01T00:00:00Z")

    # Other member cannot edit or delete Bob's message
    with pytest.raises(PermissionError):
        gate.edit_message(charlie, msg_id, content="Tampered")
    with pytest.raises(PermissionError):
        gate.soft_delete_message(charlie, msg_id)

    # Admin/owner can soft-delete Bob's message in a public channel they access
    gate.soft_delete_message(admin, msg_id)

    # Editing after soft-delete is denied
    with pytest.raises(PermissionError, match="Deleted messages"):
        gate.edit_message(bob, msg_id, content="Resurrected")


def test_attachment_path_url_svg_and_post_removal_storage_delete(test_db):
    gate = test_db["gate"]
    conn = test_db["conn"]
    ws_id = test_db["workspace_id"]
    admin, bob = test_db["user_a"], test_db["user_b"]

    chan = gate.create_channel(admin, ws_id, "files", is_private=False)
    msg_id = gate.send_message(bob, ws_id, chan, "See attached")

    # SVG upload blocked (stored XSS defense)
    with pytest.raises(ValueError, match="Disallowed MIME"):
        gate.upload_storage_attachment(bob, f"{ws_id}/{chan}/xss.svg", "image/svg+xml")

    # Authorized PNG upload & attachment row succeed
    good_path = f"{ws_id}/{chan}/diagram.png"
    gate.upload_storage_attachment(bob, good_path, "image/png")
    att_id = gate.attach_file(bob, msg_id, chan, ws_id, "diagram.png", "", "image/png", 1024, good_path)
    assert att_id

    # Malicious javascript: file_url rejected by CHECK constraint
    with pytest.raises(sqlite3.IntegrityError):
        gate.attach_file(bob, msg_id, chan, ws_id, "bad.png", "javascript:alert(1)", "image/png", 10, good_path)

    # Cross-conversation storage_path rejected by CHECK constraint
    other_chan = gate.create_channel(admin, ws_id, "other", is_private=False)
    with pytest.raises(sqlite3.IntegrityError):
        gate.attach_file(
            bob, msg_id, chan, ws_id, "leak.png", "", "image/png", 10, f"{ws_id}/{other_chan}/secret.png"
        )

    # Remove Bob from workspace: Bob must NO LONGER be able to delete his previously uploaded file
    conn.execute("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?", (ws_id, bob))
    conn.commit()

    with pytest.raises(PermissionError, match="Conversation access required"):
        gate.delete_storage_attachment(bob, good_path)

    # Admin (still in workspace and able to access public channel) can still clean up the file
    gate.delete_storage_attachment(admin, good_path)


def test_soft_deleted_message_attachments_are_blocked_in_table_and_storage(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    owner, bob, charlie = test_db["owner"], test_db["user_b"], test_db["user_c"]

    chan = gate.create_channel(owner, ws_id, "confidential-docs", is_private=False)
    msg_deleted = gate.send_message(bob, ws_id, chan, "Sensitive file")
    msg_active = gate.send_message(bob, ws_id, chan, "Active file")

    deleted_path = f"{ws_id}/{chan}/secret_v1.pdf"
    active_path = f"{ws_id}/{chan}/public_v2.pdf"

    gate.upload_storage_attachment(bob, deleted_path, "application/pdf")
    gate.upload_storage_attachment(bob, active_path, "application/pdf")
    att_deleted = gate.attach_file(bob, msg_deleted, chan, ws_id, "secret_v1.pdf", "", "application/pdf", 512, deleted_path)
    att_active = gate.attach_file(bob, msg_active, chan, ws_id, "public_v2.pdf", "", "application/pdf", 512, active_path)

    # Before soft-delete: both attachments and storage objects are accessible
    assert gate.list_message_attachments(charlie, msg_deleted) == [att_deleted]
    assert gate.user_can_access_storage_attachment(charlie, deleted_path) is True
    assert gate.list_message_attachments(charlie, msg_active) == [att_active]
    assert gate.user_can_access_storage_attachment(charlie, active_path) is True

    # Soft-delete the first message
    gate.soft_delete_message(bob, msg_deleted)

    # After soft-delete: attachment rows AND storage reads are denied for everyone (sender, member, owner)
    for actor in (bob, charlie, owner):
        assert gate.list_message_attachments(actor, msg_deleted) == []
        assert gate.user_can_access_storage_attachment(actor, deleted_path) is False

    # Sibling non-deleted message attachment remains unaffected
    assert gate.list_message_attachments(charlie, msg_active) == [att_active]
    assert gate.user_can_access_storage_attachment(charlie, active_path) is True


def test_workspace_member_removal_cleanup_preserves_dm_history_and_other_workspaces(test_db):
    gate = test_db["gate"]
    conn = test_db["conn"]
    ws_id, ws2_id = test_db["workspace_id"], test_db["workspace2_id"]
    owner, bob, charlie = test_db["owner"], test_db["user_b"], test_db["user_c"]

    # Bob is in a private channel & DM in ws1, and a private channel in ws2
    priv_ws1 = gate.create_channel(owner, ws_id, "ws1-secret", is_private=True)
    gate.invite_channel_member(owner, priv_ws1, bob)
    dm_bc = gate.get_or_create_dm_conversation(bob, ws_id, charlie)
    dm_msg_id = gate.send_message(bob, ws_id, dm_bc, "Important handoff notes")

    priv_ws2 = gate.create_channel(bob, ws2_id, "ws2-secret", is_private=True)

    # Remove Bob from ws1
    conn.execute("DELETE FROM workspace_members WHERE workspace_id = ? AND user_id = ?", (ws_id, bob))
    conn.commit()

    # Charlie STILL has full DM access and message history in ws1
    assert gate.user_can_access_conversation(charlie, dm_bc) is True
    cur = conn.cursor()
    cur.execute("SELECT content FROM messages WHERE id = ?", (dm_msg_id,))
    assert cur.fetchone()[0] == "Important handoff notes"

    # Bob's private channel in ws2 is untouched
    assert gate.user_can_access_conversation(bob, priv_ws2) is True

    # If Bob is later re-invited to ws1, he does NOT automatically regain access to ws1-secret or old DM
    conn.execute("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'member')", (ws_id, bob))
    conn.commit()
    assert gate.user_can_access_conversation(bob, priv_ws1) is False
    assert gate.user_can_access_conversation(bob, dm_bc) is False


def test_general_channel_cannot_be_duplicated_renamed_or_deleted(test_db):
    gate = test_db["gate"]
    ws_id = test_db["workspace_id"]
    owner, bob = test_db["owner"], test_db["user_b"]

    general_id = gate.create_channel(owner, ws_id, "general", is_private=False)

    # Duplicate #general rejected
    with pytest.raises(sqlite3.IntegrityError):
        gate.create_channel(bob, ws_id, "GENERAL", is_private=False)

    # Renaming or deleting #general rejected even for owner
    with pytest.raises(PermissionError, match="#general"):
        gate.update_conversation(owner, general_id, name="renamed-general")
    with pytest.raises(PermissionError, match="#general"):
        gate.delete_conversation(owner, general_id)


def test_realtime_subscription_and_broadcast_presence_authorization(test_db):
    gate = test_db["gate"]
    ws_id, ws2_id = test_db["workspace_id"], test_db["workspace2_id"]
    owner, admin, bob, charlie, external = (
        test_db["owner"],
        test_db["user_a"],
        test_db["user_b"],
        test_db["user_c"],
        test_db["external_user"],
    )

    pub_chan = gate.create_channel(owner, ws_id, "announcements", is_private=False)
    priv_chan = gate.create_channel(bob, ws_id, "bob-private", is_private=True)
    dm_bc = gate.get_or_create_dm_conversation(bob, ws_id, charlie)

    # 1. Postgres Changes subscription authorization (SELECT RLS)
    assert gate.user_can_receive_postgres_change(bob, "messages", pub_chan) is True
    assert gate.user_can_receive_postgres_change(bob, "messages", priv_chan) is True
    assert gate.user_can_receive_postgres_change(bob, "message_reactions", dm_bc) is True
    assert gate.user_can_receive_postgres_change(bob, "message_attachments", dm_bc) is True
    # Non-member admin/owner & external user denied for private channel / DM
    assert gate.user_can_receive_postgres_change(admin, "messages", priv_chan) is False
    assert gate.user_can_receive_postgres_change(owner, "messages", dm_bc) is False
    assert gate.user_can_receive_postgres_change(external, "messages", pub_chan) is False

    # 2. Presence private channel authorization (presence:<workspace_id>, extension='presence')
    assert gate.user_can_access_realtime_topic(bob, f"presence:{ws_id}", "presence") is True
    assert gate.user_can_access_realtime_topic(external, f"presence:{ws_id}", "presence") is False
    assert gate.user_can_access_realtime_topic(charlie, f"presence:{ws2_id}", "presence") is False
    # Wrong extension rejected
    assert gate.user_can_access_realtime_topic(bob, f"presence:{ws_id}", "broadcast") is False

    # 3. Broadcast private channel authorization (typing:<conversation_id>, extension='broadcast')
    assert gate.user_can_access_realtime_topic(bob, f"typing:{priv_chan}", "broadcast") is True
    assert gate.user_can_access_realtime_topic(charlie, f"typing:{dm_bc}", "broadcast") is True
    # Non-member admin/owner cannot listen to or spoof typing in private channel/DM
    assert gate.user_can_access_realtime_topic(admin, f"typing:{priv_chan}", "broadcast") is False
    assert gate.user_can_access_realtime_topic(owner, f"typing:{dm_bc}", "broadcast") is False
    # Wrong extension & malformed topics fail closed (never throw)
    assert gate.user_can_access_realtime_topic(bob, f"typing:{priv_chan}", "presence") is False
    assert gate.user_can_access_realtime_topic(bob, "typing:not-a-uuid", "broadcast") is False
    assert gate.user_can_access_realtime_topic(bob, "presence:not-a-uuid", "presence") is False
    assert gate.user_can_access_realtime_topic(None, f"presence:{ws_id}", "presence") is False


# ============================================================
# STATIC SQL MIGRATION SECURITY VERIFICATION
# ============================================================


def test_sql_migration_file_naming_and_security_invariants():
    assert not (MIGRATIONS_DIR / "0003_slack_chat_system.sql").exists(), (
        "Duplicate 0003_slack_chat_system.sql must not exist alongside 0003_calendar_integration.sql"
    )
    assert not (MIGRATIONS_DIR / "20261118000000_slack_chat_system.sql").exists(), (
        "Collision: 20261118000000_slack_chat_system.sql collides with 20261118000000_meeting_speaker_mapping.sql on main"
    )
    assert CHAT_MIGRATION_PATH.exists(), f"Expected migration at {CHAT_MIGRATION_PATH}"

    sql = CHAT_MIGRATION_PATH.read_text(encoding="utf-8")
    sql_lower = sql.lower()

    # Runner manages the migration transaction: explicit begin/commit must NOT be present
    assert "begin;" not in sql_lower and "commit;" not in sql_lower

    # Dangerous policies must NOT be created
    assert "create policy conversation_members_update" not in sql_lower
    assert "create policy conversations_insert" not in sql_lower
    assert "create policy messages_delete" not in sql_lower

    # Explicit least-privilege grants for service_role and authenticated
    assert "to service_role;" in sql_lower
    assert "grant update (name, topic, description) on table public.conversations to authenticated;" in sql_lower
    assert "grant update (content) on table public.messages to authenticated;" in sql_lower
    assert "grant insert (conversation_id, user_id) on table public.conversation_members to authenticated;" in sql_lower
    assert "grant update" not in re.findall(r"grant [^\n;]*conversation_members[^\n;]*to authenticated;", sql_lower)

    # All SECURITY DEFINER functions must lock search_path = ''
    definer_blocks = re.findall(
        r"create or replace function\s+([a-z0-9_.]+)\s*\([^)]*\)(.*?)as \$\$",
        sql_lower,
        flags=re.DOTALL,
    )
    assert len(definer_blocks) >= 10
    for fn_name, header in definer_blocks:
        if "security definer" in header:
            assert "set search_path = ''" in header, f"{fn_name} missing fixed search_path = ''"

    # Channel privacy immutability & soft delete RPC
    assert "channel privacy is immutable after creation" in sql_lower
    assert "create or replace function public.create_channel(" in sql_lower
    assert "create or replace function public.soft_delete_message(" in sql_lower

    # Realtime publication & private channel RLS
    assert "alter publication supabase_realtime add table" in sql_lower
    assert "not puballtables" in sql_lower
    for tbl in ("'conversations'", "'messages'", "'message_attachments'", "'message_reactions'"):
        assert tbl in sql_lower
    assert "create policy realtime_chat_messages_select" in sql_lower
    assert "create policy realtime_chat_messages_insert" in sql_lower
    assert "alter table realtime.messages enable row level security" not in sql_lower

    # Composite cursor pagination index (created_at desc, id desc)
    assert "on public.messages(conversation_id, created_at desc, id desc)" in sql_lower

    # Storage security & soft-deleted attachment privacy
    assert "image/svg+xml" not in sql_lower
    assert "array_length(storage.foldername(name), 1) = 2" in sql_lower
    assert "coalesce(owner_id, owner::text)" in sql_lower
    assert "create or replace function private.storage_object_belongs_to_deleted_message(" in sql_lower
    assert "not private.storage_object_belongs_to_deleted_message(name)" in sql_lower
    assert "message_attachments_storage_path_idx" in sql_lower
    assert re.search(
        r"create policy message_attachments_select.*?m\.deleted_at is null",
        sql_lower,
        flags=re.DOTALL,
    )
