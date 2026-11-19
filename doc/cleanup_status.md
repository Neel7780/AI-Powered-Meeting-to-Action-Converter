# Cleanup before GitHub automation

Implemented against the existing working tree on 13 November 2026. Existing edits were preserved. No deployment, hosted database writes, connected repository changes, model calls, or messages were performed.

## Implemented behavior

- Authentication requires a real Supabase session. Development tokens, demo users, demo workspaces, and demo sign-in are removed. Old `actionpulse_dev_session` and `staging_gate_candidate_items` keys are cleared. Remembered workspace IDs are checked against real memberships; errors remain errors and an empty account offers workspace creation.
- Meetings, review, meeting details, calendar, analytics, velocity, chat, and follow-ups use persisted records. Runtime sample datasets and public product simulations have been removed. Missing records and failed queries do not introduce fabricated replacements.
- Frontend mutations use authenticated backend requests without raw database fallbacks. Approval, rejection, sending, dependencies, and status errors reach the UI. Unsaved review edits are labeled as such; source evidence is read-only. Clipboard indicators wait for the operation to succeed. Unavailable playback, transcript editing, summary regeneration, online ingestion, and automatic agent execution are not represented as successful operations.
- `review_meeting_items` is a service-role-only, invoker-rights RPC. It rechecks organiser access, private meeting visibility, review state, owner membership, transcript grounding, and dependencies. Candidate edits, approval, tasks, assignments, and dependency links commit together or roll back. A workspace lock serializes reviews/graph changes; repeated approvals conflict. Notifications are queued after RPC completion.
- Database triggers enforce same-workspace prerequisites, prevent cycles, maintain completion timestamps, and cascade status changes transactionally, including permitted direct status updates.
- Backend task changes require assignment or an organiser/admin role. Private meeting visibility matches the database access predicate, including explicit participants and task assignees. Communication operations scope records to workspace/task and validate recipients' membership.
- Rollover creates a `task_carryovers` record instead of changing `tasks.meeting_id`, preserving transcript provenance. Velocity uses saved carryovers and measured turnaround durations. Fixed improvement percentages and invented rollover counts were removed.
- Calendar refresh tokens use versioned Fernet authenticated encryption with an explicit `CALENDAR_ENCRYPTION_SECRET`. Existing legacy connections require reconnecting; there is no silent decryption fallback. Browser roles lose access to the credential table and use safe backend metadata.
- Extraction jobs, summaries, chapters, chat, and follow-ups honor AI settings and active consent. Deterministic responses remain available from actual records. Successful fallback extraction/chat runs record the actual provider and model. Bedrock remains the default; the pre-existing Gemini fallback is opt-in.
- Backend tests explicitly block unintended outbound HTTP. Live checks require their opt-in flags.

## Required database migration

Apply `supabase/migrations/20261113123000_cleanup_integrity.sql` after the existing migration chain in a disposable test setup first. Backend approval/rejection, task status cascading, and carryover require this migration; do not release the backend ahead of it. The migration revokes browser access to calendar credentials and adds transactional review, graph triggers, and task carryovers. It does not delete existing data or change existing task provenance.

`schema.sql` does not exist in this repository. The ordered files under `supabase/migrations/` are the database contract; the repository guidance now points there.

## Validation

Normal commands:

```bash
npm run build
npm run lint
npm --prefix frontend test
cd backend
.venv/bin/python -m pytest -q
```

Frontend tests use Node 24's built-in runner and installed TypeScript, with no new dependencies. They check missing configuration, expired sessions, invalid IDs, HTTP/network failures, failed approval without database fallback, failed sending, and successful empty data.

Backend regression coverage includes rollback after assignment failure, prerequisite rejection, repeat approval, private meeting access, assignment-based task status, removed automation endpoints, and revoked consent across model entry points. The SQLite RPC implementation is a test double, not evidence that PostgreSQL functions/RLS/concurrency work.

The current sandbox blocks normal cross-thread asyncio wakeups: even a standalone FastAPI TestClient request stalls. A temporary test runner caps selector polling at 50 ms to run the unchanged tests; this is an execution-environment workaround and is not application code. The full offline backend suite passed with that workaround; exact final results are recorded below.

PostgreSQL, `psql`, and Supabase CLI were unavailable; Docker socket access was denied, and npm registry DNS prevented fetching the CLI. The Vite preview server also failed to bind localhost (`EPERM`), so interactive browser verification was unavailable. The new migration was therefore authored locally and **has not been applied or executed here**. Run these assertions on a fresh, migrated, disposable Supabase/Postgres database:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/cleanup_integration.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/tests/github_integration.sql
```

The SQL checks roll back their fixtures and test real grants, approval rollback, repeat prevention, task-source preservation, cycle rejection, and dependency status cascading. Concurrent multi-session approval/graph checks still require that database environment.

## Stored demo records and final readiness gate

No hosted records or storage objects have been classified, backed up, or deleted in this session. The old runtime identity used profile `00000000-0000-0000-0000-000000000001` and workspace `00000000-0000-0000-0000-000000000002`; these are investigation leads, not permission to delete rows. Generated simulation meetings used other IDs and cannot safely be identified by titles alone.

Before deleting any persisted demo records, obtain a read-only inventory with stable IDs/provenance, list dependent records and `meeting-transcripts/{workspace_id}/{meeting_id}/...` objects, produce a recovery export, and review ambiguous records. Never wipe a workspace or match disposable records by names alone.

Readiness remains pending until the migration and SQL checks pass, a real disposable account completes sign-in → workspace → meeting → transcript → extraction (when configured and consented) → approval → task → refresh/workspace-switch, and stored demo data is accounted for. Live email acceptance/partial-failure behavior, OAuth, Bedrock, GitHub settings, browser persistence, and hosted configuration require that test setup. Existing GitHub connection/access tests remain part of the offline suite.

## Observed results

- Production frontend build passed. JavaScript output decreased from about 4.00 MB to 1.23 MB after removing public simulations; a bundle-size advisory remains.
- Frontend API tests: 9 passed.
- Full backend suite: 223 passed, 3 live tests skipped, 5 existing FastAPI deprecation warnings. Two additional auth/provider regressions passed separately. After moving task cascades exclusively into the database transaction, the affected task/end-to-end subset passed: 16 passed, 1 live test skipped.
- Frontend lint: exit 0, no errors. 56 reviewed warnings remain: 20 render-time date/decorative-effect purity notices, 22 state initialization/synchronization notices, 10 hook dependency/ref cleanup notices, and 4 Fast Refresh export notices. Request-generation ref cleanup intentionally invalidates outstanding requests; this is not a DOM ref. These warnings do not substitute for browser verification, which remains pending.
- `git diff --check` passed. The pre-existing untracked `backend/uv.lock` was retained.
