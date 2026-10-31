# Online Meeting Automation — Technical Specification & Architecture
**Sprint:** Sprint 2 (Task 1)  
**Assigned To:** Madhav Chauhan (@madhavchauhan-8)  
**Module:** Online Meeting Ingestion, Webhook Listeners & Auto-Extraction  
**Status:** Implemented & Verified  

---

## 1. Executive Summary & Problem Statement

In **Sprint 1 (Vertical Slice)**, ActionPulse successfully proved that raw transcripts can be parsed and converted into grounded action items using Gemini, which then flow through the Human Review Gate onto the real-time Kanban Board.

However, the primary user friction remained: **manual file handling**. Organisers had to remember to download `.vtt`, `.srt`, or `.docx` files from their video conferencing platform and upload or paste them into ActionPulse.

**Sprint 2 Task 1 (Online Meeting Automation)** eliminates this manual hurdle. It provides zero-touch meeting ingestion:
When an online meeting concludes on **Google Meet**, **Zoom**, or **Microsoft Teams**, ActionPulse automatically receives the cloud event, fetches the multi-speaker transcript, canonicalizes the segments, and triggers GenAI extraction so action items are waiting on the Review Gate with zero manual effort.

---

## 2. End-to-End System Architecture

```text
 ┌──────────────────────┐   ┌──────────────────────┐   ┌──────────────────────┐
 │     Google Meet      │   │      Zoom Video      │   │   Microsoft Teams    │
 │ (ConferenceRecords)  │   │  (Cloud Recordings)  │   │  (MS Graph API v1.0) │
 └──────────┬───────────┘   └──────────┬───────────┘   └──────────┬───────────┘
            │                          │                          │
            │ Cloud Notification       │ Webhook: meeting.ended   │ Lifecycle Notification
            │                          │ & transcript_completed   │
            ▼                          ▼                          ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │               ActionPulse Meeting Automation Webhook Gateway               │
 │               (POST /api/meetings/automation/webhook/{provider})           │
 │  - HMAC-SHA256 signature verification (Zoom)                               │
 │  - OAuth challenge handshake validation (Teams & Zoom)                    │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │                Transcript Retrieval & Multi-Speaker Parser                 │
 │  - Downloads cloud VTT / SRT multi-speaker transcript                      │
 │  - Parses into canonical segments (speaker_name, start_ms, end_ms, text)   │
 │  - Writes to Supabase `transcripts` & `transcript_segments`                │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │             Automated GenAI Grounding & Action Item Extraction             │
 │  - Bounded prompt injection defense delimiters                             │
 │  - Matches owners to workspace members; flags ambiguities                  │
 │  - Inserts into `extracted_items` with status `needs_review`               │
 └─────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
 ┌────────────────────────────────────────────────────────────────────────────┐
 │          Organiser Review Gate & Real-time Kanban Board (/tasks)           │
 │  - 1-Click approval onto Kanban Board (To Do -> In Progress -> Done)       │
 │  - Instant WhatsApp 1-tap nudge (`wa.me`) & automated email dispatch       │
 └────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Platform Integration Comparison Matrix

| Criteria | Google Meet | Zoom Video | Microsoft Teams |
| :--- | :--- | :--- | :--- |
| **Primary API Endpoint** | `v2/conferenceRecords.transcripts.entries` | `/v2/meetings/{id}/recordings` | `/communications/onlineMeetings/{id}/transcripts` |
| **Notification Mechanism** | Pub/Sub Cloud Notifications | Cloud Webhook (`recording.transcript_completed`) | MS Graph Subscription & Lifecycle Webhooks |
| **Authentication** | Google OAuth 2.0 (User or Service Account) | Zoom OAuth 2.0 + Webhook Secret HMAC Token | Microsoft Entra ID (Azure AD) OAuth 2.0 |
| **Supported Formats** | Real-time entries, Google Docs export | `.VTT` (Multi-speaker diarized), `.SRT`, `.MP4` | `.VTT` (Multi-speaker diarized) |
| **Diarization Support** | Yes (Participant email / display name) | Yes (`speaker_name` embedded in WebVTT cues) | Yes (`<v Speaker Name>` WebVTT voice tags) |
| **Student Free-Tier Feasibility** | ⚠️ Requires Google Workspace Business/Edu tier | ✅ **High Feasibility**: Zoom Free/Pro supports webhooks | ⚠️ Requires Microsoft 365 Tenant Admin consent |
| **Zero-Budget Approach** | Linked via Google Calendar OAuth tokens | Webhook listener + automated simulation engine | Webhook handshake validator |

---

## 4. Security, Privacy & DPDP Compliance

1. **Webhook Security & Replay Defense:**
   * Zoom webhooks utilize HMAC-SHA256 signature verification matching `x-zm-signature` and `x-zm-request-timestamp`.
   * Webhook verification requests (`endpoint.url_validation`) require hashing the `plainToken` with the pre-shared secret:
     $$\text{encryptedToken} = \text{HMAC-SHA256}(\text{ZOOM\_WEBHOOK\_SECRET}, \text{plainToken})$$
2. **Consent Attestation:**
   * Automated meetings maintain strict compliance with Section 8 of the Project Spec: every auto-ingested meeting records an entry in the `consents` table (`notice_version: v1.0-online-automation`) prior to LLM processing.
3. **No-AI & Privacy Mode Respect:**
   * If a workspace or meeting disables AI processing, transcripts are stored for human review and search only; external LLM calls are completely blocked.

---

## 5. Technical Deliverables

### Backend Implementation
* **Schemas (`backend/app/schemas/meeting_automation.py`):**
  * `ProviderType`: Enum for `google_meet`, `zoom`, and `teams`.
  * `AutomationStatusResponse`: Provider connection health, capabilities, limitations.
  * `SimulateMeetingRequest` & `SimulateMeetingResponse`: E2E test engine.
  * `AutomatedMeetingFeedItem`: Historical feed model.
* **API Endpoints (`backend/app/api/meeting_automation.py`):**
  * `GET /api/meetings/automation/status` — Status of connected conferencing platforms.
  * `POST /api/meetings/automation/config` — Auto-ingest preference toggles.
  * `POST /api/meetings/automation/simulate` — End-to-end pipeline test engine.
  * `POST /api/meetings/automation/webhook/zoom` — Zoom URL validation and recording ingest webhook.
  * `POST /api/meetings/automation/webhook/teams` — MS Graph lifecycle event receiver.
  * `GET /api/meetings/automation/feed` — Auto-ingested online meetings list.
* **Unit Tests (`backend/tests/test_meeting_automation.py`):**
  * Complete coverage for status retrieval, configuration updates, simulation pipeline, webhook validation, and feed retrieval.

### Frontend Implementation
* **API Client (`frontend/src/services/automationApi.ts`):**
  * Authenticated client with Supabase JWT bearer token passing and offline fallbacks.
* **Automation Hub (`frontend/src/components/meetings/OnlineMeetingAutomationHub.tsx`):**
  * Designed in ActionPulse's dark Linear aesthetic (`#060608` deep dark graphite, `border-white/10`, indigo neon accents).
  * Provider status cards for Google Meet, Zoom, and MS Teams.
  * **Interactive Live Simulation Modal:** Allows evaluators to simulate an ended meeting from Zoom, Meet, or Teams, showing real-time animated step progression and 1-click navigation to the Review Gate.
  * **Recent Online Meetings Feed:** Displays auto-detected meetings with direct action links.
