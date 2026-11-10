/**
 * ActionPulse - Chrome Service Worker (Manifest V3)
 * 
 * Manages transcript session state, caption buffers, local storage persistence,
 * automatic meeting start/end detection, and 1-click upload to the ActionPulse backend.
 */

const DEFAULT_SETTINGS = {
  apiUrl: "http://localhost:8000",
  appUrl: "http://localhost:5173",
  workspaceId: "00000000-0000-0000-0000-000000000002", // G-10 Workspace
  managerRole: "organiser",
  autoExtract: true,
};

function createIdleSession() {
  return {
    id: "session_" + Date.now(),
    isRecording: false,
    isCompleted: false,
    platform: "none",
    title: "",
    conferenceUrl: "",
    startTime: null,
    endTime: null,
    durationSeconds: 0,
    cues: [],
  };
}

function createNewSession(platform = "google_meet", title = "Meeting", conferenceUrl = "") {
  return {
    id: "session_" + Date.now(),
    isRecording: true,
    isCompleted: false,
    platform: platform,
    title: title || "Meeting",
    conferenceUrl: conferenceUrl || "",
    startTime: new Date().toISOString(),
    endTime: null,
    durationSeconds: 0,
    cues: [],
  };
}

function formatMsToVtt(ms) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;
  return (
    String(hours).padStart(2, "0") +
    ":" +
    String(minutes).padStart(2, "0") +
    ":" +
    String(seconds).padStart(2, "0") +
    "." +
    String(millis).padStart(3, "0")
  );
}

function buildVttTranscript(cues, sessionStartTime) {
  let vtt = "WEBVTT - ActionPulse Captions Ingestion\n\n";
  const startTs = sessionStartTime ? new Date(sessionStartTime).getTime() : Date.now();

  cues.forEach((cue, index) => {
    const cueTs = cue.timestamp ? new Date(cue.timestamp).getTime() : startTs + index * 5000;
    const startMs = Math.max(0, cueTs - startTs);
    const endMs = startMs + 4000;

    const startVtt = formatMsToVtt(startMs);
    const endVtt = formatMsToVtt(endMs);
    const speaker = cue.speaker || "Speaker";

    vtt += `${index + 1}\n${startVtt} --> ${endVtt}\n<v ${speaker}>${cue.text}\n\n`;
  });

  return vtt;
}

function buildCanonicalText(cues) {
  return cues.map((c) => `${c.speaker || "Speaker"}: ${c.text}`).join("\n");
}

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(["settings", "session"]);
  if (!current.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  if (!current.session) {
    await chrome.storage.local.set({ session: createIdleSession() });
  }
  console.log("[ActionPulse] Service worker initialized.");
});

