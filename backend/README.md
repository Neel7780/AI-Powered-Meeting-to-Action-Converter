# ActionPulse Backend (Python 3.11+ / FastAPI)

> **Role in Sprint 1:** Ingestion parsers, Gemini 3.1 Flash-Lite extraction pipeline, review/approval endpoints, and task creation.

---

## 1. Quick Start

### Step 1: Create and Activate Virtual Environment
Inside `backend/`:
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Core Dependencies
Create `requirements.txt`:
```txt
fastapi>=0.110.0
uvicorn[standard]>=0.28.0
pydantic>=2.6.0
supabase>=2.3.0
google-genai>=0.1.1
python-multipart>=0.0.9
python-dotenv>=1.0.1
httpx>=0.27.0
```
Install them:
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY`.

### Step 4: Run FastAPI Development Server
```bash
uvicorn main:app --reload --port 8000
```
- API will run at: `http://localhost:8000`
- Interactive Swagger API docs: `http://localhost:8000/docs`

---

## 2. Core Architectural Responsibilities

1. **Privileged Supabase Client:**
   The backend uses the Supabase **Service-Role Key** to perform verified mutations that the frontend RLS blocks:
   ```python
   import os
   from supabase import create_client, Client

   url = os.environ.get("SUPABASE_URL")
   key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
   supabase: Client = create_client(url, key)
   ```

2. **Endpoints to Build in Sprint 1:**
   * `POST /api/meetings/{id}/extract`
     * Reads canonical transcript text.
     * Calls Gemini 3.1 Flash-Lite with JSON schema output.
     * Inserts candidate items into `public.extracted_items` (defaults to `review_status = 'needs_review'`).
   * `POST /api/meetings/{id}/approve`
     * Receives item approval request from organiser.
     * Updates `extracted_items` (sets `review_status = 'approved'`, `reviewed_by = user_id`, `reviewed_at = now()`).
     * Inserts confirmed task into `public.tasks` and assignees into `public.task_assignees`.
     * (Optional) Sends immediate assignment email via SMTP.
   * `GET /health`
     * Uptime check endpoint queried every 10 min to keep Render from sleeping.

3. **Check Constraint Gotcha:**
   When updating `extracted_items`, remember the `extracted_review_chk` constraint: `review_status = 'approved'` **requires** `reviewed_by` and `reviewed_at` to be non-null in the same update!
