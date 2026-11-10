/**
 * ActionPulse - Microsoft Teams Realtime Caption Capture & Lifecycle Engine
 * 
 * Captures live speech from Microsoft Teams web closed captions, filters out
 * non-speech notifications, and tracks call start/end states.
 */

(function () {
  console.log("[ActionPulse] Microsoft Teams content script active.");

  const PLATFORM = "teams";
  let observer = null;
  let pollInterval = null;
  let isMeetingActive = false;
  let isCaptionsActive = false;

  let currentSpeaker = "";
  let currentUtterance = "";
  let lastCommittedText = "";
  let finalizeTimer = null;

  let statusBadge = null;

  const SYSTEM_ALERT_PATTERNS = [
    /you've left the call/i,
    /you left the meeting/i,
    /recording has started/i,
    /transcription has started/i,
    /transcription has stopped/i,
    /joining/i,
    /connecting/i,
    /network quality/i,
  ];

  function isSystemNotification(text) {
    if (!text || text.length < 2) return true;
    return SYSTEM_ALERT_PATTERNS.some((pattern) => pattern.test(text.trim()));
  }

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
    statusBadge.style.padding = "6px 14px";
    statusBadge.style.borderRadius = "20px";
    statusBadge.style.backgroundColor = "rgba(10, 10, 15, 0.95)";
    statusBadge.style.border = "1px solid rgba(99, 102, 241, 0.5)";
    statusBadge.style.boxShadow = "0 4px 14px rgba(0, 0, 0, 0.6)";
    statusBadge.style.color = "#ffffff";
    statusBadge.style.fontFamily = "Inter, -apple-system, system-ui, sans-serif";
    statusBadge.style.fontSize = "12px";
    statusBadge.style.fontWeight = "600";
    statusBadge.style.backdropFilter = "blur(10px)";

    statusBadge.innerHTML = `
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;"></span>
      <span id="actionpulse-teams-badge-text">ActionPulse: Ready (Turn on Teams CC)</span>
    `;

    document.body.appendChild(statusBadge);
  }

  function updateBadgeStatus(active, message) {
    if (!statusBadge) createStatusBadge();
    const dot = statusBadge.querySelector("span:first-child");
    const textEl = document.getElementById("actionpulse-teams-badge-text");
    if (active) {
      dot.style.background = "#10b981";
      dot.style.boxShadow = "0 0 10px #10b981";
      if (textEl) textEl.innerText = message || "ActionPulse: Recording Teams CC";
    } else {
      dot.style.background = "#6366f1";
      dot.style.boxShadow = "0 0 8px #6366f1";
      if (textEl) textEl.innerText = message || "ActionPulse: Ready";
    }
  }

  function getMeetingTitle() {
    const titleEl = document.querySelector(".title-bar, [data-tid='meeting-title'], #callingHeader-title");
    return titleEl?.innerText?.trim() || document.title.replace("- Microsoft Teams", "").trim() || "Microsoft Teams Meeting";
  }

  function commitCue(speaker, text) {
    if (!text || text.length < 2) return;
    if (isSystemNotification(text)) return;
    if (text === lastCommittedText) return;
    lastCommittedText = text;

    try {
      chrome.runtime.sendMessage({
        type: "CAPTION_CUE",
        data: {
          speaker: speaker || "Speaker",
          text: text,
          timestamp: new Date().toISOString(),
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    } catch (e) {
      console.warn("[ActionPulse] Teams cue delivery error:", e);
    }
  }

  function scanTeamsCaptions() {
    const hangupBtn = document.querySelector("button[id*='hangup' i], button[aria-label*='leave' i]");
    const isEnded = document.body.innerText.includes("You've left the call") ||
                    document.body.innerText.includes("You left the meeting");

    if (isEnded && isMeetingActive) {
      handleMeetingEnded();
      return;
    }

    if (hangupBtn && !isMeetingActive) {
      isMeetingActive = true;
      chrome.runtime.sendMessage({
        type: "MEETING_STARTED",
        data: {
          platform: PLATFORM,
          title: getMeetingTitle(),
          conferenceUrl: window.location.href,
        },
      });
    }

    const captionBlocks = document.querySelectorAll(
      "div[data-tid='closed-captions-renderer'], .ui-chat__item, [aria-label*='caption' i]"
    );

    if (captionBlocks && captionBlocks.length > 0) {
      isCaptionsActive = true;
      captionBlocks.forEach((block) => {
        const speakerEl = block.querySelector("[data-tid='closed-caption-speaker'], .ui-chat__message__author");
        const textEl = block.querySelector("[data-tid='closed-caption-text'], .ui-chat__message__content") || block;

        let speaker = speakerEl ? speakerEl.innerText.trim().replace(/:$/, "") : "";
        let fullText = textEl.innerText ? textEl.innerText.trim() : "";

        if (!speaker && fullText.includes(":")) {
          const parts = fullText.split(":");
          speaker = parts[0].trim();
          fullText = parts.slice(1).join(":").trim();
        }

        if (isSystemNotification(fullText)) return;
        if (!fullText || fullText.length < 2) return;

        updateBadgeStatus(true, `Capturing: ${speaker || "Speaker"}`);

        if (speaker !== currentSpeaker && currentUtterance) {
          commitCue(currentSpeaker, currentUtterance);
          currentSpeaker = speaker;
          currentUtterance = fullText;
        } else {
          currentSpeaker = speaker || "Speaker";
          currentUtterance = fullText;
        }

        clearTimeout(finalizeTimer);
        finalizeTimer = setTimeout(() => {
          if (currentUtterance && currentUtterance !== lastCommittedText) {
            commitCue(currentSpeaker, currentUtterance);
          }
        }, 1200);
      });
    }
  }

  function handleMeetingEnded() {
    if (!isMeetingActive) return;
    isMeetingActive = false;
    isCaptionsActive = false;

    if (currentUtterance && currentUtterance !== lastCommittedText) {
      commitCue(currentSpeaker || "Speaker", currentUtterance);
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
      console.warn("[ActionPulse] Teams meeting ended send error:", e);
    }
  }

  function initCaptionObserver() {
    createStatusBadge();

    window.addEventListener("beforeunload", handleMeetingEnded);
    window.addEventListener("pagehide", handleMeetingEnded);

    document.addEventListener("click", (e) => {
      const target = e.target;
      if (target?.closest?.("button[id*='hangup' i]") || target?.closest?.("button[aria-label*='leave' i]")) {
        setTimeout(handleMeetingEnded, 500);
      }
    });

    observer = new MutationObserver(() => scanTeamsCaptions());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    pollInterval = setInterval(scanTeamsCaptions, 350);
  }

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
