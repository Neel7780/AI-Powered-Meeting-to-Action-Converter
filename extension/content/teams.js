/**
 * ActionPulse - Microsoft Teams Live Captions Content Script
 * 
 * Captures live speech from Microsoft Teams web closed captions when enabled by the manager.
 * Buffers spoken cues and forwards them to the ActionPulse background service worker.
 */

(function () {
  console.log("[ActionPulse] Microsoft Teams content script active.");

  const PLATFORM = "teams";
  let observer = null;
  let lastSpeaker = "";
  let lastText = "";
  let debounceTimer = null;
  let isCaptionsActive = false;

  let statusBadge = null;

  function createStatusBadge() {
    if (document.getElementById("actionpulse-teams-badge")) return;
    statusBadge = document.createElement("div");
    statusBadge.id = "actionpulse-teams-badge";
    statusBadge.style.position = "fixed";
    statusBadge.style.top = "16px";
    statusBadge.style.left = "16px";
    statusBadge.style.zIndex = "99999";
    statusBadge.style.display = "flex";
    statusBadge.style.alignItems = "center";
    statusBadge.style.gap = "8px";
    statusBadge.style.padding = "6px 12px";
    statusBadge.style.borderRadius = "20px";
    statusBadge.style.backgroundColor = "rgba(10, 10, 15, 0.92)";
    statusBadge.style.border = "1px solid rgba(99, 102, 241, 0.4)";
    statusBadge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
    statusBadge.style.color = "#ffffff";
    statusBadge.style.fontFamily = "Inter, -apple-system, system-ui, sans-serif";
    statusBadge.style.fontSize = "12px";
    statusBadge.style.fontWeight = "500";
    statusBadge.style.backdropFilter = "blur(8px)";

    statusBadge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
      <span>ActionPulse: Ready (Turn on Teams CC)</span>
    `;

    document.body.appendChild(statusBadge);
  }

  function updateBadgeStatus(active, message) {
    if (!statusBadge) createStatusBadge();
    const dot = statusBadge.querySelector("span:first-child");
    const text = statusBadge.querySelector("span:last-child");
    if (active) {
      dot.style.background = "#10b981";
      dot.style.boxShadow = "0 0 10px #10b981";
      text.innerText = message || "ActionPulse: Recording Teams CC";
    } else {
      dot.style.background = "#f59e0b";
      dot.style.boxShadow = "0 0 8px #f59e0b";
      text.innerText = message || "ActionPulse: Captions Paused";
    }
  }

  function getMeetingTitle() {
    const titleEl = document.querySelector(".title-bar, [data-tid='meeting-title'], #callingHeader-title");
    return titleEl?.innerText?.trim() || document.title.replace("- Microsoft Teams", "").trim() || "Microsoft Teams Meeting";
  }

  function processTeamsCaption(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    const speakerEl = node.querySelector(
      "[data-tid='closed-caption-speaker'], .ui-chat__message__author, .fui-Avatar"
    );
    const textEl = node.querySelector(
      "[data-tid='closed-caption-text'], .ui-chat__message__content, [aria-label*='caption' i]"
    ) || node;

    let speaker = speakerEl ? speakerEl.innerText.trim().replace(/:$/, "") : "";
    let rawText = textEl.innerText ? textEl.innerText.trim() : "";

    if (!speaker && rawText.includes(":")) {
      const parts = rawText.split(":");
      speaker = parts[0].trim();
      rawText = parts.slice(1).join(":").trim();
    }

    if (!speaker) speaker = lastSpeaker || "Speaker";
    if (!rawText || rawText.length < 2) return;

    isCaptionsActive = true;
    updateBadgeStatus(true, `Listening: ${speaker}`);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (rawText !== lastText) {
        lastText = rawText;
        lastSpeaker = speaker;

        const cue = {
          speaker: speaker,
          text: rawText,
          timestamp: new Date().toISOString(),
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        };

        try {
          chrome.runtime.sendMessage({
            type: "CAPTION_CUE",
            data: cue,
          });
        } catch (e) {
          console.warn("[ActionPulse] Message delivery error:", e);
        }
      }
    }, 400);
  }

  function initCaptionObserver() {
    createStatusBadge();

    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              if (
                addedNode.getAttribute?.("data-tid") === "closed-captions-renderer" ||
                addedNode.querySelector?.("[data-tid='closed-caption-text'], [data-tid='closed-caption-speaker']")
              ) {
                processTeamsCaption(addedNode);
              }
            }
          }
        }
        if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const el = mutation.target;
          if (
            el.getAttribute?.("data-tid") === "closed-caption-text" ||
            el.closest?.("[data-tid='closed-captions-renderer']")
          ) {
            processTeamsCaption(el);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log("[ActionPulse] Observer attached to Microsoft Teams live captions.");
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_PLATFORM_STATUS") {
      sendResponse({
        active: true,
        platform: PLATFORM,
        captionsActive: isCaptionsActive,
        title: getMeetingTitle(),
        conferenceUrl: window.location.href,
      });
    }
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initCaptionObserver, 1500);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(initCaptionObserver, 1500));
  }
})();
