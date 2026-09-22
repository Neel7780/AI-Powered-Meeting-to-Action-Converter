# G-10 IT314 — Deep Research: Infrastructure, Transcript/Caption Capture, Email, WhatsApp, Database
**Verified:** 22 September 2026  
**Project:** AI-Powered Meeting-to-Action Converter for Teams

## 1. Infrastructure principle

The project has no meaningful funding during the student MVP.

Therefore the architecture should minimize:
- paid media processing;
- unnecessary AI calls;
- vendor count;
- persistent compute;
- duplicate transcription;
- premature realtime infrastructure.

The key decision is:

> **Transcript/caption ingestion is the primary meeting-data path. External ASR is a secondary fallback.**

The application should accept:

```text
native post-meeting transcript
native realtime captions/transcript
uploaded transcript
external ASR transcript
```

All four become the same canonical transcript object before the LLM pipeline.

Source of truth:
https://www.notion.so/G-10-IT314-Team-Hub-1666e879513483b0be7881b1b3ccff07

# PART A — ZERO-BUDGET HOSTING

## 2. Frontend — Vercel

Vercel Hobby remains a $0 option for small/personal projects.

Use for:
- Next.js;
- static assets;
- frontend deployment.

Sources:
https://vercel.com/pricing
https://vercel.com/docs/plans/hobby

Do not treat Hobby as a production SLA.

## 3. Backend — Render

Render currently provides free web services useful for testing/hobby workloads.

Known limitations include:
- cold starts/spin-down;
- ephemeral filesystem;
- limited free compute;
- no production-grade SLA.

Use the service for FastAPI.

Never treat the local Render filesystem as durable storage.

Sources:
https://render.com/pricing
https://render.com/docs/free

## 4. Railway

Railway remains a valid paid migration option, but its current economics should not be described as a permanently free server.

Use only if the team later needs different compute/latency behaviour.

Sources:
https://railway.com/pricing
https://docs.railway.com/reference/pricing

# PART B — DATABASE + AUTH

## 5. PostgreSQL

Core entities are relational:
- users;
- workspaces;
- meetings;
- participants;
- transcripts;
- action items;
- deadlines;
- integrations;
- tasks;
- notifications;
- audit events.

Suggested tables:

```text
users
workspaces
workspace_members
meetings
meeting_participants
transcripts
transcript_segments
action_items
integrations
integration_tokens
tasks
task_syncs
notifications
notification_attempts
audit_events
```

## 6. Supabase

Current Free plan includes, among other allowances:
- 500 MB database;
- 5 GB storage;
- 5 GB cached egress;
- 5 GB uncached egress;
- 50,000 MAU;
- 2 active free projects.

Free projects can pause after inactivity.

Sources:
https://supabase.com/pricing
https://supabase.com/docs/guides/platform/database-size

Recommended MVP:
**Supabase Postgres + Supabase Auth.**

## 7. Neon

Neon is a valid alternative managed PostgreSQL option.

Keep it as a fallback rather than operating Supabase and Neon simultaneously.

Source:
https://neon.tech/pricing

# PART C — TRANSCRIPT/CAPTION FIRST

## 8. Capture priority

Use:

```text
1. Platform-native post-meeting transcript
2. Platform-native realtime captions/transcript
3. External ASR
4. Self-hosted/open-source ASR
```

The product's important object is:

```json
{
  "meeting_id": "m_123",
  "speaker_id": "participant_42",
  "speaker_name": "Bhagy Parmar",
  "start_ms": 12000,
  "end_ms": 15100,
  "text": "I'll finish the API by Friday."
}
```

The LLM should not care whether this object came from:
- Teams;
- Meet;
- Zoom;
- upload;
- Sarvam;
- OpenRouter;
- self-hosted ASR.

## 9. Teams: preferred free evaluation path

Microsoft Graph exposes Teams meeting transcripts and supports an **evaluation mode without Azure billing configuration**.

With Azure billing, Teams transcript content is currently:
**$0.0022/minute**.

