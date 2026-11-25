// Each provider supplies joined-call controls and caption selectors.
globalThis.runActionPulseMeeting = (provider) => {
  const { identify, names, statusCopy, captionCount } = ActionPulseMeeting;
  const send = async (type, data) => {
    const result = await chrome.runtime.sendMessage({ type, data });
    if (result?.error) throw new Error(result.error);
    return result;
  };
  let call;
  let state;
  let observer;
  let container;
  let captionSnapshots;
  let preCaptureContainer;
  let missingSince = 0;
  let offerBusy = false;
  let awaitingSignIn = false;
  let offerSequence = 0;
  let configureId;
  let panel;
  let pendingCues = [];
  let sendingCues = false;
  let visibleCaptionCount = 0;
  let title = "";

  function visible(selector) {
    return [...document.querySelectorAll(selector)].find((node) => node.getClientRects().length > 0);
  }

  async function getPanel() {
    if (!panel) {
      const host = document.createElement("div");
      host.id = "actionpulse-live-panel";
      const shadow = host.attachShadow({ mode: "closed" });
      const styles = document.createElement("link");
      styles.rel = "stylesheet";
      styles.href = chrome.runtime.getURL("shared/panel.css");
      const content = document.createElement("section");
      content.className = "panel";
      content.setAttribute("aria-label", "ActionPulse meeting");
      shadow.append(styles, content);
      document.documentElement.append(host);
      panel = { host, content };
    }
    return panel;
  }

  function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text) result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function button(label, callback, className = "primary") {
    const result = node("button", label, className);
    result.type = "button";
    result.addEventListener("click", callback);
    return result;
  }

  function hide() {
    panel?.host.remove();
    panel = null;
  }

  async function card(heading, description, onClose) {
    const { content } = await getPanel();
    const header = node("div", "", "panel-header");
    const brand = node("span", "ActionPulse", "brand-name");
    const mark = node("img", "", "brand-icon");
    mark.src = chrome.runtime.getURL("icons/icon-48.png");
    mark.alt = "";
    header.append(mark, brand);
    if (onClose) {
      const close = button("×", onClose, "icon-button");
      close.setAttribute("aria-label", "Dismiss ActionPulse");
      header.append(close);
    }
    const text = node("div", "", "panel-copy");
    text.setAttribute("aria-live", "polite");
    text.append(node("h2", heading), node("p", description, "muted"));
    content.replaceChildren(header, text);
    return content;
  }

  function showError(parent, error) {
    const message = node("p", error.message, "error");
    message.setAttribute("role", "alert");
    parent.querySelector(".error")?.remove();
    parent.append(message);
  }

  function renderState(updated) {
    state = updated;
    if (updated.phase === "capturing") {
      watchCaptions();
    } else {
      stopCaptions();
    }
    const copy = statusCopy(updated);
    void card(copy.heading, copy.description, hide).then((content) => {
      if (state !== updated) return;
      content.append(node("p", `${updated.workspaceName} · ${names[updated.platform]}`, "metadata"));
      if (updated.phase === "capturing") {
        content.append(node("p", captionCount(updated.cueCount), "capture-count"));
      } else if (updated.phase === "retry" && !copy.action) {
        content.append(node("p", "Open the ActionPulse extension to retry or download your captions.", "muted"));
      }
      if (copy.action) content.append(button(copy.action, () =>
        send("OPEN_CAPTURE", { id: updated.id }).catch((error) => showError(content, error))));
    });
  }

  async function dismissOffer() {
    offerSequence++;
    awaitingSignIn = false;
    await send("DISMISS_OFFER").catch(() => {});
    hide();
  }

  async function showOffer() {
    if (!call || offerBusy) return;
    offerBusy = true;
    const sequence = ++offerSequence;
    try {
      const offer = await send("MEETING_JOINED");
      if (sequence !== offerSequence || !call) return;
      if (offer.kind === "capture") {
        renderState(offer.state);
        return;
      }
      if (offer.kind === "ineligible" || offer.kind === "dismissed") {
        hide();
        return;
      }
      awaitingSignIn = offer.kind === "sign-in";
      if (awaitingSignIn) {
        const content = await card("Sign in to capture this meeting", "Use your ActionPulse account to turn call captions into tasks for review.", dismissOffer);
        content.append(button("Sign in to ActionPulse", () => send("OPEN_APP").catch((error) => showError(content, error))));
        return;
      }
      const content = await card("Turn this meeting into tasks?", "ActionPulse will capture live captions. After the call, you can review and assign the suggested tasks.", dismissOffer);
      content.append(node("p", title, "metadata"));
      let select;
      if (offer.workspaces.length > 1) {
        const label = node("label", "Workspace", "field-label");
        select = node("select");
        select.append(new Option("Choose a workspace", "", true, true));
        select.options[0].disabled = true;
        for (const workspace of offer.workspaces) select.append(new Option(workspace.name, workspace.id));
        label.append(select);
        content.append(label);
      } else {
        content.append(node("p", offer.workspaces[0].name, "workspace-chip"));
      }

      const consent = node("label", "", "consent");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      consent.append(checkbox, node("span", "I’ve told participants that ActionPulse will use AI to process this call’s captions."));
      const footer = node("div", "", "actions");
      const confirm = button("Start capture", async () => {
        const workspace = select ? offer.workspaces.find((item) => item.id === select.value) : offer.workspaces[0];
        if (!workspace || !checkbox.checked) return;
        preCaptureContainer = visible(provider.captions);
        confirm.disabled = true;
        checkbox.disabled = true;
        if (select) select.disabled = true;
        confirm.textContent = "Creating meeting…";
        // Keep the same request ID if the network times out after the server saved it.
        configureId ||= crypto.randomUUID();
        try {
          const started = await send("START_CAPTURE", {
            id: configureId, workspaceId: workspace.id, workspaceName: workspace.name, title, attested: true,
            userId: offer.userId,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          });
          if (call && sequence === offerSequence) renderState(started);
        } catch (error) {
          showError(content, error);
          confirm.textContent = "Try again";
          confirm.disabled = false;
          checkbox.disabled = false;
          if (select) select.disabled = false;
        }
      });
      function validate() { confirm.disabled = !checkbox.checked || (select && !select.value); }
      confirm.disabled = true;
      checkbox.addEventListener("change", validate);
      select?.addEventListener("change", () => { configureId = null; validate(); });
      footer.append(button("Not now", dismissOffer, "secondary"), confirm);
      content.append(consent, footer);
    } catch (error) {
      if (sequence !== offerSequence) return;
      const content = await card("ActionPulse couldn’t connect", error.message, dismissOffer);
      content.append(button("Try again", showOffer));
    } finally {
      offerBusy = false;
    }
  }

  async function flushCues() {
    if (sendingCues) return;
    sendingCues = true;
    while (pendingCues.length) {
      const cue = pendingCues.shift();
      try {
        const result = await send("CAPTION_CUE", cue);
        if (state?.id === cue.id && state.phase === "capturing" && typeof result?.cueCount === "number") {
          const previous = visibleCaptionCount;
          visibleCaptionCount = result.cueCount;
          state.cueCount = result.cueCount;
          if (!previous && result.cueCount && panel) renderState(state);
          else if (panel) {
            const count = panel.content.querySelector(".capture-count");
            if (count) count.textContent = captionCount(result.cueCount);
          }
        }
      } catch {
        // The extension may have been reloaded while the meeting was open.
      }
    }
    sendingCues = false;
  }

  function collectCaptions(prime = false) {
    if (!container || state?.phase !== "capturing") return;
    for (const entry of provider.read(container)) {
      const speaker = String(entry.speaker || "Speaker").replace(/\s+/g, " ").trim();
      const text = String(entry.text || "").replace(/\s+/g, " ").trim();
      if (text.length < 2 || provider.ignore?.(text, speaker)) continue;
      const key = speaker + "\n" + text;
      if (captionSnapshots.get(entry.element) === key) continue;
      captionSnapshots.set(entry.element, key);
      if (!prime) pendingCues.push({ id: state.id, speaker, text });
    }
    void flushCues();
  }

  function stopCaptions() {
    observer?.disconnect();
    observer = null;
    container = null;
  }

  function watchCaptions() {
    if (state?.phase !== "capturing") return;
    const captions = visible(provider.captions);
    if (captions === container) return;
    const firstAttachment = captionSnapshots === null;
    stopCaptions();
    if (!captions) return;
    container = captions;
    captionSnapshots ||= new WeakMap();
    observer = new MutationObserver(() => collectCaptions());
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    // Captions that are already on screen when consent is given belong to the prior conversation.
    collectCaptions(firstAttachment && !state.cueCount && captions === preCaptureContainer);
  }

  async function ended() {
    const previousCall = call;
    call = null;
    offerSequence++;
    awaitingSignIn = false;
    missingSince = 0;
    if (state?.phase === "capturing") {
      const id = state.id;
      collectCaptions();
      stopCaptions();
      // Caption messages are sent in order. Flush the last visible turn before requesting upload.
      while (sendingCues) await new Promise((resolve) => setTimeout(resolve, 20));
      await send("MEETING_ENDED", { id, callKey: previousCall.key }).catch(() => {});
    } else if (!state) hide();
  }

  function tick() {
    const next = identify(location.href);
    const joined = next && visible(provider.joined) && !visible(provider.ended);
    if (call && (!next || next.key !== call.key || visible(provider.ended))) {
      void ended();
    } else if (call && !joined) {
      missingSince ||= Date.now();
      if (Date.now() - missingSince > 7000) void ended();
    } else if (joined && !call) {
      call = next;
      state = null;
      configureId = null;
      visibleCaptionCount = 0;
      captionSnapshots = null;
      preCaptureContainer = null;
      missingSince = 0;
      title = provider.title() || names[call.platform] + " meeting";
      void showOffer();
    } else if (joined) {
      missingSince = 0;
      if (state?.phase === "capturing") watchCaptions();
      else {
        preCaptureContainer = visible(provider.captions);
      }
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === "ACTIONPULSE_CAPTURE_STATE" &&
        (state?.id === message.state.id || call?.key === message.callKey)) {
      renderState(message.state);
    } else if (message.type === "ACTIONPULSE_SHOW_OFFER") {
      if (!call) respond({ error: "Join the call in your browser first." });
      else if (state?.phase === "capturing") { renderState(state); respond({}); }
      else { void showOffer(); respond({}); }
    }
  });

  window.addEventListener("focus", () => { if (awaitingSignIn) void showOffer(); });
  setInterval(tick, 800);
  tick();
};
