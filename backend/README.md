# ActionPulse Backend (Python 3.11+ / FastAPI)

> **Role:** Ingestion parsers, Amazon Bedrock extraction, meeting summaries, chat, follow-up drafts, review/approval endpoints, and task creation.

---

## 1. Quick Start

### Step 1: Create and Activate Virtual Environment
Inside `backend/`:
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Core Dependencies
Install the existing requirements (including `langchain-aws`):
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the Bedrock settings, and the optional Gemini fallback key:

```dotenv
AWS_BEARER_TOKEN_BEDROCK=your-bedrock-api-key
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
LLM_PROVIDER_ALLOWLIST=bedrock,gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Generate the key in the Amazon Bedrock console under **API keys**. It is a bearer
API key, not an AWS access-key/secret-key pair. Keep it in `backend/.env` locally
and the backend's environment settings on Render; never put it in frontend variables.
Gemini is called only when Bedrock fails and Gemini is allow-listed and configured.
Keep both keys in backend environment settings; never put them in frontend variables.

Bedrock is the primary provider. All AI features share its `ChatBedrockConverse` client in
`app/services/llm/bedrock.py`, with Gemini used as the configured failure fallback. The Bedrock model must support the Converse API
and tool calling for structured extraction, summaries, and chat. Use a model ID
or inference profile ID available to your account in the configured region;
for example, `us.amazon.nova-lite-v1:0` is a US inference profile alternative.
The client caps responses at 4,096 tokens and uses a 60-second read timeout with
up to two SDK retries. Existing transcript grounding, consent checks, review gates,
and deterministic fallbacks remain in place.

Bedrock is billed by usage; AWS credits have account-specific eligibility and expiry.
Confirm that your selected model is covered before using real meetings. Token usage
and the Bedrock model ID are recorded in `llm_runs`; `est_cost_inr` is left null
because the previous Gemini rates do not apply. Check AWS Billing for actual charges.

References: [AWS API-key setup](https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys-use.html),
[LangChain Bedrock integration](https://docs.langchain.com/oss/python/integrations/chat/bedrock).

Offline checks: `python -m pytest tests`. Live Bedrock tests are opt-in:
set `RUN_LIVE_BEDROCK_TESTS=1` and a real `AWS_BEARER_TOKEN_BEDROCK` to run them.

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
     * Calls Amazon Bedrock through LangChain with structured schema output.
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

---

## 3. Supabase Auth Configuration (Required)
When setting up a new Supabase project for this backend, you must manually configure the following in the dashboard:
- Providers: **Email (password + magic link)** and **Google**.
- **"Confirm email" MUST BE ON** (invites rely on this).
- **Custom SMTP MUST BE CONFIGURED** using the credentials from BE-2 (Supabase built-in is heavily rate-limited).
- JWT Expiry: **900s (15 min)**.
- Refresh-Token Rotation: **ON**.
- Site URL & Redirect URLs: `http://localhost:5173` and the deployed Vercel URL.
