const el = (id) => document.getElementById(id);
const getState = () => chrome.runtime.sendMessage({ type: "GET_STATE" });
const managerRoles = { owner: "Owner", admin: "Admin", organiser: "Organiser" };
const providerNames = { google_meet: "Google Meet", zoom: "Zoom Web", teams: "Microsoft Teams" };
const appUrlInput = el("appUrlInput");
const apiUrlInput = el("apiUrlInput");
const defaultsButton = el("useDeployedDefaultsBtn");
const editedSettings = new Set();
const feed = el("transcriptFeed");
const transcriptPanel = el("transcriptPanel");
const uploadButton = el("uploadBtn");
const reviewLink = el("reviewGateLink");

let session;
let settings;
let defaultConnection;
let savingSettings = false;
let tabStatus;
let isUploading = false;
let submittingUpload = false;
let refreshInFlight = false;
let localUploadError = "";
let captionSignature = "";

function setText(id, value) {
  const node = el(id);
  if (node.textContent !== value) node.textContent = value;
}

function showMessage(id, text = "") {
  el(id).hidden = !text;
  setText(id, text);
}

function webUrl(value) {
  try {
    const url = new URL(value);
    if (["https:", "http:"].includes(url.protocol) && !url.username && !url.password) return url;
  } catch {
    // Invalid or missing URL.
  }
  return null;
}

function getProvider(url) {
  const host = webUrl(url)?.hostname;
  if (host === "meet.google.com") return "google_meet";
  if (host === "zoom.us" || host?.endsWith(".zoom.us")) return "zoom";
  if (host === "teams.microsoft.com" || host === "teams.live.com") return "teams";
  return null;
}

async function getMeetingTabStatus() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const provider = getProvider(tab?.url);
  if (!provider) return null;
  try {
    const status = await chrome.tabs.sendMessage(tab.id, { type: "CHECK_PLATFORM_STATUS" });
    return { provider, ...status };
  } catch {
    return { provider, needsRefresh: true };
  }
}

function updateDuration() {
  let seconds = 0;
  if (session?.startTime) {
    const end = session.endTime ? Date.parse(session.endTime) : Date.now();
    seconds = Math.max(0, Math.floor((end - Date.parse(session.startTime)) / 1000));
  }
  const time = [Math.floor(seconds / 60), seconds % 60].map((unit) => String(unit).padStart(2, "0")).join(":");
  setText("meetingTimer", time);
}

function workspaceStatus() {
  const role = Object.hasOwn(managerRoles, settings?.managerRole) ? managerRoles[settings.managerRole] : "";
  const expired = settings?.tokenExpiresAt > 0 && settings.tokenExpiresAt * 1000 <= Date.now();
  if (!settings?.hasAccessToken || expired) {
    return { title: expired ? "Session expired" : "Sign in to ActionPulse", help: "Open ActionPulse and select your workspace to upload.", role: "", canUpload: false };
  }
  if (!settings.workspaceId) {
    return { title: "Select a workspace", help: "Choose the workspace for this meeting in ActionPulse.", role: "", canUpload: false };
  }
  return {
    title: settings.workspaceName || "Workspace connected",
    help: role ? (settings.userEmail || "Signed in") : "Ask an owner, admin or organiser to upload.",
    role: role || "Read only",
    canUpload: Boolean(role),
  };
}

function renderCaptions(cues) {
  const latest = cues.slice(-20);
  const nextSignature = JSON.stringify(latest);
  if (nextSignature === captionSignature) return;
  const nearEnd = feed.scrollHeight - feed.clientHeight - feed.scrollTop < 14;
  captionSignature = nextSignature;
  const rows = latest.map((cue) => {
    const row = document.createElement("li");
    const speaker = document.createElement("strong");
    speaker.textContent = cue.speaker || "Speaker";
    row.append(speaker, document.createTextNode(cue.text || ""));
    return row;
  });
  feed.replaceChildren(...rows);
  if (nearEnd) feed.scrollTop = feed.scrollHeight;
}