The evaluation mode has a monthly quota per app/tenant and resets each calendar month.

Important:
- the underlying meeting/tenant must have transcript functionality available;
- personal Microsoft accounts are not supported for the transcript API.

Sources:
https://learn.microsoft.com/en-ca/graph/teams-licenses
https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts
https://learn.microsoft.com/en-us/graph/api/calltranscript-get

### Infrastructure decision

```text
Teams transcript
      ↓
Graph API
      ↓
VTT parser
      ↓
canonical transcript
```

Do not run ASR on the same recording if a usable Teams transcript already exists.

## 10. Google Meet: use transcript when the account can generate it

Google Meet transcript entries provide:
- participant;
- text;
- language;
- start time;
- end time.

Google currently supports transcripts on eligible Workspace editions such as Business Standard/Plus, Enterprise tiers, Teaching & Learning Upgrade, Education Plus and Workspace Individual.

Education student licences have transcripts off by default.

Therefore:
- eligible Workspace -> use Meet transcript;
- free consumer Meet -> do not assume transcript availability.

Sources:
https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries
https://support.google.com/meet/answer/12849897

## 11. Google Meet realtime

Meet Media API can supply realtime audio/video/participant metadata.

However:
- Developer Preview;
- Cloud project + OAuth principal + all conference participants must be enrolled.

Do not make this an MVP dependency.

Source:
https://developers.google.com/workspace/meet/media-api/guides/overview

## 12. Zoom: useful, but not free RTMS

Zoom RTMS provides:
- live audio;
- live transcript;
- participant events;
- timestamps;
- participant-level media.

But Basic/free Zoom accounts do not support RTMS.

RTMS requires Developer Pack credits.

Sources:
https://developers.zoom.us/docs/rtms/meetings/
https://developers.zoom.us/docs/rtms/troubleshooting/

Infrastructure rule:

```text
Zoom Basic
  -> no RTMS

Zoom Developer Pack access
  -> RTMS possible
```

Treat any trial credits as temporary, not as a permanent infrastructure assumption.

# PART D — EXTERNAL ASR FALLBACK

## 13. When external ASR is allowed

Use external ASR only when:

### Case 1
No transcript/caption exists.

### Case 2
Transcript access is blocked by account/tenant settings.

### Case 3
Native transcript quality is insufficient.

Examples:
- missing speaker identity;
- broken names;
- corrupted dates/numbers;
- poor Hinglish handling.

### Case 4
Realtime raw audio is required and the meeting platform does not provide a useful realtime transcript.

## 14. Cheapest useful ASR candidates

### Sarvam STT
- ₹30/hour standard;
- ₹45/hour with diarization;
- ₹100 signup credits;
- Indian-language + code-mix support.

Source:
https://docs.sarvam.ai/api/getting-started/pricing

### OpenRouter Whisper Large V3 Turbo
- $0.000003/second;
- about $0.0054 for 30 minutes;
- about $0.0108 for 1 hour.

Source:
https://openrouter.ai/openai/whisper-large-v3-turbo

### OpenRouter Qwen3 ASR 0.6B
- $0.000003/second;
- multilingual;
- segment + word timestamps.

Source:
https://openrouter.ai/qwen/qwen3-asr-0.6b

### OpenRouter MAI-Transcribe 2
- $0.10/hour;
- 60 languages;
- code switching;
- speaker diarization.

Source:
https://openrouter.ai/microsoft/mai-transcribe-2

## 15. ASR interface

```python
class ASRProvider:
    async def transcribe(self, audio) -> "Transcript":
        ...
```

Implement provider adapters:

```text
ASRProvider
  ├── SarvamASR
  ├── OpenRouterWhisper
  ├── OpenRouterQwen
  └── FutureASR
```

The rest of the application should only consume the canonical transcript.

# PART E — REALTIME VS POST-MEETING

## 16. Post-meeting mode — REQUIRED MVP

