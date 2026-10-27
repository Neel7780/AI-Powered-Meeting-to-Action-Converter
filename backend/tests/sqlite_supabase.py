"""In-memory SQLite stand-in for the Supabase client, for end-to-end backend tests.

The schema below mirrors supabase/migrations/0001 + 0002 for the tables the backend writes:
same columns, CHECKs (enums become CHECK ... IN), UNIQUE keys, partial unique indexes, foreign keys,
updated_at, and the validate_task_source trigger. Not mirrored: RLS (the backend uses the
service-role key, which bypasses it), audit log, auth.users (profiles stands in for it).
The client answers only the query-builder calls the backend uses.
"""

import sqlite3
import threading
import uuid
from datetime import datetime
from types import SimpleNamespace
from uuid import UUID

NOW = "(strftime('%Y-%m-%dT%H:%M:%f', 'now') || '+00:00')"
TS = f"TEXT NOT NULL DEFAULT {NOW}"

SCHEMA = f"""
PRAGMA foreign_keys = ON;

CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT CHECK (display_name IS NULL OR length(trim(display_name)) BETWEEN 1 AND 120),
  email TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (trim(timezone) <> ''),
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  avatar_url TEXT,
  created_at {TS}, updated_at {TS}
);

CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 120),
  retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days IN (30, 90, 180, 365)),
  created_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  created_at {TS}, updated_at {TS}
);

CREATE TABLE workspace_members (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'organiser', 'member')),
  created_at {TS}, updated_at {TS},
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE workspace_invites (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (email = lower(trim(email))),
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('organiser', 'member')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%f', 'now', '+7 days') || '+00:00'),
  accepted_at TEXT,
  created_at {TS}
);
CREATE UNIQUE INDEX workspace_invites_one_pending ON workspace_invites(workspace_id, email) WHERE accepted_at IS NULL;

CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 300),
  starts_at TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata' CHECK (trim(timezone) <> ''),
  organiser_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  ai_processing INTEGER NOT NULL DEFAULT 1,
  visibility TEXT NOT NULL DEFAULT 'workspace' CHECK (visibility IN ('workspace', 'private')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'ready', 'failed', 'archived')),
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'pending_deletion', 'deleted')),
  retention_expires_at TEXT,
  calendar_event_id TEXT,
  calendar_provider TEXT,
  conference_url TEXT,
  created_at {TS}, updated_at {TS}
);

CREATE TABLE calendar_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  account_email TEXT NOT NULL,
  encrypted_refresh_token TEXT NOT NULL,
  access_token TEXT,
  token_expires_at TEXT,
  sync_enabled INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  created_at {TS}, updated_at {TS}
);

CREATE TABLE meeting_participants (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  external_name TEXT,
  created_at {TS},
  CHECK (user_id IS NOT NULL OR nullif(trim(external_name), '') IS NOT NULL)
);
CREATE UNIQUE INDEX meeting_participants_user_uq ON meeting_participants(meeting_id, user_id) WHERE user_id IS NOT NULL;

CREATE TABLE transcripts (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('paste', 'txt', 'vtt', 'srt', 'docx')),
  storage_path TEXT, raw_text TEXT, canonical_text TEXT, file_name TEXT,
  file_size_bytes INTEGER CHECK (file_size_bytes IS NULL OR file_size_bytes BETWEEN 0 AND 10485760),
  mime_type TEXT,
  created_at {TS}, updated_at {TS},
  CHECK ((source = 'paste' AND canonical_text IS NOT NULL)
      OR (source IN ('txt', 'vtt', 'srt', 'docx') AND (storage_path IS NOT NULL OR canonical_text IS NOT NULL)))
);

CREATE TABLE transcript_segments (
  id TEXT PRIMARY KEY,
  transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL CHECK (segment_index >= 0),
  speaker_name TEXT, start_ms INTEGER, end_ms INTEGER,
  text TEXT NOT NULL CHECK (length(trim(text)) > 0),
  created_at {TS},
  CHECK ((start_ms IS NULL AND end_ms IS NULL)
      OR (start_ms IS NOT NULL AND start_ms >= 0 AND end_ms IS NOT NULL AND end_ms >= start_ms)),
  UNIQUE (transcript_id, segment_index)
);

CREATE TABLE extracted_items (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('action', 'decision', 'information')),
  task TEXT, owner_name TEXT,
  owner_user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  owner_confidence REAL CHECK (owner_confidence IS NULL OR owner_confidence BETWEEN 0 AND 1),
  deadline_raw TEXT, deadline_utc TEXT, deadline_timezone TEXT,
  deadline_confidence REAL CHECK (deadline_confidence IS NULL OR deadline_confidence BETWEEN 0 AND 1),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source_excerpt TEXT NOT NULL CHECK (length(trim(source_excerpt)) > 0),
  source_start_ms INTEGER, source_end_ms INTEGER,
  confidence REAL CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  uncertainty_flag INTEGER NOT NULL DEFAULT 0,
  review_status TEXT NOT NULL DEFAULT 'needs_review' CHECK (review_status IN ('needs_review', 'approved', 'rejected')),
  reviewed_by TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TEXT, rejection_reason TEXT, provider TEXT, model_version TEXT,
  created_at {TS}, updated_at {TS},
  CHECK ((source_start_ms IS NULL AND source_end_ms IS NULL)
      OR (source_start_ms IS NOT NULL AND source_start_ms >= 0
          AND source_end_ms IS NOT NULL AND source_end_ms >= source_start_ms)),
  CHECK (type <> 'action' OR nullif(trim(task), '') IS NOT NULL),
  CHECK ((review_status = 'needs_review' AND reviewed_by IS NULL AND reviewed_at IS NULL)
      OR (review_status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  extracted_item_id TEXT UNIQUE REFERENCES extracted_items(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
  description TEXT, deadline_utc TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'blocked', 'done')),
  blocked_by TEXT REFERENCES tasks(id) ON DELETE SET NULL CHECK (blocked_by IS NULL OR blocked_by <> id),
  external_owner_label TEXT,
  source_excerpt TEXT NOT NULL CHECK (length(trim(source_excerpt)) > 0),
  created_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at {TS}, updated_at {TS}, completed_at TEXT
);

CREATE TABLE task_assignees (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary INTEGER NOT NULL DEFAULT 0,
  assigned_at {TS},
  PRIMARY KEY (task_id, user_id)
);
CREATE UNIQUE INDEX task_one_primary_assignee_uq ON task_assignees(task_id) WHERE is_primary;

CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  attested_by TEXT NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  notice_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'attested' CHECK (status IN ('attested', 'revoked')),
  created_at {TS}, revoked_at TEXT,
  CHECK ((status = 'attested' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX active_meeting_consent_uq ON consents(meeting_id) WHERE status = 'attested';

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES tasks(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  event_type TEXT NOT NULL CHECK (event_type IN ('task_assigned', 'deadline_24h', 'overdue', 'daily_digest')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'permanently_failed', 'deferred')),
  attempt INTEGER NOT NULL DEFAULT 0 CHECK (attempt BETWEEN 0 AND 3),
  next_attempt_at TEXT, sent_at TEXT, last_error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at {TS}, updated_at {TS}
);

CREATE TABLE llm_runs (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, model_version TEXT NOT NULL,
  input_tokens INTEGER CHECK (input_tokens IS NULL OR input_tokens >= 0),
  output_tokens INTEGER CHECK (output_tokens IS NULL OR output_tokens >= 0),
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  est_cost_inr REAL CHECK (est_cost_inr IS NULL OR est_cost_inr >= 0),
  payload_hash TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error_code TEXT,
  created_at {TS}
);
"""

