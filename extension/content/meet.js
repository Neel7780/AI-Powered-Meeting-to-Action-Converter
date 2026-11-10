/**
 * ActionPulse - Google Meet Realtime Caption Capture & Lifecycle Engine
 * 
 * Accurately extracts real spoken closed captions while filtering out Google Meet
 * system accessibility alerts ("You joined", "camera is on", "captions on/off", etc.).
 * Automatically detects meeting start and call end.
 */

(function () {
  console.log("[ActionPulse] Google Meet content script active.");

  const PLATFORM = "google_meet";
  let observer = null;
  let pollInterval = null;
  let isMeetingActive = false;
  let isCaptionsActive = false;

  // Active utterance tracking for streaming captions
  let currentSpeaker = "";
  let currentUtterance = "";
  let lastCommittedText = "";
  let finalizeTimer = null;

  // Visual status pill injected into Google Meet UI
  let statusBadge = null;

  // System notification patterns to strictly filter out
  const SYSTEM_ALERT_PATTERNS = [
    /you have joined the call/i,
    /you are the first one here/i,
    /your camera is (on|off)/i,
    /your microphone is (on|off)/i,
    /your hand is (raised|lowered)/i,
    /live captions are on/i,
    /live captions have been turned off/i,
    /captions have been turned on/i,
    /turn on captions/i,
    /returning to home screen/i,
    /you left the meeting/i,
    /someone wants to join/i,
    /jump to latest/i,
    /you're presenting/i,
    /is presenting/i,
    /screen sharing/i,
    /call quality/i,
    /network is unstable/i,
  ];

  function isSystemNotification(text) {
    if (!text || text.length < 2) return true;
    return SYSTEM_ALERT_PATTERNS.some((pattern) => pattern.test(text.trim()));
  }

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
    statusBadge.style.padding = "6px 14px";
    statusBadge.style.borderRadius = "20px";
    statusBadge.style.backgroundColor = "rgba(10, 10, 15, 0.95)";
    statusBadge.style.border = "1px solid rgba(99, 102, 241, 0.5)";
    statusBadge.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.6)";
    statusBadge.style.color = "#ffffff";
    statusBadge.style.fontFamily = "Inter, -apple-system, system-ui, sans-serif";
    statusBadge.style.fontSize = "12px";
    statusBadge.style.fontWeight = "600";
    statusBadge.style.pointerEvents = "auto";
    statusBadge.style.backdropFilter = "blur(10px)";
    statusBadge.style.transition = "all 0.25s ease";

    statusBadge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
      <span id="actionpulse-badge-text">ActionPulse: Ready (Turn on CC)</span>
    `;

    document.body.appendChild(statusBadge);
  }

  function updateBadgeStatus(active, message) {
    if (!statusBadge) createStatusBadge();
    const dot = statusBadge.querySelector("span:first-child");
    const textEl = document.getElementById("actionpulse-badge-text");
    if (active) {
      dot.style.background = "#10b981";
      dot.style.boxShadow = "0 0 10px #10b981";
      if (textEl) textEl.innerText = message || "ActionPulse: Recording Captions";
    } else {
      dot.style.background = "#6366f1";
      dot.style.boxShadow = "0 0 8px #6366f1";
      if (textEl) textEl.innerText = message || "ActionPulse: Ready";
    }
  }

  function getMeetingTitle() {
    const url = window.location.href;
    const match = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    const code = match ? match[1] : "Meeting";
    const headerTitle = document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title");
    return headerTitle || document.title.replace("- Google Meet", "").trim() || `Google Meet (${code})`;
  }

  // Commit finalized speech cue to service worker
  function commitCue(speaker, text) {
    if (!text || text.length < 2) return;
    if (isSystemNotification(text)) return;

    // Normalise speaker
    let cleanSpeaker = speaker || "You";
    if (cleanSpeaker.toLowerCase() === "you") {
      cleanSpeaker = "You";
    }

    // Deduplicate against last committed
    if (text === lastCommittedText) return;
    lastCommittedText = text;

    console.log(`[ActionPulse] Committed cue: [${cleanSpeaker}]: ${text}`);

    try {
      chrome.runtime.sendMessage({
        type: "CAPTION_CUE",
        data: {
          speaker: cleanSpeaker,
          text: text,
          timestamp: new Date().toISOString(),
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    } catch (e) {
      console.warn("[ActionPulse] Message delivery error:", e);
    }
  }

  /**
   * Resilient Google Meet Caption Scanner
   * Inspects the DOM for active closed caption blocks.
   * Extracts speaker name (e.g. "You", "Neel Khatri") and spoken text directly.
   */
  function scanGoogleMeetCaptions() {
    // 1. Check if user is in an active call
    const leaveBtn = document.querySelector("button[aria-label*='Leave' i], button[jsname='CQylAd']");
    const micBtn = document.querySelector("button[aria-label*='microphone' i], div[data-is-muted]");
    
    // Check if call has ended (rejoin screen or "You left the meeting")
    const leftMeetingText = document.body.innerText.includes("You left the meeting") ||
                            document.body.innerText.includes("Returning to home screen");
    const rejoinBtn = document.querySelector("button:has(span)");
    
    if (leftMeetingText || (!leaveBtn && !micBtn && document.readyState === "complete" && isMeetingActive)) {
      handleMeetingEnded();
      return;
    }

    if ((leaveBtn || micBtn) && !isMeetingActive) {
      isMeetingActive = true;
      console.log("[ActionPulse] Meeting active detected:", getMeetingTitle());
      chrome.runtime.sendMessage({
        type: "MEETING_STARTED",
        data: {
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    }

    // 2. Find Google Meet caption container and speaker blocks
    // Supported Google Meet caption selectors across various releases
    const captionBlocks = document.querySelectorAll(
      "div[jsname='r4nke'] .nM7Ebe, .a4bvKc .nM7Ebe, div[jscontroller='D1tHje'] .nM7Ebe, div.T4LgNb, div.VbkSUe, div[class*='caption' i]"
    );

    if (captionBlocks && captionBlocks.length > 0) {
      isCaptionsActive = true;

      captionBlocks.forEach((block) => {
        // Find speaker element
        const speakerEl = block.querySelector(".zs7PeP, .jxFHg, .NWbcqb, [data-sender-name]");
        let speaker = speakerEl ? (speakerEl.getAttribute("data-sender-name") || speakerEl.innerText).trim() : "";

        // Find spoken text element
        const textEl = block.querySelector(".iTTPOb, .bh44bd, .yg30fd") || block;
        let fullText = textEl.innerText ? textEl.innerText.trim() : "";

        // If block contains both speaker and text in one element (e.g. "You\nFather, tell me...")
        if (!speaker && fullText.includes("\n")) {
          const lines = fullText.split("\n").map((l) => l.trim()).filter(Boolean);
          if (lines.length >= 2) {
            speaker = lines[0];
            fullText = lines.slice(1).join(" ");
          }
        }

        // Subtract speaker name if it appears at start of fullText
        if (speaker && fullText.startsWith(speaker)) {
          fullText = fullText.slice(speaker.length).trim();
        }

        // Ignore system messages
        if (isSystemNotification(fullText)) return;
        if (!fullText || fullText.length < 2) return;

        updateBadgeStatus(true, `Capturing: ${speaker || "You"}`);

        // Streaming sentence assembly
        if (speaker !== currentSpeaker && currentUtterance) {
          // Speaker changed: finalize previous utterance immediately
          commitCue(currentSpeaker, currentUtterance);
          currentSpeaker = speaker;
          currentUtterance = fullText;
        } else {
          currentSpeaker = speaker || "You";
          currentUtterance = fullText;
        }

        // Debounce finalization: when speech pauses for 1200ms, finalize cue
        clearTimeout(finalizeTimer);
        finalizeTimer = setTimeout(() => {
          if (currentUtterance && currentUtterance !== lastCommittedText) {
            commitCue(currentSpeaker, currentUtterance);
          }
        }, 1200);
      });
    } else {
      // Also check fallback: container with role="region" or aria-label containing "captions"
      const fallbackContainer = document.querySelector("div[aria-label*='captions' i]");
      if (fallbackContainer && fallbackContainer.innerText) {
        const text = fallbackContainer.innerText.trim();
        if (!isSystemNotification(text) && text !== lastCommittedText && text.length > 2) {
          isCaptionsActive = true;
          updateBadgeStatus(true, "Capturing captions");
          clearTimeout(finalizeTimer);
          finalizeTimer = setTimeout(() => {
            commitCue("Speaker", text);
          }, 1200);
        }
      }
    }
  }

  function handleMeetingEnded() {
    if (!isMeetingActive) return;
    isMeetingActive = false;
    isCaptionsActive = false;

    // Finalize any remaining speech in flight
    if (currentUtterance && currentUtterance !== lastCommittedText) {
      commitCue(currentSpeaker || "You", currentUtterance);
    }

    console.log("[ActionPulse] Google Meet ended detected. Stopping session.");
    updateBadgeStatus(false, "Meeting Ended • Ready to Upload");

    try {
      chrome.runtime.sendMessage({
        type: "MEETING_ENDED",
        data: {
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    } catch (e) {
      console.warn("[ActionPulse] Meeting ended send error:", e);
    }
  }

  function initCaptionObserver() {
    createStatusBadge();

    // Attach unload listeners to detect user closing or leaving call
    window.addEventListener("beforeunload", handleMeetingEnded);
    window.addEventListener("pagehide", handleMeetingEnded);

    // Watch for leave call button click
    document.addEventListener("click", (e) => {
      const target = e.target;
      if (
        target?.closest?.("button[aria-label*='Leave' i]") ||
        target?.closest?.("button[jsname='CQylAd']") ||
        target?.closest?.("[data-call-ended]")
      ) {
        setTimeout(handleMeetingEnded, 500);
      }
    });

    // 1. MutationObserver on document.body for instant reactive triggers
    observer = new MutationObserver(() => {
      scanGoogleMeetCaptions();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // 2. High-frequency scanner (every 350ms) to ensure no streaming cue is missed
    pollInterval = setInterval(scanGoogleMeetCaptions, 350);

    console.log("[ActionPulse] Google Meet caption capture engine started.");
  }

  // Communication with popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_PLATFORM_STATUS") {
      sendResponse({
        active: isMeetingActive,
        platform: PLATFORM,
        captionsActive: isCaptionsActive,
        title: getMeetingTitle(),
        conferenceUrl: window.location.href,
      });
    }
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(initCaptionObserver, 1000);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(initCaptionObserver, 1000));
  }
})();
