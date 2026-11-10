/**
 * ActionPulse - Zoom Web Caption Capture Content Script
 * 
 * Automatically captures live closed captions in Zoom Web Client when enabled by the host/manager.
 * Buffers spoken cues and forwards them to the ActionPulse background service worker.
 */

(function () {
  console.log("[ActionPulse] Zoom Web Client content script active.");

  const PLATFORM = "zoom";
  let observer = null;
  let lastSpeaker = "";
  let lastText = "";
  let debounceTimer = null;
  let isCaptionsActive = false;

  let statusBadge = null;

  function createStatusBadge() {
    if (document.getElementById("actionpulse-zoom-badge")) return;
    statusBadge = document.createElement("div");
    statusBadge.id = "actionpulse-zoom-badge";
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
      <span>ActionPulse: Ready (Turn on Zoom CC)</span>
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
      text.innerText = message || "ActionPulse: Recording Zoom CC";
    } else {
      dot.style.background = "#f59e0b";
      dot.style.boxShadow = "0 0 8px #f59e0b";
      text.innerText = message || "ActionPulse: Captions Paused";
    }
  }

  function getMeetingTitle() {
    const headerEl = document.querySelector(".meeting-info-title, .title-content, [data-testid='meeting-title']");
    return headerEl?.innerText?.trim() || document.title.replace("- Zoom", "").trim() || "Zoom Meeting";
  }

  function processZoomCaption(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    // Zoom CC selectors
    const speakerEl = node.querySelector(".closed-caption-speaker, .speaker-name, .cc-speaker");
    const textEl = node.querySelector(".closed-caption-text, .caption-text, .cc-content") || node;

    let speaker = speakerEl ? speakerEl.innerText.trim().replace(/:$/, "") : "";
    let rawText = textEl.innerText ? textEl.innerText.trim() : "";

    // If speaker is included inside the raw text like "John Doe: Hello everyone"
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
                addedNode.classList?.contains("closed-caption-text") ||
                addedNode.classList?.contains("closed-caption-window") ||
                addedNode.querySelector?.(".closed-caption-text, .closed-caption-speaker")
              ) {
                processZoomCaption(addedNode);
              }
            }
          }
        }
        if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const el = mutation.target;
          if (
            el.classList?.contains("closed-caption-text") ||
            el.closest?.(".closed-caption-window, #closed-caption-item")
          ) {
            processZoomCaption(el);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log("[ActionPulse] Observer attached to Zoom CC.");
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
