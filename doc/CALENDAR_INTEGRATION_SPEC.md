# Calendar Integration Specification & Implementation Report

**Project:** ActionPulse (AI-Powered Meeting-to-Action Converter)  
**Course:** IT314 – Software Engineering (SCRUM / Agile)  
**Task:** 4. Calendar Integration  
**Assignee:** Arnav Pandita  
**Date:** 27 October 2026  
**Status:** Complete (Implemented & Documented)

---

## 1. Executive Summary

This specification documents the completed integration between **ActionPulse** and external calendar providers (**Google Calendar API v3**), scoped strictly within our **zero-budget, free-tier** architecture.

The integration enables users to:
1. Authenticate with Google via OAuth 2.0 with minimal read-only permissions.
2. View upcoming calendar events with meeting titles, times, attendee counts, and video call links.
3. Import calendar events into ActionPulse with 1 click, automatically mapping attendees to workspace members and preserving calendar linkage.
4. Receive pre-meeting email reminders and automatic post-meeting transcript nudges to ensure meeting commitments are converted into tasks.

---

## 2. Exploration of Calendar API Options & Authentication

We evaluated three potential calendar integration pathways:

| Feature / Criteria | Google Calendar API v3 (Chosen) | Microsoft Graph (Outlook/Teams) | ICS / CalDAV Webcal Feed |
| :--- | :--- | :--- | :--- |
| **Primary User Base** | Student clubs, agile squads, college teams using Google Workspace / Gmail. | University enterprise accounts using Microsoft 365. | Generic calendar clients (Apple Calendar, Thunderbird). |
| **Authentication** | Standard OAuth 2.0 (Google Cloud Console, free). | Microsoft Entra ID (requires tenant admin consent). | No auth / public URL token feed. |
| **Permission Granularity** | Fine-grained read-only scope (`calendar.events.readonly`). | Broad (`Calendars.Read`). | All-or-nothing calendar exposure. |
| **Meeting Link Detection** | Native `conferenceData` (Google Meet) + location/description regex. | Native `onlineMeeting.joinUrl` (Teams). | Text regex parsing only. |
| **Zero-Budget Feasibility** | **High (Free tier: 1M queries/day)**. Immediate implementation. | Medium (high configuration barriers for student teams). | High (simple but lacks interactive import & writeback). |

### Authentication Architecture

To support headless background sync and decouple calendar identity from workspace login, we implemented a **backend-managed OAuth 2.0 authorization code flow**:

1. **Frontend Initiation:** User clicks *"Connect Google Calendar"* in `CalendarImportPicker.tsx`.
2. **Signed State Parameter:** The backend generates an HMAC-SHA256 signed `state` token encoding the `user_id` and `workspace_id` with a 15-minute expiration timestamp to prevent CSRF attacks.
3. **Google Consent Screen:** Requests least-privilege scopes:
   - `https://www.googleapis.com/auth/calendar.events.readonly`
   - `https://www.googleapis.com/auth/userinfo.email`
4. **Token Exchange & Encryption:** The backend exchanges the authorization code for tokens, retrieves the account email, and encrypts the refresh token using SHA-256 derived keys before persisting it to `public.calendar_connections`.

---

## 3. Database Schema & Meeting Linkage

### Database Migration: `supabase/migrations/0003_calendar_integration.sql`
- **`calendar_connections` Table:** Stores user-level OAuth connections per workspace with encrypted refresh tokens, access tokens, and sync status under strict Row-Level Security (RLS).
- **Meeting Linkage:** Extended `public.meetings` with:
  - `calendar_event_id text`: ID of the upstream Google Calendar event.
  - `calendar_provider text`: e.g. `'google'`.
  - `conference_url text`: Extracted Google Meet, Zoom, or Teams video call link.
  - Index: `idx_meetings_calendar_event` on `(workspace_id, calendar_event_id)` for duplicate detection.

### Database Migration: `supabase/migrations/0004_meeting_notifications.sql`
- Extended `public.notification_event` enum to include `'meeting_reminder'` and `'meeting_transcript_nudge'`.
- Added `meeting_id` foreign key column to `public.notifications` for meeting-level audit and idempotency tracking.

---

## 4. Initial Calendar Workflow & UI Integration

```
[Connect Google Calendar]
           │
           ▼
[Upcoming Events Carousel] ────► Displays title, date/time, Meet link, & attendee count
           │
           ├─► If already imported: Displays "ActionPulse Meeting" badge with direct link
           │
           ▼
   [Click "Use Event"]
           │
           ▼
[Auto-Populated Meeting Form]
   • Meeting Title ← Google Calendar Event summary
   • Start Time & Timezone ← Event start dateTime & timezone
   • Participants ← Attendee emails automatically matched to workspace profiles
   • Linkage ← Attached calendar_event_id and conference_url
           │
           ▼
[Organiser Attestation & Submit] ──► Ready for Transcript Ingestion & AI Task Extraction
```