function render() {
  const workspace = workspaceStatus();
  setText("syncWorkspaceTag", workspace.title);
  setText("syncAccountStat", workspace.help);
  setText("rolePill", workspace.role);
  el("rolePill").hidden = !workspace.role;

  const cues = session?.cues || [];
  const count = cues.length;
  const busy = isUploading || submittingUpload;
  const completed = Boolean(session?.isCompleted || session?.uploaded);
  const provider = providerNames[session?.platform] || providerNames[tabStatus?.provider] || "";
  const saved = session?.uploaded && session.uploadResult;
  const resultReviewUrl = webUrl(session?.reviewUrl);
  const error = localUploadError || session?.uploadError;
  let state = "Ready";
  let tone = "idle";
  let hint = "Open a Meet, Zoom or Teams call in this browser, then turn on captions.";

  if (busy) {
    state = "Uploading"; tone = "working";
    hint = "Saving the transcript and preparing tasks for review.";
  } else if (saved) {
    state = "Saved"; tone = "done";
    const segments = saved.segmentCount ?? count;
    const items = saved.extractedItemsCount ?? 0;
    hint = `${segments} transcript segment${segments === 1 ? "" : "s"} saved. ${items ? `${items} item${items === 1 ? "" : "s"} ready to review.` : "No suggested items to review."}`;
  } else if (completed) {
    state = error ? "Upload needs attention" : "Call ended";
    tone = error ? "warning" : "idle";
    hint = count ? (workspace.canUpload ? "Upload the captions to review suggested tasks." : "Connect an organiser account to upload, or download a copy.")
      : "No captions were captured. Turn them on at the start of your next call.";
  } else if (tabStatus?.needsRefresh && !session?.isRecording) {
    state = "Reload call tab"; tone = "warning";
    hint = "Refresh the meeting tab so ActionPulse can connect.";
  } else if (tabStatus?.active && tabStatus?.captionsActive) {
    state = "Capturing captions"; tone = "live";
    hint = "New captions will appear after someone speaks.";
  } else if (tabStatus?.active) {
    state = "Captions off"; tone = "warning";
    hint = "Turn on captions in the call. ActionPulse will start capturing automatically.";
  } else if (session?.isRecording) {
    state = "Call in progress"; tone = "live";
    hint = "Switch to the call tab to check whether captions are on.";
  } else if (tabStatus?.provider) {
    state = "Ready to join";
    hint = "Join the call and turn on captions to start capturing.";
  }

  setText("statusLabel", state);
  el("sessionStateTag").dataset.tone = tone;
  setText("platformName", provider);
  setText("meetingTitle", session?.title || "Live meeting");
  setText("statusHint", hint);
  setText("cueCountStat", String(count));
  setText("previewCount", `Latest ${Math.min(count, 20)} of ${count}`);
  updateDuration();
  showMessage("uploadError", !busy && error ? `${error} Your captions are still on this device.` : "");

  reviewLink.hidden = !saved || !resultReviewUrl;
  if (!reviewLink.hidden) {
    const items = saved.extractedItemsCount ?? 0;
    const meetingUrl = saved.meetingId ? new URL(`/meetings/${encodeURIComponent(saved.meetingId)}?tab=overview`, resultReviewUrl) : resultReviewUrl;
    setText("reviewLinkLabel", items > 0 ? "Review tasks" : "Open meeting");
    reviewLink.href = items > 0 ? resultReviewUrl.href : meetingUrl.href;
  }
  uploadButton.hidden = !busy && (!completed || !count || Boolean(saved));
  uploadButton.disabled = busy || !workspace.canUpload;
  setText("uploadLabel", busy ? "Uploading captions…" : error ? "Retry upload" : "Upload captions");
  el("uploadSpinner").hidden = !busy;
  transcriptPanel.hidden = !count;
  el("clearBufferBtn").hidden = !completed || busy;
  renderCaptions(cues);
}

async function refresh() {
  if (refreshInFlight) return;
  refreshInFlight = true;
  try {
    const [state, tab] = await Promise.all([getState(), getMeetingTabStatus().catch(() => null)]);
    if (!state?.settings) throw new Error("No extension state");
    if (session?.id !== state.session?.id) localUploadError = "";
    ({ session, settings, isUploading, defaultConnection } = state);
    defaultsButton.disabled = savingSettings || !defaultConnection;
    tabStatus = tab;
    if (!editedSettings.has(appUrlInput)) appUrlInput.value = settings.appUrl || "";
    if (!editedSettings.has(apiUrlInput)) apiUrlInput.value = settings.apiUrl || "";
    if (el("panelError").dataset.source === "refresh") {
      showMessage("panelError");
      delete el("panelError").dataset.source;
    }
    render();
  } catch {
    el("panelError").dataset.source = "refresh";
    showMessage("panelError", "ActionPulse couldn't load the capture status. Close and reopen this popup.");
  } finally {
    refreshInFlight = false;
  }
}