# private.validate_task_source(), same rules and messages
for _event in ("INSERT", "UPDATE"):
    SCHEMA += f"""
CREATE TRIGGER validate_task_source_{_event.lower()} BEFORE {_event} ON tasks FOR EACH ROW BEGIN
  SELECT RAISE(ABORT, 'Referenced extracted item does not exist') WHERE NEW.extracted_item_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM extracted_items WHERE id = NEW.extracted_item_id);
  SELECT RAISE(ABORT, 'A task can only be created from an approved extracted item')
    FROM extracted_items WHERE id = NEW.extracted_item_id AND review_status <> 'approved';
  SELECT RAISE(ABORT, 'Task meeting does not match extracted item meeting')
    FROM extracted_items WHERE id = NEW.extracted_item_id AND meeting_id <> NEW.meeting_id;
  SELECT RAISE(ABORT, 'Task source excerpt must match the approved extracted item')
    FROM extracted_items WHERE id = NEW.extracted_item_id AND source_excerpt <> NEW.source_excerpt;
  SELECT RAISE(ABORT, 'Task workspace does not match meeting workspace')
    WHERE NOT EXISTS (SELECT 1 FROM meetings WHERE id = NEW.meeting_id AND workspace_id = NEW.workspace_id);
END;"""

for _table in ("profiles", "workspaces", "workspace_members", "meetings", "transcripts",
               "extracted_items", "tasks", "notifications"):
    SCHEMA += f"""
CREATE TRIGGER {_table}_set_updated_at AFTER UPDATE ON {_table} FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at BEGIN
  UPDATE {_table} SET updated_at = {NOW} WHERE rowid = NEW.rowid;
END;"""

BOOL_COLUMNS = {"ai_processing", "is_primary", "uncertainty_flag", "success", "mfa_enabled"}


