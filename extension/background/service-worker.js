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

const CAPTION_TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;
const UI_NOISE_SPEAKERS = new Set([
  "language",
  "format_size",
  "settings",
  "circle",
  "more_vert",
  "arrow_drop_down",
  "expand_more",
  "expand_less",
  "close",
  "closed_caption",
  "subtitles",
  "font size",
  "font color",
]);
const UI_NOISE_TEXT_PATTERNS = [
  /\bformat_size\b/i,
  /open caption settings/i,
  /caption settings/i,
  /\bfont size\b/i,
  /\bfont color\b/i,
  /^(language|settings|circle|arrow_drop_down|expand_more|expand_less|closed_caption)$/i,
];

function isCaptionToolbarNoise(speaker, text) {
  const cleanSpeaker = String(speaker || "").replace(/\s+/g, " ").trim().toLowerCase();
  const cleanText = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleanText || cleanText.length < 2) return true;
  if (cleanSpeaker && UI_NOISE_SPEAKERS.has(cleanSpeaker)) return true;
  return UI_NOISE_TEXT_PATTERNS.some((p) => p.test(cleanText));
}

function tokenizeWords(text) {
  const matches = String(text || "").toLowerCase().match(CAPTION_TOKEN_RE);
  return matches || [];
}

function commonPrefixLength(a, b) {
  const limit = Math.min(a.length, b.length);
  let i = 0;
  while (i < limit && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLength(a, b, minStart = 0) {
  let i = a.length - 1;
  let j = b.length - 1;
  let count = 0;
  while (i >= minStart && j >= minStart && a[i] === b[j]) {
    count++;
    i--;
    j--;
  }
  return count;
}

function stripLeadingWords(text, wordCount) {
  if (wordCount <= 0) return text;
  const matches = Array.from(String(text || "").matchAll(CAPTION_TOKEN_RE));
  if (wordCount >= matches.length) return "";
  const cutEnd = matches[wordCount - 1].index + matches[wordCount - 1][0].length;
  return String(text || "")
    .slice(cutEnd)
    .replace(/^[\s.,!?;:…—-]+/, "")
    .trim();
}

function mergeOrAppendCue(cues, incomingCue) {
  const speaker = String(incomingCue?.speaker || "You").replace(/\s+/g, " ").trim() || "You";
  const text = String(incomingCue?.text || "").replace(/\s+/g, " ").trim();
  if (isCaptionToolbarNoise(speaker, text)) return "noise_ignored";

  const incomingTs = incomingCue?.timestamp || new Date().toISOString();
  const incomingMs = Date.parse(incomingTs);

  // Check only the most recent 2 cues to fix progressive STT edits without ever touching earlier distinct topics
  let targetCue = null;
  const searchFloor = Math.max(0, cues.length - 2);
  for (let i = cues.length - 1; i >= searchFloor; i--) {
    const candidate = cues[i];
    if (candidate.speaker !== speaker) continue;
    const candidateMs = Date.parse(candidate.timestamp || "");
    if (!Number.isFinite(incomingMs) || !Number.isFinite(candidateMs) || Math.abs(incomingMs - candidateMs) <= 30000) {
      targetCue = candidate;
      break;
    }
  }

  if (targetCue) {
    const prevText = targetCue.text || "";
    const prevWords = tokenizeWords(prevText);
    const newWords = tokenizeWords(text);
    if (newWords.length === 0) return "empty";

    const lcp = commonPrefixLength(prevWords, newWords);

    // 1. Identical words (punctuation/casing revision only)
    if (lcp === prevWords.length && prevWords.length === newWords.length) {
      if (text.length >= prevText.length) {
        targetCue.text = text;
        targetCue.timestamp = incomingTs;
        return "updated_revision";
      }
      return "duplicate_ignored";
    }

    // 2. Truncated stale prefix of what we already captured
    if (lcp === newWords.length && newWords.length < prevWords.length) {
      return "duplicate_ignored";
    }

    // 3. Progressive expansion or minor STT edit on the same ongoing utterance
    const lcs = commonSuffixLength(prevWords, newWords, lcp);
    const isSameUtteranceRevision =
      lcp === prevWords.length ||
      (prevWords.length >= 5 && lcp >= Math.ceil(prevWords.length * 0.7) && newWords.length >= prevWords.length - 2) ||
      (prevWords.length >= 6 && newWords.length >= prevWords.length - 2 && lcp + lcs >= prevWords.length - 2);

    if (isSameUtteranceRevision) {
      targetCue.text = text;
      targetCue.timestamp = incomingTs;
      return "updated_revision";
    }

    // 4. Rolling caption window: trim suffix-of-prev overlapping with prefix-of-new
    const maxOverlap = Math.min(prevWords.length, newWords.length);
    for (let k = maxOverlap; k >= 2; k--) {
      const overlapSlice = prevWords.slice(-k).join(" ");
      if (k === 2 && overlapSlice.length < 10) continue;
      if (overlapSlice === newWords.slice(0, k).join(" ")) {
        const remainder = stripLeadingWords(text, k);
        if (!remainder || remainder.length < 2) return "duplicate_ignored";
        cues.push({ speaker, text: remainder, timestamp: incomingTs });
        return "stored_trimmed";
      }
    }
  }

  // 5. Distinct utterance / new topic by the same or another speaker: keep intact
  cues.push({ speaker, text, timestamp: incomingTs });
  return "stored";
}

function readPageAuthContext() {
  let accessToken = "";
  let tokenExpiresAt = 0;
  let userEmail = "";
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && /^sb-.*-auth-token$/.test(key)) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null");
        const session = parsed && parsed.currentSession ? parsed.currentSession : parsed;
        if (session && typeof session.access_token === "string") {
          accessToken = session.access_token;
          tokenExpiresAt = Number(session.expires_at || 0);
          userEmail = (session.user && session.user.email) || "";
          break;
        }
      } catch {
        // Ignore malformed entries
      }
    }
  }
  return {
    appUrl: window.location.origin,
    accessToken,
    tokenExpiresAt,
    userEmail,
    workspaceId: localStorage.getItem("currentWorkspaceId") || "",
    workspaceName: localStorage.getItem("currentWorkspaceName") || "",
    managerRole: localStorage.getItem("currentWorkspaceRole") || "",
  };
}

