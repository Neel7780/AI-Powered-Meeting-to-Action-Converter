/**
 * ActionPulse - Popup UI Controller
 * 
 * Accurately displays live call state, captures spoken closed captions,
 * freezes duration when call ends, and provides 1-click upload to the Manager Review Gate.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const platformNameEl = document.getElementById("platformName");
  const statusDotEl = document.getElementById("statusDot");
  const meetingTimerEl = document.getElementById("meetingTimer");
  const cueCountStatEl = document.getElementById("cueCountStat");
  const sessionStateTagEl = document.getElementById("sessionStateTag");
  const transcriptFeedEl = document.getElementById("transcriptFeed");
  const clearBufferBtn = document.getElementById("clearBufferBtn");

  const uploadBtn = document.getElementById("uploadBtn");
  const saveVttBtn = document.getElementById("saveVttBtn");
  const saveTxtBtn = document.getElementById("saveTxtBtn");

  const resultBanner = document.getElementById("resultBanner");
  const resultContent = document.getElementById("resultContent");
  const reviewGateLink = document.getElementById("reviewGateLink");

  const workspaceIdInput = document.getElementById("workspaceIdInput");
  const apiUrlInput = document.getElementById("apiUrlInput");
  const appUrlInput = document.getElementById("appUrlInput");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");

  let activeSession = null;
  let timerInterval = null;

  // Format seconds into MM:SS
  function formatSecs(totalSecs) {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  // Calculate duration string
  function getDurationDisplay(session) {
    if (!session || !session.startTime) return "00:00";
    if (session.isCompleted || (!session.isRecording && session.endTime)) {
      const start = new Date(session.startTime).getTime();
      const end = new Date(session.endTime).getTime();
      const diffSecs = Math.max(0, Math.floor((end - start) / 1000));
      return formatSecs(diffSecs);
    }
    if (session.isRecording) {
      const start = new Date(session.startTime).getTime();
      const diffSecs = Math.max(0, Math.floor((Date.now() - start) / 1000));
      return formatSecs(diffSecs);
    }
    return "00:00";
  }

  function renderCues(cues) {
    if (!cues || cues.length === 0) {
      transcriptFeedEl.innerHTML = `
        <div class="empty-state">
          <p>Captions are currently idle.</p>
          <p class="sub">Turn on Closed Captions (CC) in Google Meet, Zoom, or Teams to automatically capture live speech.</p>
        </div>
      `;
      return;
    }

    transcriptFeedEl.innerHTML = "";
    const displayCues = cues.slice(-20);
    displayCues.forEach((cue) => {
      const item = document.createElement("div");
      item.className = "cue-item";
      item.innerHTML = `
        <span class="cue-speaker">${escapeHtml(cue.speaker || "You")}:</span>
        <span class="cue-text">${escapeHtml(cue.text || "")}</span>
      `;
      transcriptFeedEl.appendChild(item);
    });

    transcriptFeedEl.scrollTop = transcriptFeedEl.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatPlatformTitle(p) {
    if (p === "google_meet") return "Google Meet";
    if (p === "zoom") return "Zoom Web";
    if (p === "teams") return "Microsoft Teams";
    return "Meeting";
  }

  async function refreshState() {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (!response) return;

      activeSession = response.session;
      const settings = response.settings;

      if (settings) {
        if (workspaceIdInput) workspaceIdInput.value = settings.workspaceId || "";
        if (apiUrlInput) apiUrlInput.value = settings.apiUrl || "http://localhost:8000";
        if (appUrlInput) appUrlInput.value = settings.appUrl || "http://localhost:5173";
      }

      const cueCount = response.cueCount || 0;
      if (cueCountStatEl) {
        cueCountStatEl.innerText = `${cueCount} caption${cueCount === 1 ? "" : "s"} captured`;
      }

      if (activeSession) {
        renderCues(activeSession.cues);
        if (meetingTimerEl) {
          meetingTimerEl.innerText = getDurationDisplay(activeSession);
        }
      }
    });

    // Inspect active browser tab for real-time meeting status
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      const url = activeTab?.url || "";

      let isMeetingTab = false;
      let platformLabel = "Standby (No Meeting)";

      if (url.includes("meet.google.com")) {
        isMeetingTab = true;
        platformLabel = "Google Meet";
      } else if (url.includes("zoom.us")) {
        isMeetingTab = true;
        platformLabel = "Zoom Web";
      } else if (url.includes("teams.microsoft.com") || url.includes("teams.live.com")) {
        isMeetingTab = true;
        platformLabel = "Microsoft Teams";
      }

      if (activeTab?.id && isMeetingTab) {
        chrome.tabs.sendMessage(activeTab.id, { type: "CHECK_PLATFORM_STATUS" }, (res) => {
          if (chrome.runtime.lastError || !res) {
            handleTabState(isMeetingTab, platformLabel, false, false);
            return;
          }
          handleTabState(isMeetingTab, formatPlatformTitle(res.platform), res.active, res.captionsActive);
        });
      } else {
        handleTabState(isMeetingTab, platformLabel, false, false);
      }
    });
  }

  function handleTabState(isMeetingTab, platformLabel, isCallActive, isCaptionsActive) {
    if (!statusDotEl || !platformNameEl || !sessionStateTagEl) return;

    statusDotEl.className = "status-dot";
    sessionStateTagEl.className = "status-tag";

    if (activeSession?.isCompleted) {
      statusDotEl.classList.add("ended");
      platformNameEl.innerText = `${platformLabel}: Call Ended`;
      sessionStateTagEl.innerText = "Call Completed";
      sessionStateTagEl.classList.add("ended");
    } else if (isCallActive) {
      statusDotEl.classList.add(isCaptionsActive ? "pulsing" : "active");
      platformNameEl.innerText = isCaptionsActive
        ? `${platformLabel}: Captions Active`
        : `${platformLabel}: In Call`;
      sessionStateTagEl.innerText = isCaptionsActive ? "Recording Live" : "Call Active (Turn on CC)";
      sessionStateTagEl.classList.add("active");
    } else if (isMeetingTab) {
      platformNameEl.innerText = `${platformLabel}: Ready`;
      sessionStateTagEl.innerText = "Meeting Ready";
    } else {
      platformNameEl.innerText = "Standby (No Meeting)";
      sessionStateTagEl.innerText = "Standby";
      if (!activeSession?.startTime) {
        meetingTimerEl.innerText = "00:00";
      }
    }
  }

  function startTimerLoop() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (activeSession && activeSession.isRecording && !activeSession.isCompleted) {
        meetingTimerEl.innerText = getDurationDisplay(activeSession);
      }
    }, 1000);
  }

  // 1-Click Upload to Backend & AI Extraction
  uploadBtn.addEventListener("click", () => {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `
      <span style="display:inline-block;width:12px;height:12px;border:2px solid white;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></span>
      <span>Uploading & Parsing with AI...</span>
    `;

    resultBanner.classList.add("hidden");
    resultBanner.classList.remove("error");

    chrome.runtime.sendMessage({ type: "UPLOAD_TO_BACKEND" }, (response) => {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <span>Upload & Generate AI Tasks</span>
      `;

      if (!response || !response.success) {
        resultBanner.classList.remove("hidden");
        resultBanner.classList.add("error");
        resultContent.innerHTML = `
          <strong>Upload Error:</strong> ${escapeHtml(response?.error || "Could not connect to backend.")}<br/>
          <small>Tip: You can use "Save Backup (.VTT)" below to preserve your transcript locally.</small>
        `;
        reviewGateLink.classList.add("hidden");
        return;
      }

      resultBanner.classList.remove("hidden");
      resultBanner.classList.remove("error");
      resultContent.innerHTML = `
        <strong>✓ Transcripts Ingested & Parsed!</strong><br/>
        <span>${response.segmentCount} segments saved • ${response.extractedItemsCount} tasks generated for review.</span>
      `;

      if (response.reviewUrl) {
        reviewGateLink.href = response.reviewUrl;
        reviewGateLink.classList.remove("hidden");
        reviewGateLink.onclick = (e) => {
          e.preventDefault();
          chrome.tabs.create({ url: response.reviewUrl });
        };
      }
    });
  });

  function triggerDownload(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  saveVttBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_TRANSCRIPT_EXPORT" }, (res) => {
      if (!res || !res.vtt) {
        alert("No transcript cues available in buffer to export.");
        return;
      }
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `ActionPulse-${res.title || "Meeting"}-${dateStr}.vtt`;
      triggerDownload(res.vtt, filename, "text/vtt;charset=utf-8");
    });
  });

  saveTxtBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "GET_TRANSCRIPT_EXPORT" }, (res) => {
      if (!res || !res.txt) {
        alert("No transcript cues available in buffer to export.");
        return;
      }
      const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const filename = `ActionPulse-${res.title || "Meeting"}-${dateStr}.txt`;
      triggerDownload(res.txt, filename, "text/plain;charset=utf-8");
    });
  });

  clearBufferBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the current transcript buffer?")) {
      chrome.runtime.sendMessage({ type: "CLEAR_BUFFER" }, () => {
        refreshState();
        resultBanner.classList.add("hidden");
      });
    }
  });

  saveSettingsBtn.addEventListener("click", () => {
    const settings = {
      workspaceId: workspaceIdInput.value.trim(),
      apiUrl: apiUrlInput.value.trim(),
      appUrl: appUrlInput.value.trim(),
    };
    chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", data: settings }, () => {
      saveSettingsBtn.innerText = "Saved ✓";
      setTimeout(() => {
        saveSettingsBtn.innerText = "Save Configuration";
      }, 1500);
    });
  });

  await refreshState();
  startTimerLoop();
  setInterval(refreshState, 1500);
});