```text
Meeting
   ↓
native transcript / uploaded transcript
   ↓
canonical transcript
   ↓
LLM extraction
   ↓
human review
   ↓
task board
   ↓
notification queue
```

Benefits:
- lowest cost;
- easiest privacy model;
- no continuous audio processing;
- easiest testing;
- no realtime infrastructure dependency.

## 17. Realtime mode — LATER

```text
Meeting
   ↓
native realtime caption/transcript
        OR
raw audio → ASR
   ↓
canonical transcript stream
   ↓
LLM
   ↓
provisional action
   ↓
human review
```

Realtime actions should remain provisional until review.

# PART F — EMAIL

## 18. Resend

Current free plan:
- 3,000 emails/month;
- 100 emails/day;
- 3 domains.

Source:
https://resend.com/pricing

Use for MVP deadline notifications.

Domain authentication should use appropriate SPF/DKIM/DMARC configuration.

Source:
https://resend.com/docs/knowledge-base/what-are-spf-dkim-dmarc

## 19. Other email providers

### Postmark
Free Developer allowance is much smaller.

Source:
https://postmarkapp.com/pricing

### SendGrid
Current trial is limited and time-bound.

Source:
https://sendgrid.com/en-us/pricing

### AWS SES
Starts in sandbox; production access requires the relevant AWS process.

Source:
https://aws.amazon.com/ses/pricing/
https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html

For this project:
**Resend is the most practical student MVP option.**

# PART G — NOTIFICATION QUEUE

## 20. Retry requirement

The Team Hub requires failed notification delivery to be retried:
- 30 seconds;
- 2 minutes;
- 10 minutes;
- then marked failed.

Store:

```text
notifications
notification_attempts
```

Suggested fields:

```text
notification_id
channel
provider
attempt_number
status
provider_message_id
error_code
error_message
next_attempt_at
created_at
```

## 21. Idempotency

Use:

```text
notification_id + channel + event_type
```

as the application-level idempotency key.

Without idempotency:
```text
provider accepts message
        ↓
network timeout
        ↓
app retries
        ↓
recipient receives duplicate
```

# PART H — WHATSAPP

## 22. Student MVP

Separate two goals.

### Goal A — WhatsApp-style product UI
Free.

### Goal B — Actual WhatsApp transport
Use Twilio WhatsApp Sandbox only for testing.

Source:
https://www.twilio.com/docs/whatsapp/sandbox

Current production pricing depends on Twilio fees plus Meta WhatsApp pricing, so do not hard-code a permanent cost.

Source:
https://www.twilio.com/en-us/whatsapp/pricing

Architecture:

```python
class NotificationChannel:
    async def send(self, recipient, message, metadata):
        ...
```

Implement:
```text
InAppChannel
EmailChannel
WhatsAppChannel
```

# PART I — SECURITY / DATA

## 23. Secrets

Never store provider tokens in:
- frontend localStorage;
- source code;
- committed `.env`;
- ordinary logs.

Keep them server-side.

## 24. Retention

Support:
- transcript retention;
- action-item retention;
- audit-log retention;
- deletion state.

Suggested state:

```text
active
pending_deletion
deleted
legal_hold
```

## 25. Transcript privacy

Do not log raw transcripts.

Prefer:

```python
logger.info(
    "transcript_processed",
    extra={
        "meeting_id": meeting_id,
        "provider": provider,
        "duration_ms": duration_ms,
    },
)
```

# PART J — DPDP / GDPR

## 26. DPDP

Build engineering controls now:
- consent record;
- purpose limitation metadata;
- correction/deletion flow;
- retention controls;
- breach response;
- processor inventory.

The exact legal effective date of each obligation must be checked against the Government's staged commencement framework.

Source:
https://www.meity.gov.in/data-protection-framework

## 27. Cross-border transfer

Do not encode a blanket “all data must stay in India” assumption without checking:
- applicable law;
- customer contract;
- specific notification;
- processor arrangement.

# PART K — FINAL FREE/STUDENT ARCHITECTURE

## 28. Recommended stack

