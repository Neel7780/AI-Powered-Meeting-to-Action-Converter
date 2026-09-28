---
name: sprint1-code-reviewer
description: >-
  Reviews code contributions, pull requests, and AI-generated files for the Sprint 1
  implementation of the AI-Powered Meeting-to-Action Converter. Checks schema alignment
  against schema.sql, RLS security compliance (backend-only task creation), zero-budget
  stack constraints (Gemini Flash-Lite, free SMTP, no paid APIs), and produces structured
  PR review feedback with actionable code fixes.
---

# Sprint 1 Code Reviewer & PR Quality Gate

Use this skill when reviewing code written by teammates (or AI assistants) for Sprint 1. It acts as an automated quality gate to prevent schema drift, RLS permission traps, paid API leaks, and broken workflows from reaching the `main` branch.

---

## Review Procedure

When asked to review a component, backend router, or pull request:

### Step 1: Run the Automated Compliance Scanner
Run the automated pre-flight script against the target files or directories:

```bash
python3 .agents/skills/sprint1-code-reviewer/scripts/verify_compliance.py <path-to-files-or-directory>
```

This immediately checks for:
- Leaked JWT / service-role tokens or API keys
- Disallowed paid imports (`openai`, `resend`, `twilio`, `@slack/web-api`)
- Frontend RLS mutation traps (`supabase.from('tasks').insert()`)
- Storage path mistakes

---

### Step 2: Core Architecture & Spec Verification Matrix

Evaluate the code against the **Sprint 1 Core Specification Rules**:

#### 1. Schema & Database Alignment ([`schema.sql`](../../schema.sql))
- [ ] **Table Names:** Uses canonical table names (`profiles`, `workspaces`, `workspace_members`, `meetings`, `meeting_participants`, `transcripts`, `transcript_segments`, `extracted_items`, `tasks`, `task_assignees`, `consents`).
- [ ] **No `tasks.user_id`:** Tasks have multiple assignees via junction table `task_assignees (task_id, user_id, is_primary)`. Ensure code doesn't expect `user_id` directly on the `tasks` table!
- [ ] **Workspace Creation:** Verifies workspace creation calls `supabase.rpc('create_workspace', { p_name })`, NOT `supabase.from('workspaces').insert(...)`.
- [ ] **Review Constraint:** When updating `extracted_items` to `approved` or `rejected`, `reviewed_by` and `reviewed_at` MUST be updated at the same time (enforced by `extracted_review_chk`).

#### 2. RLS & Security Boundary
- [ ] **Backend-Only Task Creation:** Task creation and candidate item review MUST occur in the FastAPI backend using the Supabase `service_role` key. The frontend MUST NOT attempt direct client-side task inserts.
- [ ] **Client-Side Task Mutation Limits:** On the frontend, authenticated users may ONLY update task `status` (`todo`, `in_progress`, `blocked`, `done`). Column-level security revokes update privileges on `title`, `deadline`, and `priority`.
- [ ] **Organiser / Admin Access:** `[+ Create Meeting]` and `[Approve]` actions are conditionally rendered only for users with `role in ('admin', 'organiser')` in the active workspace.

#### 3. Storage Upload Path Convention
- [ ] Storage uploads to `meeting-transcripts` bucket MUST use the path format:
  ```text
  meeting-transcripts/{workspace_id}/{meeting_id}/{filename}
  ```
  *(Any other path format will trigger an HTTP 403 RLS violation in Supabase Storage).*

#### 4. Zero-Budget Stack Compliance
- [ ] **LLM Provider:** Uses Gemini 3.1 Flash-Lite (`google-genai` / `gemini-3.1-flash-lite`) or Sarvam 105B. No OpenAI, Anthropic, or paid cloud APIs.
- [ ] **Email:** Uses SMTP (Gmail App Password or Brevo free tier), NOT Resend or SendGrid.
- [ ] **WhatsApp:** Uses one-tap `https://wa.me/?text=...` prefilled links, NOT paid WhatsApp Business Cloud API.

#### 5. Grounded Extraction & Uncertainty Handling (FR-07, FR-08)
- [ ] Verbatim quote (`source_excerpt`) is required on all extracted action items.
- [ ] When an owner cannot be resolved to a workspace member, code sets `owner_user_id: null` and `uncertainty_flag: true` (no guessing or hallucinating names).

---

### Step 3: Produce the Structured Review Output

Format your response using this standard team review template:

```markdown
## 🔍 Sprint 1 Code Review Report

**File(s) Inspected:** `<file paths>`  
**Verdict:** `✅ APPROVE` or `❌ REQUEST CHANGES`

---

### 1. Spec & Schema Alignment Scorecard
- **Schema & Tables:** `[Pass / Fail / Warning]` — Details...
- **RLS & Security Boundary:** `[Pass / Fail / Warning]` — Details...
- **Zero-Budget & API Stack:** `[Pass / Fail / Warning]` — Details...
- **Storage Pathing:** `[Pass / Fail / Warning]` — Details...

---

### 2. Issues & Required Changes (if any)
1. **[Severity: High/Medium/Low]** `File:Line`
   - **Problem:** Explanation of why this violates `schema.sql` or `FINAL_PROJECT_SPEC.md`.
   - **Fix:** Code snippet demonstrating the correct implementation.

---

### 3. Ready-to-Copy Feedback for Teammate (PR Comment)
> *Quote-block this section so the user can easily copy and paste it into GitHub PR comments.*
```