el("openAppBtn").addEventListener("click", () => {
  const site = webUrl(settings?.appUrl);
  if (site) {
    void chrome.tabs.create({ url: new URL("/meetings", site).href });
  } else {
    el("settingsPanel").open = true;
    appUrlInput.focus();
  }
});

uploadButton.addEventListener("click", async () => {
  submittingUpload = true;
  localUploadError = "";
  render();
  try {
    const result = await chrome.runtime.sendMessage({ type: "UPLOAD_TO_BACKEND" });
    if (!result?.success) throw new Error(result?.error || "The upload could not be completed.");
    session = { ...session, uploaded: true, uploadResult: result, reviewUrl: result.reviewUrl, uploadError: "" };
  } catch (error) {
    localUploadError = error.message;
  } finally {
    // The reply arrives after the worker has finished saving.
    submittingUpload = false;
    isUploading = false;
    render();
    void refresh();
  }
});

transcriptPanel.addEventListener("toggle", () => {
  if (transcriptPanel.open) feed.scrollTop = feed.scrollHeight;
});

async function download(format) {
  try {
    const transcript = await chrome.runtime.sendMessage({ type: "GET_TRANSCRIPT_EXPORT" });
    if (!transcript?.cueCount || !transcript[format]) return;
    const blob = new Blob([transcript[format]], { type: format === "vtt" ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const title = String(transcript.title || "meeting").replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(0, 80);
    const stamp = new Date().toISOString().slice(0, 10);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `ActionPulse-${title}-${stamp}.${format}`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    showMessage("panelError", "The transcript couldn't be downloaded. Please try again.");
  }
}

el("saveVttBtn").addEventListener("click", () => void download("vtt"));
el("saveTxtBtn").addEventListener("click", () => void download("txt"));
el("clearBufferBtn").addEventListener("click", async () => {
  if (!confirm("Discard the local transcript copy? Any transcript already saved to ActionPulse will remain there.")) return;
  try {
    const result = await chrome.runtime.sendMessage({ type: "CLEAR_BUFFER" });
    if (result?.status !== "cleared") throw new Error("Could not clear");
    session = result.session;
    localUploadError = "";
    transcriptPanel.open = false;
    render();
  } catch {
    showMessage("panelError", "The local transcript couldn't be discarded. Please try again.");
  }
});

[appUrlInput, apiUrlInput].forEach((input) => {
  input.addEventListener("input", () => {
    editedSettings.add(input);
    setText("settingsStatus", "");
  });
});
defaultsButton.addEventListener("click", () => {
  if (!defaultConnection || savingSettings) return;
  appUrlInput.value = defaultConnection.appUrl;
  apiUrlInput.value = defaultConnection.apiUrl;
  editedSettings.add(appUrlInput);
  editedSettings.add(apiUrlInput);
  el("settingsForm").requestSubmit();
});

el("settingsForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (savingSettings) return;
  const site = webUrl(appUrlInput.value);
  const api = webUrl(apiUrlInput.value);
  if (!site || !api) {
    setText("settingsStatus", "Enter valid HTTP or HTTPS URLs.");
    return;
  }

  const saveButton = el("saveSettingsBtn");
  savingSettings = true;
  saveButton.disabled = true;
  defaultsButton.disabled = true;
  setText("settingsStatus", "Saving…");
  try {
    const result = await chrome.runtime.sendMessage({
      type: "UPDATE_SETTINGS", data: { appUrl: site.origin, apiUrl: api.origin },
    });
    if (result?.status !== "settings_updated") throw new Error("Could not save settings");
    settings = { ...settings, appUrl: site.origin, apiUrl: api.origin };
    editedSettings.clear();
    setText("settingsStatus", "Settings saved");
    void refresh();
  } catch {
    setText("settingsStatus", "Couldn't save. Try again.");
  } finally {
    savingSettings = false;
    saveButton.disabled = false;
    defaultsButton.disabled = !defaultConnection;
  }
});

void refresh();
setInterval(refresh, 1500);
setInterval(updateDuration, 1000);
