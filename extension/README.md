# ActionPulse - Browser Extension (Meeting Captions to Action AI)

A Manifest V3 Chrome Extension built specifically for **ActionPulse** to automate meeting transcripts directly from closed captions and parse them into actionable tasks for manager review.

---

## ⚡ Supported Platforms
- **Google Meet** (`meet.google.com`)
- **Zoom Web Client** (`*.zoom.us`)
- **Microsoft Teams Web** (`teams.microsoft.com`, `teams.live.com`)

---

## 🚀 Key Features

1. **Automatic Live Closed Caption Capture:**
   - Detects when the manager turns on Closed Captions (CC) in Meet, Zoom, or Teams.
   - Dynamically captures speaker names, spoken sentences, and timestamps using a non-intrusive `MutationObserver`.
   - Streaming text deduplication prevents duplicate transcript fragments.

2. **Manager-Only Ingestion & Sync:**
   - Designed exclusively for managers/organisers.
   - Syncs directly with target workspace (default: `00000000-0000-0000-0000-000000000002`).
   - Authenticated with workspace role validation.

3. **1-Click Upload & AI Task Generation:**
   - At the end of the meeting, 1 click on **"Upload & Generate AI Tasks"** uploads the transcript to the FastAPI backend (`/api/meetings/automation/extension-upload`).
   - The backend creates the meeting, stores full transcripts & millisecond segments in Supabase, and triggers AI extraction into `extracted_items` (`needs_review`).
   - Generates a 1-click link to open the **Manager Review Gate** (`/meetings/{meeting_id}/review`) on the ActionPulse website.

4. **Guaranteed Local Backup (`.VTT` / `.TXT`):**
   - In case of network downtime, server unavailability, or offline meetings, click **"Save Backup (.VTT)"** or **"Save (.TXT)"** to download the transcript file directly to your computer.

5. **ActionPulse Native Dark Theme:**
   - Deep obsidian background (`#060608`), surface elevations (`#0e0e14`), and vibrant indigo accents (`#6366f1`) matching the ActionPulse web application.

---

## 📦 How to Install in Chrome / Edge / Brave

1. Open your browser and go to `chrome://extensions/` (or `edge://extensions/`).
2. Turn **ON** the **"Developer mode"** toggle in the top-right corner.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the `extension/` directory inside this repository:
   ```
   AI-Powered-Meeting-to-Action-Converter/extension/
   ```
5. The **ActionPulse** extension icon will now appear in your browser toolbar! Pin it for quick access.

---

## 🎯 How to Use During a Meeting

1. Join any **Google Meet**, **Zoom**, or **Microsoft Teams** meeting in your browser.
2. Turn on **Closed Captions (CC)**:
   - **Google Meet:** Click the `CC` icon in the bottom bar (or press `c`).
   - **Zoom Web:** Click `Show Captions` in the controls bar.
   - **Teams Web:** Click `... More` -> `Language and speech` -> `Turn on live captions`.
3. Notice the subtle green badge: `ActionPulse: Recording Captions`.
4. Click the ActionPulse extension icon in your toolbar to see the live transcript feed, cue count, and meeting timer.
5. At the end of the meeting:
   - Click **"Upload & Generate AI Tasks"**.
   - Click the green **"Open Manager Review Gate ↗"** button to review, edit, approve, or reject extracted tasks and assign them to team members!
   - (Optional) Click **"Save Backup (.VTT)"** to keep a local copy on your disk.