### UI Components Built:
- **`CalendarImportPicker.tsx` (`frontend/src/components/meetings/`):** Embeds seamlessly into `CreateMeeting.tsx`, showing connection state, upcoming schedule, and 1-click form pre-filling.
- **`CalendarCallback.tsx` (`frontend/src/pages/`):** Handles Google OAuth redirects with animated status feedback and returns users to meeting creation.
- **`calendarApi.ts` (`frontend/src/services/`):** Type-safe client API wrapper for all calendar endpoints.

---

## 5. Automated Transcript Retrieval & Task Extraction Pipeline

To ensure calendar events actively drive action item follow-through, two automated notification pipelines were implemented:

### Phase 1 (Built): Pre-Meeting Reminders & Post-Meeting Nudges
1. **Pre-Meeting Email Reminders (`send_meeting_reminder_email`):**
   - Scheduled hourly or on keep-alive tick (`POST /internal/tick`).
   - Notifies all registered participants of meetings starting within 60 minutes.
   - Includes localized meeting time and a direct "Join Video Call" button.
2. **Post-Meeting Transcript Nudges (`send_meeting_transcript_nudge_email`):**
   - Detects meetings that ended 15 minutes to 24 hours ago that remain in `status = 'draft'` with no uploaded transcripts.
   - Emails the meeting organiser with a direct CTA: *"Upload Transcript & Extract Tasks"*.
   - Uses unique idempotency keys (`meeting_transcript_nudge:email:{meeting_id}:{organiser_id}`) to ensure organisers are only nudged once per meeting.

### Phase 2 (Future Scope): Direct Google Drive Auto-Sync
- For Google Workspace Enterprise/Education accounts where Google Meet records and transcribes calls automatically into Google Drive:
- Scope: `https://www.googleapis.com/auth/drive.readonly`
- The backend polls the user's Drive folder for `.vtt` transcripts matching the meeting date and title, transfers the file directly to Supabase Storage (`meeting-transcripts/{workspace_id}/{meeting_id}/{filename}`), and triggers extraction automatically.

---

## 6. Permissions, Security, and Limitations

### OAuth Scopes
| Scope | Purpose | Sensitivity | Justification |
| :--- | :--- | :--- | :--- |
| `calendar.events.readonly` | Read event titles, times, attendees, and Meet links. | Sensitive | Least-privilege read-only access. Cannot modify or delete calendar events. |
| `userinfo.email` | Display connected account email in UI. | Non-sensitive | Identity verification. |

### Technical Limitations & Mitigations
1. **Google OAuth "Testing" Mode:**
   - In unverified development mode, Google limits OAuth access to 100 test user accounts added in the Google Cloud Console. This is sufficient for course development, testing, and grading.
2. **Render Free Tier Ephemeral Webhooks:**
   - Real-time Google Calendar webhooks (Push Notifications) require a persistently listening HTTPS server with a verified domain. Render Free sleeps after 15 minutes of inactivity.
   - **Mitigation:** We implemented an on-demand polling model triggered whenever a user opens the calendar view or dashboard, avoiding dropped webhooks.
3. **Personal Gmail vs Google Workspace Transcripts:**
   - Native Google Meet automatic transcript exports are restricted by Google to Workspace Business/Education editions. Personal `@gmail.com` accounts do not generate automated transcripts.
   - **Mitigation:** The post-meeting nudge directs organisers to the manual transcript upload / paste workflow.

---

## 7. Deliverables Checklist

| Requirement | Status | Relevant Files |
| :--- | :--- | :--- |
| **API exploration & auth** | **Done** | `doc/CALENDAR_INTEGRATION_SPEC.md`, `backend/app/services/calendar.py` |
| **Display upcoming meetings** | **Done** | `backend/app/api/calendar.py`, `frontend/src/components/meetings/CalendarImportPicker.tsx` |
| **Link calendar events to records**| **Done** | `supabase/migrations/0003_calendar_integration.sql`, `backend/app/api/meetings.py`, `CreateMeeting.tsx` |
| **Trigger transcript extraction** | **Done** | `supabase/migrations/0004_meeting_notifications.sql`, `backend/app/services/email.py`, `internal.py` |
| **Permissions & limitations** | **Done** | §6 of this document |
| **Automated test suite** | **Done** | `backend/tests/test_calendar.py`, `backend/tests/test_email.py`, `backend/tests/test_internal.py` |
