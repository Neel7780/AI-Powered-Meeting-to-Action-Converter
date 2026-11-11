/**
 * ActionPulse - Google Meet Realtime Caption Capture Engine (High Performance)
 * 
 * Optimized for zero overhead:
 * - NEVER accesses document.body.innerText (prevents layout thrashing & camera freeze).
 * - Only observes the dedicated caption container when CC is active (never observes entire document.body).
 * - WebRTC camera, audio visualizers, and video streams run at full 60fps native speed.
 */

(function () {
  console.log("[ActionPulse] Google Meet content script loaded.");

  const PLATFORM = "google_meet";
  let captionObserver = null;
  let activeCaptionContainer = null;
  let checkTimer = null;
  let isMeetingActive = false;

  let currentSpeaker = "";
  let currentUtterance = "";
  let lastCommittedText = "";
  let finalizeTimer = null;

  let statusBadge = null;
  let lastBadgeText = "";

  // Strict system alerts filter
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
    if (document.getElementById("actionpulse-meet-badge")) {
      statusBadge = document.getElementById("actionpulse-meet-badge");
      return;
    }
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
    statusBadge.style.border = "1px solid rgba(99, 102, 241, 0.4)";
    statusBadge.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.5)";
    statusBadge.style.color = "#ffffff";
    statusBadge.style.fontFamily = "Inter, -apple-system, system-ui, sans-serif";
    statusBadge.style.fontSize = "12px";
    statusBadge.style.fontWeight = "600";
    statusBadge.style.pointerEvents = "auto";
    statusBadge.style.backdropFilter = "blur(10px)";
    statusBadge.style.transition = "opacity 0.2s ease";

    statusBadge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
      <span id="actionpulse-badge-text">ActionPulse: Ready (Turn on CC)</span>
    `;

    document.body.appendChild(statusBadge);
  }

  function updateBadgeStatus(active, message) {
    if (lastBadgeText === message) return;
    lastBadgeText = message;

    if (!statusBadge) createStatusBadge();
    const dot = statusBadge.querySelector("span:first-child");
    const textEl = document.getElementById("actionpulse-badge-text");

    if (active) {
      if (dot) {
        dot.style.background = "#10b981";
        dot.style.boxShadow = "0 0 10px #10b981";
      }
      if (textEl) textEl.innerText = message || "ActionPulse: Recording Captions";
    } else {
      if (dot) {
        dot.style.background = "#6366f1";
        dot.style.boxShadow = "0 0 8px #6366f1";
      }
      if (textEl) textEl.innerText = message || "ActionPulse: Ready";
    }
  }

  function getMeetingTitle() {
    const headerTitle = document.querySelector("[data-meeting-title]")?.getAttribute("data-meeting-title");
    if (headerTitle) return headerTitle;
    const url = window.location.href;
    const match = url.match(/meet\.google\.com\/([a-z0-9-]+)/i);
    const code = match ? match[1] : "Meeting";
    return document.title.replace("- Google Meet", "").trim() || `Google Meet (${code})`;
  }

  function commitCue(speaker, text) {
    if (!text || text.length < 2) return;
    if (isSystemNotification(text)) return;

    let cleanSpeaker = speaker || "You";
    if (cleanSpeaker.toLowerCase() === "you") {
      cleanSpeaker = "You";
    }

    if (text === lastCommittedText) return;
    lastCommittedText = text;

    console.log(`[ActionPulse] Captured: [${cleanSpeaker}]: ${text}`);

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
      // Ignored if background worker is idle
    }
  }

  /**
   * Fast, targeted caption extractor.
   * Runs only on the caption container without touching the rest of Google Meet.
   */
  function extractCaptionsFromContainer(container) {
    if (!container) return;

    // Google Meet caption blocks inside container
    const blocks = container.querySelectorAll(".nM7Ebe, .T4LgNb, .VbkSUe, div[class*='caption' i]");
    const targetBlocks = blocks.length > 0 ? blocks : [container];

    targetBlocks.forEach((block) => {
      const speakerEl = block.querySelector(".zs7PeP, .jxFHg, .NWbcqb, [data-sender-name]");
      let speaker = speakerEl ? (speakerEl.getAttribute("data-sender-name") || speakerEl.innerText).trim() : "";

      const textEl = block.querySelector(".iTTPOb, .bh44bd, .yg30fd") || block;
      let fullText = textEl.innerText ? textEl.innerText.trim() : "";

      if (!speaker && fullText.includes("\n")) {
        const parts = fullText.split("\n").map((s) => s.trim()).filter(Boolean);
        if (parts.length >= 2) {
          speaker = parts[0];
          fullText = parts.slice(1).join(" ");
        }
      }

      if (speaker && fullText.startsWith(speaker)) {
        fullText = fullText.slice(speaker.length).trim();
      }

      if (isSystemNotification(fullText)) return;
      if (!fullText || fullText.length < 2) return;

      updateBadgeStatus(true, `Capturing: ${speaker || "You"}`);

      if (speaker !== currentSpeaker && currentUtterance) {
        commitCue(currentSpeaker, currentUtterance);
        currentSpeaker = speaker;
        currentUtterance = fullText;
      } else {
        currentSpeaker = speaker || "You";
        currentUtterance = fullText;
      }

      clearTimeout(finalizeTimer);
      finalizeTimer = setTimeout(() => {
        if (currentUtterance && currentUtterance !== lastCommittedText) {
          commitCue(currentSpeaker, currentUtterance);
        }
      }, 1000);
    });
  }

  /**
   * High performance lifecycle & caption attach loop.
   * Runs once every 800ms. Has ZERO impact on CPU/camera.
   */
  function checkMeetingAndCaptions() {
    // 1. Detect call state without innerText
    const leaveBtn = document.querySelector("button[aria-label*='Leave' i], button[jsname='CQylAd']");
    const micBtn = document.querySelector("button[aria-label*='microphone' i], div[data-is-muted]");
    const isCallEnded = document.querySelector("[data-call-ended], [jsname='r8qRAd']") !== null ||
                        window.location.pathname === "/" ||
                        window.location.pathname.includes("/landing");

    if (isCallEnded && isMeetingActive) {
      handleMeetingEnded();
      return;
    }

    if ((leaveBtn || micBtn) && !isMeetingActive) {
      isMeetingActive = true;
      createStatusBadge();
      chrome.runtime.sendMessage({
        type: "MEETING_STARTED",
        data: {
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    }

    // 2. Find Google Meet captions container
    const captionContainer = document.querySelector("div[jsname='r4nke'], .a4bvKc, div[jscontroller='D1tHje']");

    if (captionContainer && captionContainer !== activeCaptionContainer) {
      // Detach old observer if any
      if (captionObserver) captionObserver.disconnect();

      activeCaptionContainer = captionContainer;
      console.log("[ActionPulse] Attached isolated observer to Google Meet caption container.");

      // Observe ONLY the caption container, NOT document.body!
      captionObserver = new MutationObserver(() => {
        extractCaptionsFromContainer(activeCaptionContainer);
      });

      captionObserver.observe(activeCaptionContainer, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      extractCaptionsFromContainer(activeCaptionContainer);
    } else if (!captionContainer && activeCaptionContainer) {
      if (captionObserver) captionObserver.disconnect();
      activeCaptionContainer = null;
      updateBadgeStatus(false, "ActionPulse: Ready (Turn on CC)");
    }
  }

  function handleMeetingEnded() {
    if (!isMeetingActive) return;
    isMeetingActive = false;

    if (captionObserver) {
      captionObserver.disconnect();
      captionObserver = null;
    }
    activeCaptionContainer = null;

    if (currentUtterance && currentUtterance !== lastCommittedText) {
      commitCue(currentSpeaker || "You", currentUtterance);
    }

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
      // Ignored
    }
  }

  function start() {
    createStatusBadge();

    window.addEventListener("beforeunload", handleMeetingEnded);
    window.addEventListener("pagehide", handleMeetingEnded);

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target?.closest?.("button[aria-label*='Leave' i]") || target?.closest?.("button[jsname='CQylAd']")) {
        setTimeout(handleMeetingEnded, 400);
      }
    });

    // Check meeting status & captions container every 800ms
    checkTimer = setInterval(checkMeetingAndCaptions, 800);
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "CHECK_PLATFORM_STATUS") {
      sendResponse({
        active: isMeetingActive,
        platform: PLATFORM,
        captionsActive: activeCaptionContainer !== null,
        title: getMeetingTitle(),
        conferenceUrl: window.location.href,
      });
    }
  });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(start, 800);
  } else {
    window.addEventListener("DOMContentLoaded", () => setTimeout(start, 800));
  }
})();