async function syncFromOpenActionPulseTabs(settings) {
  try {
    const patterns = [
      "http://localhost:5173/*",
      "http://127.0.0.1:5173/*",
      "https://*.vercel.app/*",
    ];
    if (settings.appUrl && /^https?:\/\//i.test(settings.appUrl)) {
      const cleanOrigin = settings.appUrl.replace(/\/+$/, "");
      if (!patterns.includes(`${cleanOrigin}/*`)) {
        patterns.push(`${cleanOrigin}/*`);
      }
    }

    const tabs = await chrome.tabs.query({ url: patterns });
    if (!tabs || tabs.length === 0) return settings;

    // Prefer active tab first so multi-tab users sync their focused ActionPulse tab
    const sortedTabs = [...tabs].sort((a, b) => Number(b.active) - Number(a.active));
    for (const tab of sortedTabs) {
      if (!tab.id || !chrome.scripting) continue;
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: readPageAuthContext,
        });
        const ctx = results && results[0] && results[0].result;
        if (ctx && (ctx.accessToken || ctx.workspaceId)) {
          const updated = sanitizeSettings({
            ...settings,
            appUrl: ctx.appUrl || settings.appUrl,
            accessToken: ctx.accessToken || "",
            tokenExpiresAt: Number(ctx.tokenExpiresAt || 0),
            userEmail: ctx.userEmail || "",
            workspaceId: ctx.workspaceId || "",
            workspaceName: ctx.workspaceName || "",
            managerRole: ctx.managerRole || "",
            lastSyncedAt: Date.now(),
          });
          await chrome.storage.local.set({ settings: updated });
          return updated;
        }
      } catch {
        // Skip tabs that cannot be scripted (e.g., unloading/restricted)
      }
    }
  } catch (err) {
    console.debug("[ActionPulse] Open tab auth sync skipped:", err);
  }
  return settings;
}

async function performBackendUpload(session, rawSettings) {
  let settings = sanitizeSettings(rawSettings);
  if (!settings.accessToken || !settings.workspaceId || !settings.managerRole) {
    settings = await syncFromOpenActionPulseTabs(settings);
  }
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
  const startTs = session.startTime ? new Date(session.startTime).getTime() : Date.now();
  const segmentsPayload = cues.map((c, i) => {
    const parsedCueTs = c.timestamp ? new Date(c.timestamp).getTime() : NaN;
    const cueTs = Number.isFinite(parsedCueTs) ? parsedCueTs : startTs + i * 5000;
    const startMs = Math.max(0, cueTs - startTs);
    const nextCue = cues[i + 1];
    const parsedNextTs = nextCue && nextCue.timestamp ? new Date(nextCue.timestamp).getTime() : NaN;
    const endMs = Number.isFinite(parsedNextTs)
      ? Math.max(startMs + 1000, parsedNextTs - startTs)
      : startMs + 5000;
    return {
      speaker: c.speaker,
      text: c.text,
      timestamp: c.timestamp,
      start_ms: startMs,
      end_ms: endMs,
    };
  });

  const payload = {
    workspace_id: settings.workspaceId,
    provider: session.platform && session.platform !== "none" ? session.platform : "google_meet",
    title: session.title || "Online Meeting Transcript",
    conference_url: session.conferenceUrl || null,
    duration_minutes: durationMins,
    transcript_text: vttText,
    segments: segmentsPayload,
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
        const isStale = !settings.lastSyncedAt || Date.now() - settings.lastSyncedAt > 4000;
        if (!settings.accessToken || !settings.workspaceId || !settings.managerRole || isStale) {
          settings = await syncFromOpenActionPulseTabs(settings);
        }
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

        const mergeResult = mergeOrAppendCue(session.cues, cue);
        if (mergeResult === "duplicate_ignored" || mergeResult === "noise_ignored" || mergeResult === "empty") {
          sendResponse({ status: mergeResult, total: session.cues.length });
          return;
        }

        await chrome.storage.local.set({ session });
        sendResponse({ status: mergeResult, total: session.cues.length });
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
