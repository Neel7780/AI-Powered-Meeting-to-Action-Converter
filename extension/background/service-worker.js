/**
 * ActionPulse - Chrome Service Worker (Manifest V3)
 * 
 * Manages transcript session state, caption buffers, local storage persistence,
 * automatic meeting start/end detection, and auto-upload on meeting end.
 */

const DEFAULT_SETTINGS = {
  apiUrl: "http://localhost:8000",
  appUrl: "http://localhost:5173",
  workspaceId: "",
  workspaceName: "",
  managerRole: "",
  accessToken: "",
  tokenExpiresAt: 0,
  userEmail: "",
  lastSyncedAt: 0,
  autoExtract: true,
  autoUploadOnEnd: true,
};

function sanitizeSettings(rawSettings) {
  const merged = { ...DEFAULT_SETTINGS, ...(rawSettings || {}) };
  // Clear legacy demo workspace placeholder if no real auth token was ever synced
  if (
    merged.workspaceId === "00000000-0000-0000-0000-000000000002" &&
    !merged.accessToken
  ) {
    merged.workspaceId = "";
    merged.managerRole = "";
  }
  return merged;
}

function createIdleSession() {
  return {
    id: "session_" + Date.now(),
    isRecording: false,
    isCompleted: false,
    uploaded: false,
    uploadResult: null,
    reviewUrl: null,
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
    uploaded: false,
    uploadResult: null,
    reviewUrl: null,
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

async function performBackendUpload(session, rawSettings) {
  const settings = sanitizeSettings(rawSettings);
  const cues = session.cues && session.cues.length > 0 ? session.cues : [];

  if (cues.length === 0) {
    throw new Error("No captions captured yet. Turn on Closed Captions (CC) in your meeting first.");
  }
  if (!settings.accessToken) {
    throw new Error("Not signed in. Open ActionPulse in Chrome and sign in as an Admin or Organiser to sync.");
  }
  if (settings.tokenExpiresAt && settings.tokenExpiresAt * 1000 < Date.now()) {
    throw new Error("ActionPulse login session expired. Open or refresh your ActionPulse tab to re-sync.");
  }
  if (!settings.workspaceId) {
    throw new Error("No active workspace synced. Select a workspace in ActionPulse first.");
  }

  const normalizedRole = String(settings.managerRole || "").toLowerCase();
  if (!["admin", "organiser"].includes(normalizedRole)) {
    throw new Error(
      `Manager access required: current role is "${normalizedRole || "none"}". Only Admin or Organiser can upload.`
    );
  }

  let durationMins = 1;
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

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errBody = await response.text();
    let detail = errBody;
    try {
      const parsed = JSON.parse(errBody);
      detail = parsed.detail || errBody;
    } catch {
      // keep raw text
    }
    throw new Error(`Server returned ${response.status}: ${detail}`);
  }

  const result = await response.json();
  const reviewFullUrl = `${settings.appUrl}${result.review_url}`;

  return {
    success: true,
    meetingId: result.meeting_id,
    reviewUrl: reviewFullUrl,
    relativeReviewUrl: result.review_url,
    segmentCount: result.segment_count,
    extractedItemsCount: result.extracted_items_count,
    message: result.message,
  };
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

// Watch tab closures to finalize and auto-upload
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const store = await chrome.storage.local.get(["session", "settings", "meetingTabId"]);
  if (store.meetingTabId === tabId && store.session && store.session.isRecording) {
    const session = store.session;
    const settings = store.settings || DEFAULT_SETTINGS;
    session.isRecording = false;
    session.isCompleted = true;
    session.endTime = new Date().toISOString();
    if (session.startTime) {
      session.durationSeconds = Math.max(0, Math.floor((new Date(session.endTime) - new Date(session.startTime)) / 1000));
    }

    if (session.cues && session.cues.length > 0 && !session.uploaded) {
      try {
        const uploadRes = await performBackendUpload(session, settings);
        session.uploaded = true;
        session.uploadResult = uploadRes;
        session.reviewUrl = uploadRes.reviewUrl;
        console.log("[ActionPulse] Auto-uploaded on tab close. Review URL:", uploadRes.reviewUrl);
      } catch (err) {
        console.warn("[ActionPulse] Auto-upload on tab close failed (cues preserved in local storage):", err);
      }
    }

    await chrome.storage.local.set({ session, meetingTabId: null });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const store = await chrome.storage.local.get(["session", "settings", "meetingTabId"]);
    let session = store.session || createIdleSession();
    let settings = sanitizeSettings(store.settings);

    switch (message.type) {
      case "GET_STATE": {
        sendResponse({
          session,
          settings: {
            ...settings,
            hasAccessToken: Boolean(settings.accessToken),
            accessToken: undefined,
          },
          cueCount: session.cues ? session.cues.length : 0,
        });
        break;
      }

      case "SYNC_AUTH_CONTEXT": {
        const data = message.data || {};
        settings = sanitizeSettings({
          ...settings,
          appUrl: data.appUrl || settings.appUrl,
          accessToken: data.accessToken || "",
          tokenExpiresAt: Number(data.tokenExpiresAt || 0),
          userEmail: data.userEmail || "",
          workspaceId: data.workspaceId || "",
          workspaceName: data.workspaceName || "",
          managerRole: data.managerRole || "",
          lastSyncedAt: Date.now(),
        });
        await chrome.storage.local.set({ settings });
        sendResponse({ status: "synced", hasAccessToken: Boolean(settings.accessToken) });
        break;
      }

      case "MEETING_STARTED": {
        const data = message.data || {};
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

          // Auto-trigger upload if captions are present
          if (session.cues && session.cues.length > 0 && !session.uploaded && settings.autoUploadOnEnd !== false) {
            try {
              const uploadRes = await performBackendUpload(session, settings);
              session.uploaded = true;
              session.uploadResult = uploadRes;
              session.reviewUrl = uploadRes.reviewUrl;
              console.log("[ActionPulse] Auto-upload on meeting ended succeeded! Review URL:", uploadRes.reviewUrl);
            } catch (uploadErr) {
              console.warn("[ActionPulse] Auto-upload on meeting end failed (cues preserved locally):", uploadErr);
            }
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

        if (!session.isRecording && !session.isCompleted) {
          session.isRecording = true;
          session.startTime = session.startTime || new Date().toISOString();
        }

        if (cue.platform && session.platform === "none") session.platform = cue.platform;
        if (cue.title && (!session.title || session.title === "Meeting")) session.title = cue.title;
        if (cue.conferenceUrl && !session.conferenceUrl) session.conferenceUrl = cue.conferenceUrl;

        const lastCue = session.cues[session.cues.length - 1];
        if (
          lastCue &&
          lastCue.speaker === cue.speaker &&
          cue.text.startsWith(lastCue.text) &&
          cue.text.length > lastCue.text.length
        ) {
          lastCue.text = cue.text;
          lastCue.timestamp = cue.timestamp || new Date().toISOString();
        } else if (lastCue && lastCue.speaker === cue.speaker && lastCue.text === cue.text) {
          sendResponse({ status: "duplicate_ignored" });
          return;
        } else {
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
        settings = sanitizeSettings({ ...settings, ...message.data });
        await chrome.storage.local.set({ settings });
        sendResponse({ status: "settings_updated", settings });
        break;
      }

      case "UPLOAD_TO_BACKEND": {
        try {
          const uploadRes = await performBackendUpload(session, settings);
          session.uploaded = true;
          session.uploadResult = uploadRes;
          session.reviewUrl = uploadRes.reviewUrl;
          await chrome.storage.local.set({ session });
          sendResponse(uploadRes);
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
