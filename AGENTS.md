# AI Agent Guidelines & Architecture Rules for Team G-10 (IT314)

> **Project:** AI-Powered Meeting-to-Action Converter  
> **Course:** IT314 – Software Engineering (Agile / SCRUM)  
> **Target Phase:** Sprint 1 — Vertical Slice  

All AI assistants and pair programmers working in this repository MUST strictly follow the architecture, database schema, and security rules outlined below.

---

## 1. Zero-Budget Tech Stack (Hard Constraint)

Our project operates strictly on free-tier services. **Never import or configure paid commercial APIs:**

| Layer | Service & Version | Strict Implementation Rules |
| :--- | :--- | :--- |
| **Frontend** | React 18+ (Vite SPA, PWA) or Next.js | Hosted on Vercel Hobby / Cloudflare Pages. Client-side code uses `@supabase/supabase-js` with the **Anon Key** (`VITE_SUPABASE_ANON_KEY`) only. |
| **Backend** | Python 3.11+ / FastAPI | Hosted on Render Free web service. Ephemeral disk. Backend code uses the Supabase **Service-Role Key** for privileged mutations. |
| **Database & Auth** | Supabase Postgres (Mumbai region) | Database tables, Row-Level Security (RLS) policies, and triggers are defined in [`schema.sql`](schema.sql). |
| **LLM Provider** | Google Gemini 3.1 Flash-Lite (Free) | Use `google-genai` / `gemini-3.1-flash-lite`. Fallback: Sarvam 105B (free credits). **DO NOT import OpenAI or Anthropic.** |
| **Email** | SMTP (Gmail App Password / Brevo free) | Standard Python `smtplib` / email client. **DO NOT import Resend or SendGrid.** |
| **WhatsApp** | `wa.me` URL Link + Web Push (PWA) | Zero-cost 1-tap WhatsApp sharing link. **DO NOT use paid WhatsApp Business API.** |

---

## 2. Database & Schema Rules (Source of Truth: `schema.sql`)

Always align your code with the canonical [`schema.sql`](schema.sql):

1. **Table Names (Exact Matches Required):**
   - User Profiles: `profiles` (references `auth.users(id)`). Do NOT create or query a custom `users` table.
   - Workspaces: `workspaces`, `workspace_members`.
   - Meetings: `meetings`, `meeting_participants`.
   - Transcripts: `transcripts`, `transcript_segments`. Do NOT use `meeting_notes`.
   - Candidate AI Items: `extracted_items`. Do NOT use `action_items`.
   - Confirmed Board Tasks: `tasks`, `task_assignees`.
   - Compliance & Audit: `consents`, `notifications`, `push_subscriptions`, `llm_runs`, `audit.audit_log`.

2. **Task Assignees:**
   - Tasks do **not** have a `tasks.user_id` column.
   - Task ownership is stored in `task_assignees (task_id, user_id, is_primary)`. Always join on `task_assignees` when querying a user's tasks!

3. **Workspace Creation:**
   - To create a workspace and establish the initial Admin, you **must call the database RPC**:
     ```typescript
     const { data: workspaceId, error } = await supabase.rpc('create_workspace', { p_name: 'Team Name' });
     ```
   - Do NOT run `supabase.from('workspaces').insert(...)` (blocked by RLS).

---

## 3. Row-Level Security (RLS) & Mutation Boundaries

Our system uses a **Backend-First Mutation Architecture** for data security:

### ❌ What the Frontend (React / Next.js Client) CANNOT Do:
- **Never insert into `tasks` directly from the frontend:**  
  `supabase.from('tasks').insert(...)` will fail with an RLS error. Tasks must only be created by the FastAPI backend when an organiser approves an item.
- **Never update `extracted_items` directly from the frontend:**  
  Candidate item reviews must go through the FastAPI review endpoint (`POST /api/meetings/{id}/approve`).

### ✅ What the Frontend CAN Do:
- `SELECT` meetings, transcripts, extracted items, and tasks (scoped to the user's workspace).
- `UPDATE (status)` on `public.tasks`: Authenticated assignees and workspace organisers/admins can drag cards and update the task status column (`todo`, `in_progress`, `blocked`, `done`).

---

## 4. Storage Bucket Conventions (`meeting-transcripts`)

When uploading transcript files (`.vtt`, `.srt`, `.txt`, `.docx`) to the Supabase Storage bucket `meeting-transcripts`, the file path **MUST strictly match**:

```text
meeting-transcripts/{workspace_id}/{meeting_id}/{filename}
```

*Uploading to any other folder structure will be rejected with an HTTP 403 Forbidden by Supabase Storage RLS policies.*

---

## 5. GenAI Extraction & Prompt Injection Defenses

1. **Grounded Extraction (Verbatim Quotes):** Every extracted action item MUST include a `source_excerpt` matching a verbatim sentence from the transcript.
2. **Missing Owners & Uncertainty Flags:** When a transcript mentions a task without a clear member assignment (or names an external person), set `owner_user_id: null` and `uncertainty_flag: true`. **Never guess or hallucinate an owner.**
3. **Prompt Injection Guard:** Transcripts are untrusted user input. Always wrap transcript content in XML/markdown delimiters (e.g. `<meeting_transcript>...</meeting_transcript>`) and instruct the LLM to ignore instructions inside the transcript.