// Watch tab updates / removals to stop session when user closes meeting tab
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const store = await chrome.storage.local.get(["session", "meetingTabId"]);
  if (store.meetingTabId === tabId && store.session && store.session.isRecording) {
    const session = store.session;
    session.isRecording = false;
    session.isCompleted = true;
    session.endTime = new Date().toISOString();
    if (session.startTime) {
      session.durationSeconds = Math.max(0, Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000));
    }
    await chrome.storage.local.set({ session, meetingTabId: null });
    console.log("[ActionPulse] Meeting tab closed, session finalized.");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const store = await chrome.storage.local.get(["session", "settings", "meetingTabId"]);
    let session = store.session || createIdleSession();
    let settings = store.settings || DEFAULT_SETTINGS;

    switch (message.type) {
      case "GET_STATE": {
        sendResponse({
          session,
          settings,
          cueCount: session.cues ? session.cues.length : 0,
        });
        break;
      }

      case "MEETING_STARTED": {
        const data = message.data || {};
        // If not already in an active recording session, start one
        if (!session.isRecording || session.isCompleted) {
          session = createNewSession(data.platform, data.title, data.conferenceUrl);
        } else {
          if (data.title) session.title = data.title;
          if (data.conferenceUrl) session.conferenceUrl = data.conferenceUrl;
          if (data.platform) session.platform = data.platform;
        }

        const tabId = sender.tab ? sender.tab.id : null;
        await chrome.storage.local.set({ session, meetingTabId: tabId });
        sendResponse({ status: "started", session });
        break;
      }

      case "MEETING_ENDED": {
        if (session && session.isRecording) {
          session.isRecording = false;
          session.isCompleted = true;
          session.endTime = new Date().toISOString();
          if (session.startTime) {
            session.durationSeconds = Math.max(
              0,
              Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000)
            );
          }
          await chrome.storage.local.set({ session, meetingTabId: null });
        }
        sendResponse({ status: "ended", session });
        break;
      }

      case "CAPTION_CUE": {
        const cue = message.data;
        if (!cue || !cue.text) {
          sendResponse({ status: "empty" });
          return;
        }

        // Auto-activate session if not active
        if (!session.isRecording && !session.isCompleted) {
          session.isRecording = true;
          session.startTime = session.startTime || new Date().toISOString();
        }

        if (cue.platform && session.platform === "none") session.platform = cue.platform;
        if (cue.title && (!session.title || session.title === "Meeting")) session.title = cue.title;
        if (cue.conferenceUrl && !session.conferenceUrl) session.conferenceUrl = cue.conferenceUrl;

        // Check if last cue from same speaker should be updated with longer text
        const lastCue = session.cues[session.cues.length - 1];
        if (
          lastCue &&
          lastCue.speaker === cue.speaker &&
          cue.text.startsWith(lastCue.text) &&
          cue.text.length > lastCue.text.length
        ) {
          // Streaming extension: update in-place with latest full phrase
          lastCue.text = cue.text;
          lastCue.timestamp = cue.timestamp || new Date().toISOString();
        } else if (lastCue && lastCue.speaker === cue.speaker && lastCue.text === cue.text) {
          // Exact duplicate, ignore
          sendResponse({ status: "duplicate_ignored" });
          return;
        } else {
          // New distinct cue
          session.cues.push({
            speaker: cue.speaker || "You",
            text: cue.text,
            timestamp: cue.timestamp || new Date().toISOString(),
          });
        }

        await chrome.storage.local.set({ session });
        sendResponse({ status: "stored", total: session.cues.length });
        break;
      }

      case "CLEAR_BUFFER": {
        session = createIdleSession();
        await chrome.storage.local.set({ session });
        sendResponse({ status: "cleared", session });
        break;
      }

      case "UPDATE_SETTINGS": {
        settings = { ...settings, ...message.data };
        await chrome.storage.local.set({ settings });
        sendResponse({ status: "settings_updated", settings });
        break;
      }

      case "UPLOAD_TO_BACKEND": {
        const cues = session.cues && session.cues.length > 0 ? session.cues : [
          { speaker: "Organiser", text: "Meeting concluded with agreed action items.", timestamp: new Date().toISOString() }
        ];

        let durationMins = 15;
        if (session.startTime) {
          const endTs = session.endTime ? new Date(session.endTime).getTime() : Date.now();
          durationMins = Math.max(1, Math.round((endTs - new Date(session.startTime).getTime()) / 60000));
        }

        const vttText = buildVttTranscript(cues, session.startTime);

        const payload = {
          workspace_id: settings.workspaceId,
          provider: session.platform && session.platform !== "none" ? session.platform : "google_meet",
          title: session.title || "Online Meeting Transcript",
          conference_url: session.conferenceUrl || null,
          duration_minutes: durationMins,
          transcript_text: vttText,
          segments: cues.map((c, i) => ({
            speaker: c.speaker,
            text: c.text,
            timestamp: c.timestamp,
            start_ms: i * 5000,
            end_ms: (i + 1) * 5000,
          })),
          auto_extract: settings.autoExtract !== false,
        };

        const targetUrl = `${settings.apiUrl}/api/meetings/automation/extension-upload`;
        console.log("[ActionPulse] Uploading meeting transcript to:", targetUrl);

        try {
          const response = await fetch(targetUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer dev-token-${settings.workspaceId}`,
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Server returned ${response.status}: ${errBody}`);
          }

          const result = await response.json();
          const reviewFullUrl = `${settings.appUrl}${result.review_url}`;

          sendResponse({
            success: true,
            meetingId: result.meeting_id,
            reviewUrl: reviewFullUrl,
            relativeReviewUrl: result.review_url,
            segmentCount: result.segment_count,
            extractedItemsCount: result.extracted_items_count,
            message: result.message,
          });
        } catch (uploadError) {
          console.error("[ActionPulse] Upload failed:", uploadError);
          sendResponse({
            success: false,
            error: uploadError.message || "Failed to reach backend server. Use Save Backup (.VTT) locally.",
          });
        }
        break;
      }

      case "GET_TRANSCRIPT_EXPORT": {
        const cues = session.cues || [];
        const vtt = buildVttTranscript(cues, session.startTime);
        const txt = buildCanonicalText(cues);
        sendResponse({
          vtt,
          txt,
          title: session.title || "meeting_transcript",
          cueCount: cues.length,
        });
        break;
      }

      default:
        sendResponse({ error: "Unknown message type: " + message.type });
    }
  })();

  return true;
});
