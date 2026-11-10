/**
 * ActionPulse - Popup UI Controller
 * 
 * Coordinates live caption display, 1-click backend upload & AI extraction,
 * manager review gate redirection, and local transcript exports (.vtt/.txt).
 */

document.addEventListener("DOMContentLoaded", async () => {
  // UI Elements
  const platformNameEl = document.getElementById("platformName");
  const statusDotEl = document.getElementById("statusDot");
  const cueCountEl = document.getElementById("cueCount");
  const meetingTimerEl = document.getElementById("meetingTimer");
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

  // Format seconds to MM:SS
  function formatDuration(startTime) {
    if (!startTime) return "00:00";
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const diffSecs = Math.max(0, Math.floor((now - start) / 1000));
    const mins = Math.floor(diffSecs / 60);
    const secs = diffSecs % 60;
    return String(mins).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  // Render rolling captions feed
  function renderCues(cues) {
    if (!cues || cues.length === 0) {
      transcriptFeedEl.innerHTML = `
        <div class="empty-state">
          <p>Captions are currently idle.</p>
          <p class="sub">Turn on Closed Captions (CC) in Google Meet, Zoom, or Teams to automatically start capturing.</p>
        </div>
      `;
      return;
    }

    transcriptFeedEl.innerHTML = "";
    // Show last 15 cues
    const displayCues = cues.slice(-15);
    displayCues.forEach((cue) => {
      const item = document.createElement("div");
      item.className = "cue-item";
      item.innerHTML = `
        <span class="cue-speaker">${escapeHtml(cue.speaker || "Speaker")}:</span>
        <span class="cue-text">${escapeHtml(cue.text || "")}</span>
      `;
      transcriptFeedEl.appendChild(item);
    });

    // Auto-scroll to bottom
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

  // Load and refresh state from service worker
  async function refreshState() {
    chrome.runtime.sendMessage({ type: "GET_STATE" }, (response) => {
      if (!response) return;

      activeSession = response.session;
      const settings = response.settings;

      // Populate settings fields
      if (settings) {
        if (workspaceIdInput) workspaceIdInput.value = settings.workspaceId || "";
        if (apiUrlInput) apiUrlInput.value = settings.apiUrl || "http://localhost:8000";
        if (appUrlInput) appUrlInput.value = settings.appUrl || "http://localhost:5173";
      }

      // Update metrics
      if (cueCountEl) cueCountEl.innerText = String(response.cueCount || 0);

      if (activeSession) {
        renderCues(activeSession.cues);
      }
    });

    // Inspect active tab to detect active meeting platform
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs[0];
      if (!activeTab || !activeTab.url) return;

      const url = activeTab.url;
      let detected = "Standby (No Meeting Tab)";

      if (url.includes("meet.google.com")) {
        detected = "Google Meet (Connected)";
      } else if (url.includes("zoom.us")) {
        detected = "Zoom Web (Connected)";
      } else if (url.includes("teams.microsoft.com") || url.includes("teams.live.com")) {
        detected = "Microsoft Teams (Connected)";
      }

      if (platformNameEl) platformNameEl.innerText = detected;

      // Ping content script on active tab for live CC state
      if (activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: "CHECK_PLATFORM_STATUS" }, (res) => {
          if (chrome.runtime.lastError) {
            // Content script not loaded or not meeting tab
            return;
          }
          if (res && res.captionsActive) {
            statusDotEl.classList.add("pulsing");
            platformNameEl.innerText = `${formatPlatformName(res.platform)}: Captions Active`;
          }
        });
      }
    });
  }

  function formatPlatformName(p) {
    if (p === "google_meet") return "Google Meet";
    if (p === "zoom") return "Zoom";
    if (p === "teams") return "Microsoft Teams";
    return "Meeting";
  }

  // Start timer ticking
  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (activeSession && activeSession.startTime) {
        meetingTimerEl.innerText = formatDuration(activeSession.startTime);
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

      // Success feedback
      resultBanner.classList.remove("hidden");
      resultBanner.classList.remove("error");
      resultContent.innerHTML = `
        <strong>✓ Transcripts Auto-Ingested!</strong><br/>
        <span>${response.segmentCount} segments stored • ${response.extractedItemsCount} tasks generated for review.</span>
      `;

      // Set Manager Review Gate link
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

  // Local File Downloader Helper
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

  // Save WebVTT (.vtt)
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

  // Save Plain Text (.txt)
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

  // Clear Buffer
  clearBufferBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear the current meeting transcript buffer?")) {
      chrome.runtime.sendMessage({ type: "CLEAR_BUFFER" }, () => {
        refreshState();
        resultBanner.classList.add("hidden");
      });
    }
  });

  // Save Settings
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

  // Periodic UI refresh every 2 seconds while popup is open
  await refreshState();
  startTimer();
  setInterval(refreshState, 2000);
});