def _value(v):
    if isinstance(v, bool):
        return int(v)
    if isinstance(v, UUID):
        return str(v)
    if isinstance(v, datetime):
        return v.isoformat()
    return v


class _Query:
    def __init__(self, db: "SQLiteSupabase", table: str):
        self.db, self.table = db, table
        self.where: list[str] = []
        self.params: list = []
        self.tail = ""
        self.op, self.payload, self.count = "select", None, None

    def _filter(self, clause: str, *params):
        self.where.append(clause)
        self.params.extend(_value(p) for p in params)
        return self

    def select(self, _columns: str = "*", count: str | None = None):
        self.count = count
        return self  # always returns every column; extra columns are harmless to callers

    def eq(self, col, val):
        return self._filter(f"{col} = ?", val)

    def gte(self, col, val):
        return self._filter(f"{col} >= ?", val)

    def in_(self, col, vals):
        vals = list(vals)
        return self._filter(f"{col} IN ({', '.join('?' * len(vals))})", *vals) if vals else self._filter("0")

    def is_(self, col, val):
        assert val in ("null", None), "only is_(col, 'null') is supported"
        return self._filter(f"{col} IS NULL")

    def order(self, col, desc=False):
        self.tail += f" ORDER BY {col}{' DESC' if desc else ''}"
        return self

    def limit(self, n):
        self.tail += f" LIMIT {int(n)}"
        return self

    def insert(self, data):
        self.op, self.payload = "insert", data
        return self

    def update(self, data):
        self.op, self.payload = "update", data
        return self

    def delete(self):
        self.op = "delete"
        return self

    def execute(self):
        where = f" WHERE {' AND '.join(self.where)}" if self.where else ""
        if self.op == "select":
            rows = self.db.run([(f"SELECT * FROM {self.table}{where}{self.tail}", self.params)])
        elif self.op == "insert":
            statements = []
            for row in self.payload if isinstance(self.payload, list) else [self.payload]:
                row = {k: _value(v) for k, v in row.items()}
                if "id" in self.db.columns(self.table):
                    row.setdefault("id", str(uuid.uuid4()))
                cols = ", ".join(row)
                marks = ", ".join("?" * len(row))
                sql = f"INSERT INTO {self.table} ({cols}) VALUES ({marks}) RETURNING *"
                statements.append((sql, list(row.values())))
            rows = self.db.run(statements)  # one transaction, like a PostgREST bulk insert
        elif self.op == "update":
            sets = ", ".join(f"{k} = ?" for k in self.payload)
            params = [_value(v) for v in self.payload.values()] + self.params
            rows = self.db.run([(f"UPDATE {self.table} SET {sets}{where} RETURNING *", params)])
        else:
            rows = self.db.run([(f"DELETE FROM {self.table}{where} RETURNING *", self.params)])
        return SimpleNamespace(data=rows, count=len(rows) if self.count else None)


class SQLiteSupabase:
    """Drop-in for the service-role supabase client: set `app.core.supabase.db` to an instance.

    Auth: a Bearer token is just a profiles.id. Storage uploads are kept in `.uploads`.
    """

    def __init__(self):
        self.conn = sqlite3.connect(":memory:", check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(SCHEMA)
        self.lock = threading.Lock()
        self._columns: dict[str, set[str]] = {}
        self.uploads: dict[str, bytes] = {}
        self.auth = SimpleNamespace(get_user=self._get_user)
        self.storage = SimpleNamespace(from_=lambda bucket: SimpleNamespace(
            upload=lambda path, file, file_options=None: self.uploads.__setitem__(f"{bucket}/{path}", file)))

    def table(self, name: str) -> _Query:
        return _Query(self, name)

    def columns(self, table: str) -> set[str]:
        if table not in self._columns:
            self._columns[table] = {r["name"] for r in self.conn.execute(f"PRAGMA table_info({table})")}
        return self._columns[table]

    def run(self, statements: list[tuple[str, list]]) -> list[dict]:
        with self.lock:
            self.conn.execute("BEGIN")
            try:
                rows = [r for sql, params in statements for r in self.conn.execute(sql, params).fetchall()]
                self.conn.execute("COMMIT")
            except Exception:
                self.conn.execute("ROLLBACK")
                raise
        return [{k: bool(r[k]) if k in BOOL_COLUMNS else r[k] for k in r.keys()} for r in rows]

    def _get_user(self, token: str):
        rows = self.table("profiles").eq("id", token).execute().data
        return SimpleNamespace(user=SimpleNamespace(id=rows[0]["id"], email=rows[0]["email"]) if rows else None)

    def rows(self, table: str, **eq) -> list[dict]:
        """Test helper: SELECT * FROM table WHERE k = v ..."""
        q = self.table(table)
        for k, v in eq.items():
            q = q.eq(k, v)
        return q.execute().data
