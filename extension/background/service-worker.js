importScripts("captions.js", "../shared/meeting.js");

const DEFAULT_CONNECTION = {
  apiUrl: "https://ai-powered-meeting-to-action-converter-9k2z.onrender.com",
  appUrl: "https://ai-powered-meeting-to-action-conver.vercel.app",
};
const EMPTY_AUTH = { accessToken: "", userId: "", userEmail: "", tokenExpiresAt: 0 };
const CAPTURE_PREFIX = "capture:";
const WATCH_ALARM = "capture-progress";
const operations = new Map();
let settingsQueue = Promise.resolve();

void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

async function getSettings() {
  const { settings } = await chrome.storage.local.get("settings");
  const connection = settings?.appUrlPinned === true ? parseConnection(settings) : null;
  return connection ? { ...EMPTY_AUTH, ...settings, ...connection } : { ...DEFAULT_CONNECTION, ...EMPTY_AUTH };
}

function updateSettings(update) {
  const result = settingsQueue.then(async () => {
    const current = await getSettings();
    const next = update(current);
    if (next) await chrome.storage.local.set({ settings: { ...next, appUrlPinned: true } });
    return next || current;
  });
  settingsQueue = result.catch(() => {});
  return result;
}

function accountIsCurrent(settings) {
  return Boolean(settings.accessToken && settings.userId && settings.tokenExpiresAt > Date.now() / 1000 + 10);
}

async function getAuth(force = false) {
  const settings = await getSettings();
  if (!force && accountIsCurrent(settings)) return settings;
  const tabs = await chrome.tabs.query({ url: settings.appUrl + "/*" });
  let signedOut = false;
  for (const tab of tabs) {
    try {
      let data;
      try {
        data = await chrome.tabs.sendMessage(tab.id, { type: "READ_ACTIONPULSE_AUTH" });
      } catch {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content/actionpulse-sync.js"] });
        data = await chrome.tabs.sendMessage(tab.id, { type: "READ_ACTIONPULSE_AUTH" });
      }
      if (data?.accessToken) return updateSettings((current) =>
        current.appUrl === settings.appUrl ? { ...current, ...readAuth(data) } : null);
      if (data) signedOut = true;
    } catch {
      // Tabs in the middle of navigation may not have an active content script.
    }
  }
  if (signedOut) return updateSettings((current) =>
    current.appUrl === settings.appUrl && current.accessToken === settings.accessToken
      ? { ...current, ...EMPTY_AUTH } : null);
  return getSettings();
}

function readAuth(data) {
  return {
    accessToken: String(data?.accessToken || ""),
    userId: String(data?.userId || ""),
    userEmail: String(data?.userEmail || ""),
    tokenExpiresAt: Number(data?.tokenExpiresAt || 0),
  };
}

function localOrHostedOrigin(value, hostingDomain) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    const loopback = ["localhost", "127.0.0.1"].includes(url.hostname);
    if (loopback && url.protocol === "http:") return url.origin;
    if (url.protocol === "https:" && url.hostname.endsWith(hostingDomain)) return url.origin;
  } catch { /* Invalid URL */ }
  return null;
}

function parseConnection(settings) {
  const appUrl = localOrHostedOrigin(settings.appUrl, ".vercel.app");
  const apiUrl = localOrHostedOrigin(settings.apiUrl, ".onrender.com");
  return appUrl && apiUrl ? { appUrl, apiUrl } : null;
}