```text
                         Next.js
                           |
                         Vercel
                           |
                         FastAPI
                           |
                         Render
                           |
                  Supabase Postgres/Auth
                           |
              +------------+------------+
              |                         |
              v                         v
       Transcript Sources          LLM Adapter
       / native transcripts/        / Gemini
       / uploaded transcript       / Sarvam
       / captions                  / DeepSeek
              |                         |
              +------------+------------+
                           |
                    Canonical Transcript
                           |
                      Human Review
                           |
                       Task Board
                           |
                   Notification Queue
                     /             \
                  Email          WhatsApp
```

Fallback:

```text
No usable native transcript
           ↓
       Audio source
           ↓
      ASR Provider
     /           \
 Sarvam       OpenRouter
```

## 29. Provider interfaces

```text
TranscriptSource
  ├── UploadedTranscript
  ├── TeamsTranscript
  ├── GoogleMeetTranscript
  └── ZoomTranscript

ASRProvider
  ├── SarvamASR
  ├── OpenRouterWhisper
  ├── OpenRouterQwen
  └── FutureASR

LLMProvider
  ├── Gemini
  ├── Sarvam
  └── DeepSeek

NotificationChannel
  ├── InApp
  ├── Email
  └── WhatsApp

TaskDestination
  ├── InternalBoard
  ├── Linear
  ├── Jira
  ├── Asana
  └── Notion
```

## 30. Final priority for this project

### Priority 1
Make transcript ingestion work.

### Priority 2
Use platform-native transcripts/captions.

### Priority 3
Connect the LLM extraction/review/task pipeline.

### Priority 4
Use external ASR only where native text is unavailable or inadequate.

### Priority 5
Add realtime media capture.

This order keeps the student MVP inside free/near-free infrastructure for as long as possible.

# Sources

- G-10 Team Hub: https://www.notion.so/G-10-IT314-Team-Hub-1666e879513483b0be7881b1b3ccff07
- Vercel pricing: https://vercel.com/pricing
- Render pricing: https://render.com/pricing
- Railway pricing: https://railway.com/pricing
- Supabase pricing: https://supabase.com/pricing
- Neon pricing: https://neon.tech/pricing
- Microsoft Teams API licensing/evaluation: https://learn.microsoft.com/en-ca/graph/teams-licenses
- Microsoft Teams transcripts: https://learn.microsoft.com/en-us/graph/api/onlinemeeting-list-transcripts
- Microsoft callTranscript: https://learn.microsoft.com/en-us/graph/api/calltranscript-get
- Google Meet transcript entries: https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.transcripts.entries
- Google Meet transcript availability: https://support.google.com/meet/answer/12849897
- Google Meet Media API: https://developers.google.com/workspace/meet/media-api/guides/overview
- Zoom RTMS: https://developers.zoom.us/docs/rtms/meetings/
- Zoom RTMS troubleshooting: https://developers.zoom.us/docs/rtms/troubleshooting/
- Sarvam pricing: https://docs.sarvam.ai/api/getting-started/pricing
- OpenRouter Whisper Large V3 Turbo: https://openrouter.ai/openai/whisper-large-v3-turbo
- OpenRouter Qwen3 ASR 0.6B: https://openrouter.ai/qwen/qwen3-asr-0.6b
- OpenRouter MAI-Transcribe 2: https://openrouter.ai/microsoft/mai-transcribe-2
- Resend pricing: https://resend.com/pricing
- Resend SPF/DKIM/DMARC: https://resend.com/docs/knowledge-base/what-are-spf-dkim-dmarc
- Postmark pricing: https://postmarkapp.com/pricing
- SendGrid pricing: https://sendgrid.com/en-us/pricing
- AWS SES pricing: https://aws.amazon.com/ses/pricing/
- Twilio WhatsApp Sandbox: https://www.twilio.com/docs/whatsapp/sandbox
- Twilio WhatsApp pricing: https://www.twilio.com/en-us/whatsapp/pricing
- India DPDP framework: https://www.meity.gov.in/data-protection-framework
