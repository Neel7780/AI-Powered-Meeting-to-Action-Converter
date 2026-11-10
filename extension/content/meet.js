/**
 * ActionPulse - Google Meet Caption Capture Content Script
 * 
 * Automatically captures live spoken closed captions in Google Meet when enabled by the manager.
 * Buffers streaming text, deduplicates word-by-word increments, and forwards complete cues
 * to the ActionPulse background service worker.
 */

(function () {
  console.log("[ActionPulse] Google Meet content script active.");

  const PLATFORM = "google_meet";
  let observer = null;
  let lastSpeaker = "";
  let lastText = "";
  let debounceTimer = null;
  let isCaptionsActive = false;

  // Visual status pill injected into Google Meet UI
  let statusBadge = null;

  function createStatusBadge() {
    if (document.getElementById("actionpulse-meet-badge")) return;
    statusBadge = document.createElement("div");
    statusBadge.id = "actionpulse-meet-badge";
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
    statusBadge.style.pointerEvents = "auto";
    statusBadge.style.backdropFilter = "blur(8px)";
    statusBadge.style.transition = "all 0.2s ease";

    statusBadge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
      <span>ActionPulse: Ready (Turn on CC)</span>
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
      text.innerText = message || "ActionPulse: Recording Captions";
    } else {
      dot.style.background = "#f59e0b";
      dot.style.boxShadow = "0 0 8px #f59e0b";
      text.innerText = message || "ActionPulse: Captions Paused";
    }
  }

  function getMeetingTitle() {
    // Attempt to extract Google Meet code / title
    const url = window.location.href;
    const match = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    const code = match ? match[1] : "Meeting";
    const headerTitle = document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title");
    return headerTitle || document.title.replace("- Google Meet", "").trim() || `Google Meet (${code})`;
  }

  function processCaptionNode(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return;

    // Look for speaker name and caption text in common Google Meet selectors
    // 1. Google Meet standard containers
    const speakerEl =
      node.querySelector(".zs7PeP, .jxFHg, .NWbcqb, [data-sender-name]") ||
      node.closest("[data-sender-name]");
    
    const textEl =
      node.querySelector(".iTTPOb, .yg30fd, span[jsname]") ||
      node;

    let speaker = "";
    if (speakerEl) {
      speaker = speakerEl.getAttribute("data-sender-name") || speakerEl.innerText.trim();
    }
    if (!speaker) {
      speaker = lastSpeaker || "Speaker";
    }

    let text = textEl.innerText ? textEl.innerText.trim() : "";
    if (!text || text.length < 2) return;

    // Filter out common Google Meet UI text that isn't a caption
    if (
      text.includes("Turn on captions") ||
      text.includes("Captions have been turned on") ||
      text.includes("You're presenting") ||
      text.includes("Your microphone is off")
    ) {
      return;
    }

    isCaptionsActive = true;
    updateBadgeStatus(true, `Listening: ${speaker}`);

    // Debounce streaming text so we only send meaningful finalized chunks
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (text !== lastText) {
        lastText = text;
        lastSpeaker = speaker;

        const cue = {
          speaker: speaker,
          text: text,
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

    // Observe body for caption containers being added / modified
    observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Direct child list updates (new caption block)
        if (mutation.type === "childList") {
          for (const addedNode of mutation.addedNodes) {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              if (
                addedNode.classList?.contains("iTTPOb") ||
                addedNode.querySelector?.(".iTTPOb, .zs7PeP, div[aria-live='polite']")
              ) {
                processCaptionNode(addedNode);
              }
            }
          }
        }
        // Character data or target subtree changes (live speech updates)
        if (mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE) {
          const el = mutation.target;
          if (
            el.classList?.contains("iTTPOb") ||
            el.closest?.(".iTTPOb, div[aria-live='polite'], div[jsname='r4nke']")
          ) {
            processCaptionNode(el);
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    console.log("[ActionPulse] Observer attached to Google Meet captions.");
  }

  // Listen for messages from popup
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

  // Wait for Google Meet page to settle before observing
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initCaptionObserver, 1500);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(initCaptionObserver, 1500));
  }
})();
