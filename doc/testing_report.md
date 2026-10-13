# Backend Testing Report — Sprint 1

**Project:** AI-Powered Meeting-to-Action Converter (ActionPulse) · **Team:** G-10 · **Date:** 13 Oct 2026

This report explains every backend test: what it checks, how it runs, and what is still not covered.
Read it before adding or changing a test.

**Current result:** `78 tests → 75 passed, 3 skipped, 0 failed`
(the 3 skipped tests need real keys — see [§5](#5-the-3-skipped-tests)).

---

## 1. How to run the tests

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # macOS / Linux: source venv/bin/activate
pip install -r requirements.txt pytest pytest-cov ruff
pytest tests -q
```

| Command | What it runs |
| :--- | :--- |
| `pytest tests -q` | Everything (about 2 seconds, no internet needed) |
| `pytest tests/test_e2e_sqlite.py -v` | Only the end-to-end flow on the SQL database |
| `pytest tests -k live -s` | Only the real-Gemini tests (needs `GEMINI_API_KEY` in `backend/.env`); `-s` prints what Gemini extracted |
| `pytest tests --cov=app/parsers --cov=app/utils` | Coverage for parsers and dates (Sprint 1 DoD: ≥ 80%) |
| `ruff check .` | Lint |
| `python ../.agents/skills/sprint1-code-reviewer/scripts/verify_compliance.py .` | Team compliance scanner (on Windows, set `PYTHONIOENCODING=utf-8` first) |

**Nothing real is touched by default.** No email is sent, Gemini is not called and no Supabase project is used, unless you put real keys in `backend/.env` and run the `live` / RLS tests.

---

## 2. The three kinds of tests

| Kind | What it means | Files |
| :--- | :--- | :--- |
| **Unit tests** | Test one function on its own (a parser, the date converter, the item validator). No database, no network. | `test_parsers.py`, `test_dates.py`, part of `test_email.py`, part of `test_extraction.py` |
| **Endpoint tests (mocked DB)** | Call a real API endpoint, but the database answers are fake (`MagicMock`). They check status codes and which DB calls are made. | `test_meetings.py`, `test_review.py`, `test_workspaces.py`, `test_health.py`, `test_internal.py`, part of `test_extraction.py` |
| **End-to-end tests (real SQL database)** | Run the **whole Sprint 1 demo path** through the real endpoints and real code of **every backend member**, on a real SQL database that enforces our schema rules. | `test_e2e_sqlite.py` (+ helper `sqlite_supabase.py`) |

The end-to-end tests are the most important ones. They prove that everyone's parts **work together**, not just separately.

---

## 3. The end-to-end tests — `test_e2e_sqlite.py`

### 3.1 How it works

The backend normally talks to Supabase. For these tests, `tests/sqlite_supabase.py` replaces Supabase with an **in-memory SQLite database** that copies our schema (`supabase/migrations/0001` + `0002`):

- the same tables and columns;
- the same rules: CHECK constraints, allowed enum values, UNIQUE keys, foreign keys, `updated_at`;
- the same `validate_task_source` trigger (a task's quote must equal its approved item's quote).

So if any code writes something the real database would reject, **the test fails**. We checked this by trying 8 bad writes on purpose; the database rejected every one:

| Bad write tried | Rejected with |
| :--- | :--- |
| Task from an item that isn't approved | `A task can only be created from an approved extracted item` |
| Task whose quote differs from its item | `Task source excerpt must match the approved extracted item` |
| A second task for the same item | `UNIQUE constraint failed: tasks.extracted_item_id` |
| Item marked approved without `reviewed_by` / `reviewed_at` | `CHECK constraint failed` (extracted_review_chk) |
| Action with an empty task | `CHECK constraint failed` |
| Confidence of 1.5 | `CHECK constraint failed` |
| Meeting status `'done'` (not a real status) | `CHECK constraint failed` |
| Item for a meeting that doesn't exist | `FOREIGN KEY constraint failed` |

**What is replaced in these tests:**
- **Gemini** returns a fixed, correct answer for the sample transcript (except in the `live` test, which calls real Gemini).
- **SMTP**: emails are captured in a list, not sent.
- **Login**: the Bearer token is simply the user's id. Real Supabase JWT checking is not tested here (see §6).

**The test workspace:** Priya Nair (`admin`, shown as Manager), Aman Shah and Rahul Mehta (`member`).
**The transcript:** the shared sample from `backend_plan.md` Appendix A (10 lines, including a prompt-injection line).

### 3.2 The tests

| Test | What it proves | Whose code it runs |
| :--- | :--- | :--- |
| `test_health_reports_database_connected` | `GET /health` reaches the database and reports `connected`. | BE-4 |
| `test_invites_only_admins_and_store_only_the_token_hash` | The Manager can invite (201). The email is lower-cased, only the SHA-256 **hash** of the token is stored (never the token), and the invite email goes out. A member gets **403**. Inviting someone who is already a member gets **409**. | BE-1, BE-2 |
| `test_full_flow_extract_approve_tasks_emails` | **The full demo, step by step** — see §3.3. | BE-1, BE-2, BE-3, BE-4, BE-5 |
| `test_no_ai_meeting_never_reaches_the_model` | A meeting with AI processing **off** has no consent row, `/extract` returns **409**, Gemini is **never called** and no `llm_runs` row is written. | BE-3, BE-4 |
| `test_failed_model_call_marks_meeting_failed_and_allows_rerun` | If Gemini fails (e.g. rate limit), the meeting becomes `failed` and the error is logged in `llm_runs` (`success = false`). Running extract again then works and the meeting becomes `ready`. | BE-3 |
| `test_full_flow_live_gemini` | Same flow with **real Gemini**. Prints every extracted item, then checks that Rahul gets the Safari bug, Aman (not Priya) gets onboarding, there is no dark-mode item, the injection line created nothing, and emails go to Aman and Rahul but not Priya. *Skipped without a key.* | Everyone + real Gemini |

### 3.3 What the full-flow test checks, step by step

| Step | Endpoint | Checked |
| :--- | :--- | :--- |
| 1. Create meeting | `POST /api/workspaces/{id}/meetings` | `201`, status `draft`, 1 consent row, 3 participants (Aman, Rahul, external "Vendor - Acme") |
| 2. Paste transcript | `POST /api/meetings/{id}/transcript` | `201`, 10 segments, `canonical_text` saved |
| 3. Extract | `POST /api/meetings/{id}/extract` | `202`; the background job finishes and the meeting becomes `ready`; the model got the meeting weekday ("Monday"); 6 items saved; Rahul and Aman are the right owners; deadline "by Wednesday" → `2026-10-07T18:29:59+00:00` (end of day IST in UTC); README and vendor items flagged; 1 `llm_runs` row with tokens and cost |
| 4. Wrong role | `POST /api/meetings/{id}/approve` as Aman | `403`: a member can't approve |
| 5. Review | `POST …/approve` and `POST …/reject` as Priya | Approves 5 items (and reassigns the README task to Priya), rejects 1. `200`; **4 tasks** created, because the decision becomes no task |
| 6. Board data | `tasks`, `task_assignees` | All tasks in `todo`; Rahul, Aman and Priya are primary assignees; the vendor task has no assignee and `external_owner_label = "vendor"` (the "Assignee Required" badge) |
| 7. Emails | `notify_tasks_assigned` (runs after approve) | **Exactly 3 emails** (Aman, Priya, Rahul), none for the vendor; 3 `notifications` rows with status `sent` |
| 8. Double click | approve the same item again | `409`, and still only 4 tasks |
| 9. Re-send | call `notify_tasks_assigned` again | **No duplicate emails** |

---

## 4. All test files

### `test_extraction.py` — BE-3 AI extraction (21 tests + 1 live)

**Validation rules** (`app/services/llm/validate.py`): these decide which items get the "uncertain" flag.

| Test | Checks |
| :--- | :--- |
| `test_clean_action_is_not_flagged_and_gets_timestamps` | A clear action keeps its owner, converts its deadline to UTC, gets the transcript timestamp of its quote, and is **not** flagged |
| `test_non_verbatim_excerpt_is_flagged_and_has_no_timestamps` | A quote that isn't in the transcript word for word is flagged |
| `test_curly_quotes_and_extra_spaces_still_match` | `let’s` vs `let's` and double spaces still count as a match |
| `test_unknown_ref_clears_owner_keeps_name_and_flags` | An unknown member ref (e.g. `M9`) → no owner, the name is kept, flagged. **The AI never guesses an owner.** |
| `test_uncertain_actions_are_flagged` (×4) | Flagged when: no deadline · deadline before the meeting · confidence < 0.70 · owner confidence < 0.70 |
| `test_decision_needs_no_owner_or_deadline` | Decisions and information are not flagged just for having no owner or deadline |
| `test_confidences_are_clamped` | Values like 1.4 or −0.2 become 1.0 / 0.0 (the DB only allows 0–1) |
| `test_empty_excerpt_and_taskless_action_are_dropped` | Items the DB would reject are dropped |

**Prompt safety** (`app/services/llm/prompt.py`)

| Test | Checks |
| :--- | :--- |
| `test_roster_falls_back_to_email_prefix` | Members are sent to the AI as `M1: Aman Shah`; with no display name, the part of the email before `@` is used. No UUIDs or emails are sent. |
| `test_transcript_cannot_close_its_own_delimiter` | A transcript containing `</meeting_transcript>` can't break out of its delimiter (prompt-injection defence) |

**The `/extract` endpoint** (`app/api/extraction.py`)

| Test | Checks |
| :--- | :--- |
| `test_no_ai_meeting_returns_409_and_never_calls_the_model` | No-AI meeting → 409; neither the job nor the Gemini client is ever created |
| `test_extract_queues_the_job_and_clears_old_pending_items` | 202, old `needs_review` items deleted, status set to `processing`, job queued |
| `test_extract_conflicts` (×3) | 409 when: a job is already running (< 5 min) · no transcript · no active consent |
| `test_stale_processing_job_can_be_rerun` | A job stuck in `processing` for more than 5 minutes can be re-run |

**The background job** (`app/services/llm/runner.py`)

| Test | Checks |
| :--- | :--- |
| `test_runner_saves_items_logs_the_call_and_marks_ready` | Saves items with `meeting_id` and `provider`, writes one `llm_runs` row, sets `ready` |
| `test_runner_marks_failed_and_logs_the_error_when_the_model_fails` | Gemini error → `llm_runs.success = false` with the error code, no items, status `failed` |
| `test_live_gemini_appendix_a` | Real Gemini on the sample transcript *(skipped without a key)* |

### `test_meetings.py` — BE-4 meetings and transcripts (8 tests)

| Test | Checks |
| :--- | :--- |
| `test_create_meeting_success` | Organiser creates a meeting → 201 |
| `test_create_meeting_requires_attestation` | AI on but attestation not ticked → 422 |
| `test_create_meeting_forbidden_for_regular_member` | Member → 403 |
| `test_create_meeting_invalid_timezone` | Bad timezone → 422 |
| `test_submit_transcript_paste_success` | Paste text → 201 with the segment and word count |
| `test_submit_transcript_conflict_on_ready_status` | A transcript can't be replaced after extraction (`ready`) → 409 |
| `test_submit_transcript_file_upload_vtt` | `.vtt` upload is parsed and stored at `{workspace_id}/{meeting_id}/{file}` |
| `test_submit_transcript_unsupported_file_extension` | e.g. `.pdf` → 422 |

### `test_review.py` — BE-4 review gate (6 tests)

| Test | Checks |
| :--- | :--- |
| `test_approve_action_item_creates_task_and_assignee` | Approved action → task + primary assignee + background email |
| `test_approve_decision_item_creates_no_task` | Decisions are approved but don't become tasks |
| `test_approve_already_approved_item_returns_conflict` | Approving twice → 409 |
| `test_approve_non_member_owner_returns_422` | Assigning someone outside the workspace → 422 |
| `test_approve_forbidden_for_regular_member` | Member → 403 |
| `test_reject_candidate_items_success` | Reject sets `rejected`, reviewer, time and reason |

### `test_parsers.py` — transcript parsers (10 tests)

| Test | Checks |
| :--- | :--- |
| `test_clean_transcript_data_removes_bom_and_normalizes_crlf` | Strips the BOM and Windows line endings |
| `test_clean_transcript_data_invalid_encoding_raises` | Non-UTF-8 file → clear error |
| `test_parse_pasted_text_with_speakers_and_timestamps` | `[00:12] Priya: text` → speaker, time, text |
| `test_parse_text_colon_in_time_not_treated_as_speaker` | `Meeting at 10:30` is not read as speaker "Meeting at 10" |
| `test_parse_vtt_format` / `test_parse_srt_format` / `test_parse_docx_format` | Teams/Zoom/Meet exports and Word files parse correctly |
| `test_parse_transcript_unsupported_extension_raises` | Unknown file type → error |
| `test_parse_transcript_empty_segments_raises` | Empty transcript → error |
| `test_to_canonical_text` | Segments become the `Speaker: text` lines sent to the AI |

### `test_dates.py` — date conversion (5 tests)

| Test | Checks |
| :--- | :--- |
| `test_is_valid_timezone` | Accepts `Asia/Kolkata`, rejects nonsense |
| `test_to_utc_date_only_defaults_to_end_of_day` | `2026-10-02` in IST → `18:29:59 UTC` (23:59:59 local) |
| `test_to_utc_with_time` / `test_to_utc_with_seconds` | Times convert correctly |
| `test_to_utc_invalid_inputs_never_raise` | Bad input returns `None`, never crashes |

### `test_email.py` — BE-2 email and notifications (12 tests)

| Test | Checks |
| :--- | :--- |
| `test_send_email_success` / `…_positional_and_keywords` | Sends via SMTP with TLS and login |
| `test_send_email_missing_body_raises_value_error` / `…_raises_on_failure` | Errors are raised, not hidden |
| `test_send_invite_email` | Invite email content and link |
| `test_format_deadline_*` (×3) | Deadline shown in the assignee's timezone; handles empty or bad values |
| `test_notify_skips_unassigned_and_external_tasks` | No email for tasks without a member owner |
| `test_notify_skips_former_workspace_member` | No email to someone who left the workspace |
| `test_notify_batches_multiple_tasks_for_same_user` | Two tasks for one person → **one** email |
| `test_notify_idempotency_skips_already_notified_task` | Never emails the same task twice |

### `test_workspaces.py` — BE-1 invites (2 tests)

| Test | Checks |
| :--- | :--- |
| `test_create_invite_non_admin_gets_403` | Only admins invite |
| `test_create_invite_success` | Invite row + email |

### `test_internal.py` — BE-2 keep-alive tick (4 tests)

| Test | Checks |
| :--- | :--- |
| `test_tick_without_header_returns_401` / `…_with_wrong_secret_returns_401` | `/internal/tick` is protected by the secret header |
| `test_tick_with_valid_secret_returns_200` | Correct secret → 200 |
| `test_tick_database_failure_returns_degraded_not_500` | DB down → `degraded`, the server doesn't crash |

### `test_health.py` — BE-4 health (2 tests)

| Test | Checks |
| :--- | :--- |
| `test_health_check_healthy` / `test_health_check_unhealthy` | 200 when the DB answers, 503 when it doesn't |

### `test_rls.py` — BE-1 RLS isolation (1 test, skipped without keys)

| Test | Checks |
| :--- | :--- |
| `test_rls_cross_workspace_isolation` | Logged in as user A with the **anon** key, A sees **0 rows** of user B's meetings, tasks, items and members. Needs a real Supabase project. |

---

## 5. The 3 skipped tests

| Test | Why skipped | How to run it |
| :--- | :--- | :--- |
| `test_e2e_sqlite.py::test_full_flow_live_gemini` | Needs a real Gemini key | Add `GEMINI_API_KEY=...` to `backend/.env`, then `pytest tests -k live -s` |
| `test_extraction.py::test_live_gemini_appendix_a` | Same | Same |
| `test_rls.py::test_rls_cross_workspace_isolation` | Needs a real Supabase project | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` to `backend/.env` |

Live tests only send the **synthetic** sample transcript to Gemini. Never put real meeting notes in a test (Gemini's free tier may use the data).

---

## 6. What is NOT covered yet

| Gap | Why it matters | How to close it |
| :--- | :--- | :--- |
| Real Supabase login (JWT check) | In the SQLite tests the token is just the user id | Run the Swagger flow (`backend_plan.md` §14) against the real project |
| Row-Level Security | SQLite has no RLS; the backend's service-role key bypasses it anyway, but the **frontend** relies on it | `test_rls.py` with real keys |
| Audit log trigger | Not copied to SQLite | Check `audit.audit_log` after a Swagger run |
| Real Gemini quality (precision/recall) | The default tests use a fixed answer | Live tests now; the 10-transcript eval (`eval/`) is still to do |
| Extraction speed (p95 < 45 s) | Not measured | Time 5 live runs on a 30-minute transcript |
| Frontend | No frontend tests here | `CreateMeeting.tsx` must call the backend, and the review page must use `extracted_items` (see the messages sent to the frontend team) |
| CI | No GitHub Actions workflow yet | BE-5: `.github/workflows/ci.yml`. Note: `ruff check .` currently reports older lint issues in some files, which must be fixed first or CI will fail |

---

## 7. Adding a new test

- **Testing one function?** Write a unit test next to the others in that area's file.
- **Testing a new endpoint, or anything that touches several people's code?** Add it to `test_e2e_sqlite.py` and use the `world` fixture. It gives you a fresh database with Priya, Aman and Rahul, `world.post(path, as_user=…)` and `world.db.rows(table, **filters)`.
- **Added a column or table to a migration?** Add it to `SCHEMA` in `tests/sqlite_supabase.py` as well, or the end-to-end tests won't know about it.
- **Calls a new database method** (e.g. `.upsert`, `.neq`)? Add it to `_Query` in `tests/sqlite_supabase.py`.
- **Never** put real API keys, real transcripts or real email addresses in a test file.
