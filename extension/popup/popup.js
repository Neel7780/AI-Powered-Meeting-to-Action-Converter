const account = document.getElementById("account");
const captures = document.getElementById("captures");
const showOffer = document.getElementById("showOffer");
const connection = document.getElementById("connection");
const settingsPanel = document.getElementById("settings");
const settingsStatus = document.getElementById("settingsStatus");
const errorMessage = document.getElementById("error");
let defaults;
let currentConnection;
let lastCaptureState;

async function send(type, data) {
  const result = await chrome.runtime.sendMessage({ type, data });
  if (result?.error) throw new Error(result.error);
  return result;
}

function make(tag, copy, className) {
  const element = document.createElement(tag);
  if (copy) element.textContent = copy;
  if (className) element.className = className;
  return element;
}

function handle(promise) {
  errorMessage.textContent = "";
  void promise.catch((error) => { errorMessage.textContent = error.message; });
}

function button(label, action, className = "secondary") {
  const element = make("button", label, className);
  element.type = "button";
  element.addEventListener("click", () => handle(action()));
  return element;
}

async function download(state, format) {
  const exportData = await send("EXPORT", { id: state.id });
  const url = URL.createObjectURL(new Blob([exportData[format]], { type: format === "vtt" ? "text/vtt" : "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = (exportData.title || "ActionPulse transcript").replace(/[^\p{L}\p{N} ._-]/gu, "-").slice(0, 100) + "." + format;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function captureCard(state) {
  const copy = ActionPulseMeeting.statusCopy(state);
  const card = make("article", "", "capture");
  card.append(make("p", state.title, "metadata"), make("h2", copy.heading), make("p", copy.description, "muted"));
  if (state.workspaceName) card.append(make("p", state.workspaceName, "metadata"));
  if (state.phase === "capturing") card.append(make("p", ActionPulseMeeting.captionCount(state.cueCount), "capture-count"));
  const actions = make("div", "", "actions");
  if (copy.action && state.meetingUrl) {
    actions.append(button(copy.action, () => send("OPEN_CAPTURE", { id: state.id }), "primary"));
  }
  if (state.phase === "retry" && state.meetingUrl) {
    actions.append(button("Retry upload", async () => { await send("RETRY_UPLOAD", { id: state.id }); await refresh(); }, "primary"));
  }
  if (state.phase === "capturing") {
    actions.append(button("Finish capture", async () => { await send("FINISH_CAPTURE", { id: state.id }); await refresh(); }));
  }
  if (state.cueCount) actions.append(button("Download VTT", () => download(state, "vtt")));
  if (["ready", "failed", "empty", "retry"].includes(state.phase)) {
    actions.append(button(state.cueCount ? "Discard local captions" : "Dismiss", async () => {
      if (state.cueCount && !confirm("Discard the local copy of these captions?")) return;
      await send("DISCARD", { id: state.id });
      await refresh();
    }));
  }
  if (actions.children.length) card.append(actions);
  if (state.preview.length) {
    const preview = make("details", "", "preview");
    const keepOpen = captures.querySelector(`[data-capture-id="${state.id}"] .preview`)?.open;
    card.dataset.captureId = state.id;
    preview.open = Boolean(keepOpen);
    const lines = make("ul");
    for (const cue of state.preview) lines.append(make("li", `${cue.speaker}: ${cue.text}`));
    preview.append(make("summary", "Transcript preview"), lines, button("Download TXT", () => download(state, "txt")));
    card.append(preview);
  }
  return card;
}

let refreshing = false;
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    const state = await send("GET_STATE");
    account.textContent = state.account || "Sign in to ActionPulse in this browser";
    account.parentElement.dataset.connected = Boolean(state.account);
    showOffer.hidden = !state.inMeetingTab;
    if (!currentConnection || !settingsPanel.open) {
      connection.elements.appUrl.value = state.connection.appUrl;
      connection.elements.apiUrl.value = state.connection.apiUrl;
    }
    currentConnection = state.connection;
    defaults = state.defaultConnection;
    const signature = JSON.stringify([state.inMeetingTab, state.captures]);
    if (signature !== lastCaptureState) {
      lastCaptureState = signature;
      if (state.captures.length) captures.replaceChildren(...state.captures.map(captureCard));
      else captures.replaceChildren(make("p", state.inMeetingTab
        ? "ActionPulse prompts you when you join the call."
        : "Join a Google Meet, Zoom Web or Microsoft Teams Web call to get started.", "empty muted"));
    }
  } finally {
    refreshing = false;
  }
}

async function save(settings) {
  settingsStatus.textContent = "Saving…";
  try {
    await send("UPDATE_SETTINGS", settings);
    currentConnection = null;
    await refresh();
    settingsStatus.textContent = "Saved";
  } catch (error) {
    settingsStatus.textContent = error.message;
  }
}

document.getElementById("openApp").addEventListener("click", () => handle(send("OPEN_APP")));
showOffer.addEventListener("click", () => handle(send("SHOW_MEETING_PROMPT").then(() => window.close())));
document.getElementById("defaults").addEventListener("click", () => {
  if (defaults) void save(defaults);
});
connection.addEventListener("submit", (event) => {
  event.preventDefault();
  void save(Object.fromEntries(new FormData(connection)));
});

handle(refresh());
setInterval(() => { void refresh().catch(() => {}); }, 2000);