async function api(path, settings, body) {
  if (!accountIsCurrent(settings)) throw Object.assign(new Error("Sign in to ActionPulse in this browser, then try again."), { status: 401 });
  let response;
  try {
    response = await fetch(settings.apiUrl + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${settings.accessToken}`, ...(body && { "Content-Type": "application/json" }) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(24000),
    });
  } catch {
    throw new Error("Could not reach ActionPulse. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 401 ? "Your ActionPulse session expired. Sign in again to continue."
      : response.status === 404 && path.endsWith("extension-workspaces")
        ? "This ActionPulse backend does not support live capture yet."
        : typeof data?.detail === "string" ? data.detail : "ActionPulse could not complete the request. Try again.";
    throw Object.assign(new Error(message), { status: response.status });
  }
  if (!data) throw new Error("ActionPulse returned an unexpected response.");
  return data;
}

function withOperation(key, action) {
  const previous = operations.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(action);
  operations.set(key, next);
  const cleanup = () => { if (operations.get(key) === next) operations.delete(key); };
  next.then(cleanup, cleanup);
  return next;
}

async function readCapture(id) {
  const key = CAPTURE_PREFIX + id;
  return (await chrome.storage.local.get(key))[key];
}

async function allCaptures() {
  if (!chrome.storage.local.getKeys) {
    const rows = Object.entries(await chrome.storage.local.get(null));
    return rows.filter(([key]) => key.startsWith(CAPTURE_PREFIX)).map(([, item]) => item);
  }
  const keys = (await chrome.storage.local.getKeys()).filter((key) => key.startsWith(CAPTURE_PREFIX));
  return Object.values(await chrome.storage.local.get(keys));
}

function sameAccount(capture, settings) {
  return capture.userId === settings.userId && capture.appUrl === settings.appUrl && capture.apiUrl === settings.apiUrl;
}

async function updateBadge() {
  const attention = (await allCaptures()).some((item) =>
    ["ready", "failed", "empty", "retry"].includes(item.phase) && !item.seen);
  await chrome.action.setBadgeBackgroundColor({ color: "#5142c4" });
  await chrome.action.setBadgeText({ text: attention ? "1" : "" });
}

function view(capture, appUrl) {
  return {
    id: capture.id, phase: capture.phase, platform: capture.platform, title: capture.title,
    workspaceName: capture.workspaceName, startedAt: capture.startedAt, endedAt: capture.endedAt,
    cueCount: capture.cues.length, error: capture.error,
    meetingUrl: appUrl && capture.meetingId ? `${appUrl}/meetings/${capture.meetingId}?tab=${capture.phase === "ready" || capture.phase === "processing" ? "review" : capture.phase === "empty" ? "transcript" : "overview"}` : null,
  };
}

async function saveCapture(capture, publish = true) {
  await chrome.storage.local.set({ [CAPTURE_PREFIX + capture.id]: capture });
  if (!publish) return;
  const state = view(capture, capture.appUrl);
  if (capture.tabId != null) {
    void chrome.tabs.sendMessage(capture.tabId, {
      type: "ACTIONPULSE_CAPTURE_STATE", callKey: capture.callKey, state,
    }).catch(() => {});
  }
  void updateBadge();
}

async function tabCapture(tabId, callKey, settings) {
  return (await allCaptures()).find((item) => item.tabId === tabId && item.callKey === callKey &&
    sameAccount(item, settings) && item.phase === "capturing");
}

function meetingSender(sender) {
  return sender.frameId === 0 && sender.tab && ActionPulseMeeting.identify(sender.url);
}

function offerKey(tabId) {
  return "offer:" + tabId;
}

async function getOffer(sender) {
  const call = meetingSender(sender);
  if (!call) return { kind: "ineligible" };
  let settings = await getSettings();
  let existing = await tabCapture(sender.tab.id, call.key, settings);
  if (existing) return { kind: "capture", state: view(existing, existing.appUrl) };
  const key = offerKey(sender.tab.id);
  if ((await chrome.storage.session.get(key))[key] === call.key) return { kind: "dismissed" };
  settings = await getAuth();
  if (!accountIsCurrent(settings)) return { kind: "sign-in" };
  let account;
  try {
    account = await api("/api/meetings/automation/extension-workspaces", settings);
  } catch (error) {
    if (error.status !== 401) throw error;
    settings = await getAuth(true);
    if (!accountIsCurrent(settings)) return { kind: "sign-in" };
    try {
      account = await api("/api/meetings/automation/extension-workspaces", settings);
    } catch (retried) {
      if (retried.status === 401) return { kind: "sign-in" };
      throw retried;
    }
  }
  if (account.user_id !== settings.userId) return { kind: "sign-in" };
  existing = await tabCapture(sender.tab.id, call.key, settings);
  if (existing) return { kind: "capture", state: view(existing, existing.appUrl) };
  return account.workspaces.length ? { kind: "offer", userId: account.user_id, workspaces: account.workspaces } : { kind: "ineligible" };
}

async function startCapture(sender, data) {
  const call = meetingSender(sender);
  if (!call || !data.attested || !ActionPulseMeeting.isId(data.id) || !ActionPulseMeeting.isId(data.workspaceId)) {
    throw new Error("Choose a workspace and confirm that you’ve informed participants.");
  }
  return withOperation("join:" + call.key, async () => {
    const settings = await getAuth(true);
    if (data.userId !== settings.userId) throw new Error("Your signed-in account changed. Reopen the meeting prompt.");
    const tab = await chrome.tabs.get(sender.tab.id).catch(() => null);
    if (ActionPulseMeeting.identify(tab?.url)?.key !== call.key) throw new Error("The call has already ended.");
    const prior = (await allCaptures()).find((item) => item.callKey === call.key &&
      item.workspaceId === data.workspaceId && sameAccount(item, settings) && item.phase === "capturing");
    if (prior) {
      if (prior.tabId !== sender.tab.id) throw new Error("This meeting is already being captured in another tab.");
      return view(prior, prior.appUrl);
    }
    const title = String(data.title || "").trim().slice(0, 300) || ActionPulseMeeting.names[call.platform] + " meeting";
    const result = await api("/api/meetings/automation/extension-capture", settings, {
      capture_id: data.id, workspace_id: data.workspaceId, provider: call.platform, title,
      conference_url: call.url, timezone: data.timezone || "UTC", ai_attestation: true,
    });
    if (!ActionPulseMeeting.isId(result.meeting_id)) throw new Error("ActionPulse did not return a meeting.");
    const capture = {
      id: data.id, meetingId: result.meeting_id, tabId: sender.tab.id, callKey: call.key,
      platform: call.platform, conferenceUrl: call.url, title: result.title,
      workspaceId: data.workspaceId, workspaceName: String(data.workspaceName || "").slice(0, 200),
      userId: settings.userId, appUrl: settings.appUrl, apiUrl: settings.apiUrl,
      phase: "capturing", startedAt: new Date().toISOString(), cues: [],
    };
    await saveCapture(capture);
    const currentTab = await chrome.tabs.get(sender.tab.id).catch(() => null);
    if (ActionPulseMeeting.identify(currentTab?.url)?.key !== call.key) void endCapture(capture.id);
    return view(capture, capture.appUrl);
  });
}

async function notify(capture) {
  if (capture.seen) return;
  const state = view(capture, capture.appUrl);
  const copy = ActionPulseMeeting.statusCopy(state);
  const settings = await getSettings();
  if (!sameAccount(capture, settings)) return;
  await chrome.notifications.create(capture.id, {
    type: "basic", iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
    title: copy.heading, message: capture.title + " · " + copy.description,
    buttons: [{ title: copy.action || "Open ActionPulse extension" }],
  }).catch(() => {});
}

async function upload(capture) {
  const settings = await getAuth(true);
  if (!sameAccount(capture, settings)) throw new Error("Sign in with the account and connection that started this capture.");
  const start = Date.parse(capture.startedAt);
  const segments = capture.cues.map((cue, index, cues) => {
    const startMs = Math.max(0, Date.parse(cue.timestamp) - start);
    const nextMs = Date.parse(cues[index + 1]?.timestamp) - start;
    return { ...cue, start_ms: startMs, end_ms: Number.isFinite(nextMs) ? Math.max(startMs + 1000, nextMs) : startMs + 4000 };
  });
  const result = await api("/api/meetings/automation/extension-upload", settings, {
    meeting_id: capture.meetingId, workspace_id: capture.workspaceId, provider: capture.platform,
    title: capture.title, conference_url: capture.conferenceUrl, segments, auto_extract: true,
    duration_minutes: Math.min(480, Math.max(1, Math.round((Date.parse(capture.endedAt) - start) / 60000))),
  });
  if (result.meeting_id !== capture.meetingId) throw new Error("The server did not confirm the saved meeting.");
  capture.phase = "processing";
  capture.error = "";
  capture.cues = [];
  await saveCapture(capture);
}

async function refreshProgress(capture) {
  const settings = await getAuth();
  if (!sameAccount(capture, settings) || !accountIsCurrent(settings)) return;
  const result = await api(`/api/meetings/automation/extension-capture/${capture.meetingId}?workspace_id=${capture.workspaceId}`, settings);
  if (result.status === "draft") {
    capture.phase = "failed";
    capture.error = "Open your meeting to check its transcript and start task extraction.";
    await saveCapture(capture);
    await notify(capture);
    return;
  }
  if (["ready", "failed"].includes(result.status)) {
    capture.phase = result.status;
    capture.seen = false;
    await saveCapture(capture);
    await notify(capture);
  }
}

async function updateCapture(id, action) {
  return withOperation(id, async () => {
    const capture = await readCapture(id);
    if (capture) return action(capture);
  });
}

async function uploadOrRetry(capture) {
  capture.phase = "uploading";
  capture.seen = false;
  await saveCapture(capture);
  try {
    await upload(capture);
    await refreshProgress(capture).catch(() => {});
  } catch (error) {
    capture.phase = "retry";
    capture.error = error.message;
    await saveCapture(capture);
    await notify(capture);
  }
}

function endCapture(id) {
  return updateCapture(id, async (capture) => {
    if (capture.phase !== "capturing") return;
    capture.endedAt = new Date().toISOString();
    if (capture.cues.length) await uploadOrRetry(capture);
    else {
      capture.phase = "empty";
      await saveCapture(capture);
      await notify(capture);
    }
  });
}

async function endTab(tabId, nextCallKey) {
  const active = (await allCaptures()).filter((item) =>
    item.tabId === tabId && item.phase === "capturing" && item.callKey !== nextCallKey);
  await Promise.all(active.map((item) => endCapture(item.id)));
}

async function recoverWork() {
  const captures = await allCaptures();
  await Promise.allSettled(captures.map(async (item) => {
    if (item.phase === "capturing") {
      const tab = await chrome.tabs.get(item.tabId).catch(() => null);
      if (ActionPulseMeeting.identify(tab?.url)?.key !== item.callKey) await endCapture(item.id);
    } else if (item.phase === "uploading" || item.phase === "processing") {
      await updateCapture(item.id, async (current) => {
        if (current.phase === "uploading") await uploadOrRetry(current);
        if (current.phase === "processing") await refreshProgress(current);
      });
    }
  }));
}

async function initialize() {
  await chrome.alarms.create(WATCH_ALARM, { periodInMinutes: 0.5 });
  // Preserve any unsent transcript from the previous extension version.
  const { session } = await chrome.storage.local.get("session");
  if (session) {
    if (session.cues?.length && !session.uploaded) {
      const settings = await getSettings();
      const id = crypto.randomUUID();
      await saveCapture({
        ...session, id, phase: "retry", tabId: null, startedAt: session.startTime, endedAt: session.endTime,
        ...Object.fromEntries(["appUrl", "apiUrl", "userId"].map((key) => [key, settings[key]])),
        error: "Download these captions and add them to your meeting in ActionPulse.",
      }, false);
    }
    await chrome.storage.local.remove(["session", "meetingTabId"]);
  }
  await updateBadge();
}

chrome.runtime.onInstalled.addListener(() => { void initialize(); });
chrome.runtime.onStartup.addListener(() => { void initialize().then(recoverWork); });
chrome.alarms.onAlarm.addListener(({ name }) => { if (name === WATCH_ALARM) void recoverWork(); });
chrome.tabs.onRemoved.addListener((tabId) => { void chrome.storage.session.remove(offerKey(tabId)); void endTab(tabId); });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.url) void endTab(tabId, ActionPulseMeeting.identify(change.url)?.key);
});

async function openCapture(id, tabId) {
  const settings = await getAuth();
  const item = await readCapture(id);
  if (!item || (!sameAccount(item, settings) && item.meetingId)) throw new Error("Sign in with the account that started this capture.");
  const { meetingUrl } = view(item, item.appUrl);
  if (!meetingUrl) return chrome.windows.create({ url: chrome.runtime.getURL("popup/popup.html"), type: "popup",
    width: 405, height: 530 });
  await chrome.tabs.create({ url: meetingUrl, ...(tabId != null && { openerTabId: tabId }) });
  await updateCapture(id, async (current) => { current.seen = true; await saveCapture(current, false); });
  await chrome.notifications.clear(id);
  void updateBadge();
}

chrome.notifications.onClicked.addListener((id) => { void openCapture(id).catch(() => {}); });
chrome.notifications.onButtonClicked.addListener((id) => { void openCapture(id).catch(() => {}); });

function isPopup(sender) {
  return sender.url === chrome.runtime.getURL("popup/popup.html");
}

async function openApp(openerTabId) {
  const { appUrl } = await getSettings();
  await chrome.tabs.create({ url: `${appUrl}/dashboard`, ...(openerTabId != null && { openerTabId }) });
  return {};
}

async function handle(message, sender) {
  const data = message.data || {};
  if (message.type === "SYNC_AUTH_CONTEXT") {
    await updateSettings((settings) => sender.frameId === 0 && sender.tab &&
      (sender.origin || new URL(sender.url).origin) === settings.appUrl ? { ...settings, ...readAuth(data) } : null);
    return {};
  }
  const call = meetingSender(sender);
  if (call) {
    const tabId = sender.tab.id;
    switch (message.type) {
      case "MEETING_JOINED": return getOffer(sender);
      case "DISMISS_OFFER":
        await chrome.storage.session.set({ [offerKey(tabId)]: call.key });
        return {};
      case "START_CAPTURE": return startCapture(sender, data);
      case "CAPTION_CUE":
        return updateCapture(data.id, async (item) => {
          if (item.tabId !== tabId || item.callKey !== call.key || item.phase !== "capturing") return;
          const cue = { text: String(data.text || "").slice(0, 12000), speaker: String(data.speaker || "").slice(0, 200),
            timestamp: new Date().toISOString() };
          const outcome = mergeOrAppendCue(item.cues, cue);
          if (["stored", "stored_trimmed", "updated_revision"].includes(outcome)) {
            await saveCapture(item, false);
          }
          return { cueCount: item.cues.length };
        });
      case "OPEN_APP": return openApp(tabId);
    }
  }
  const platform = ActionPulseMeeting.platformAt(sender.url);
  if (platform && ["MEETING_ENDED", "OPEN_CAPTURE"].includes(message.type) && sender.frameId === 0 && sender.tab) {
    const item = await readCapture(data.id);
    if (!item || item.tabId !== sender.tab.id || item.platform !== platform) return {};
    if (message.type === "MEETING_ENDED" && item.callKey === data.callKey) void endCapture(item.id);
    if (message.type === "OPEN_CAPTURE") await openCapture(data.id, sender.tab.id);
    return {};
  }
  if (!isPopup(sender)) return {};
  switch (message.type) {
    case "GET_CONNECTION": {
      const { appUrl, apiUrl } = await getSettings();
      return { appUrl, apiUrl };
    }
    case "GET_STATE": {
      const settings = await getAuth();
      const captures = (await allCaptures()).filter((item) => !item.meetingId || sameAccount(item, settings))
        .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return { account: accountIsCurrent(settings) ? settings.userEmail : "", inMeetingTab: Boolean(ActionPulseMeeting.identify(tab?.url)),
        captures: captures.map((item) => ({
          ...view(item, item.appUrl),
          preview: item.cues.slice(-5).map(({ speaker, text }) => ({ speaker, text })),
        })) };
    }
    case "SHOW_MEETING_PROMPT": {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!ActionPulseMeeting.identify(tab?.url)) throw new Error("Open your meeting tab first.");
      await chrome.storage.session.remove(offerKey(tab.id));
      return chrome.tabs.sendMessage(tab.id, { type: "ACTIONPULSE_SHOW_OFFER" }).catch(() => {
        throw new Error("Refresh the meeting tab to enable ActionPulse.");
      });
    }
    case "USE_DEPLOYED_DEFAULTS":
    case "UPDATE_SETTINGS": {
      const connection = message.type === "USE_DEPLOYED_DEFAULTS" ? DEFAULT_CONNECTION : parseConnection(data);
      if (!connection) throw new Error("Use an HTTPS Vercel or Render address, or an HTTP localhost address.");
      await updateSettings((current) => ({
        ...current, ...(connection.appUrl !== current.appUrl && EMPTY_AUTH), ...connection,
      }));
      return connection;
    }
    case "OPEN_APP": return openApp();
    case "OPEN_CAPTURE":
      await openCapture(data.id);
      return {};
    case "RETRY_UPLOAD": {
      const settings = await getAuth();
      void updateCapture(data.id, async (item) => {
        if (item.meetingId && item.phase === "retry" && sameAccount(item, settings)) await uploadOrRetry(item);
      });
      return {};
    }
    case "FINISH_CAPTURE": {
      const settings = await getSettings();
      const item = await readCapture(data.id);
      if (item?.phase === "capturing" && sameAccount(item, settings)) void endCapture(item.id);
      return {};
    }
    case "EXPORT": {
      const settings = await getSettings();
      const item = await readCapture(data.id);
      if (!item || (item.meetingId && !sameAccount(item, settings))) throw new Error("Capture unavailable.");
      return { vtt: buildVttTranscript(item.cues, item.startedAt), txt: buildCanonicalText(item.cues), title: item.title };
    }
    case "DISCARD": {
      const settings = await getSettings();
      await updateCapture(data.id, async (item) => {
        if (["empty", "failed", "ready", "retry"].includes(item.phase) && (!item.meetingId || sameAccount(item, settings))) {
          await chrome.storage.local.remove(CAPTURE_PREFIX + item.id);
          await chrome.notifications.clear(item.id);
          void updateBadge();
        }
      });
      return {};
    }
    default: return {};
  }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  handle(message, sender).then(respond, (error) => respond({ error: error.message || "ActionPulse could not complete this step." }));
  return true;
});