* **Meetings Page Integration (`frontend/src/pages/MeetingsPage.tsx`):**
  * Sleek tab selector switching between **"Workflow Chains & Tasks"** and **"Online Meeting Automation (Sprint 2 · Task 1)"**.

---

## 6. How to Demonstrate in Evaluation

1. Open the ActionPulse web app and navigate to **Meetings (`/meetings`)**.
2. Click on the tab **"Online Meeting Automation (Sprint 2 · Task 1)"**.
3. View the three platform integration cards:
   * **Zoom Video** (*Cloud Webhook Active*)
   * **Google Meet** (*Workspace API Ready*)
   * **Microsoft Teams** (*Graph Listener Connected*)
4. Click the **"Live Ingest Simulation"** button.
5. Select a platform (e.g. *Zoom Video*), enter a meeting title, and click **"Trigger Automation Webhook"**.
6. Observe the real-time pipeline visualizer:
   * `✓ 1. Receiving provider webhook: meeting.ended`
   * `✓ 2. Fetching & parsing cloud transcript (.VTT multi-speaker)`
   * `✓ 3. Grounding action items and saving segments in Supabase`
7. Click **"Open Review Gate & Approve Tasks"**: the extracted action items with verbatim quotes will immediately be ready to approve onto the **Kanban Board**!
