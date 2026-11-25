globalThis.ActionPulseMeeting = (() => {
  const names = { google_meet: "Google Meet", zoom: "Zoom", teams: "Microsoft Teams" };

  function platformAt(value) {
    let url;
    try { url = new URL(value); } catch { return null; }
    if (url.protocol !== "https:") return null;
    const host = url.hostname;
    if (host === "meet.google.com") return "google_meet";
    if (host === "zoom.us" || host.endsWith(".zoom.us")) return "zoom";
    if (["teams.microsoft.com", "teams.live.com", "teams.cloud.microsoft"].includes(host)) return "teams";
    return null;
  }

  function identify(value) {
    const platform = platformAt(value);
    if (!platform) return null;
    const url = new URL(value);
    let path = url.pathname.replace(/\/$/, "");
    let key;
    if (platform === "google_meet") {
      if (!/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(path)) return null;
      key = path;
    } else if (platform === "zoom") {
      const meeting = path.match(/^\/(?:j|wc\/(?:join\/)?)(\d+)(?:\/|$)/);
      if (!meeting) return null;
      key = meeting[1];
      path = "/j/" + key;
    } else {
      if (!path || /\/(?:meeting-ended|postmeeting)(?:\/|$)/i.test(path)) return null;
      key = path;
    }
    return { platform, key: platform + ":" + key, url: url.origin + path };
  }

  function statusCopy(state) {
    switch (state.phase) {
      case "capturing": return state.cueCount
        ? { heading: "Capturing captions", description: "Keep captions on until the call ends." }
        : { heading: "Waiting for captions", description: "Turn on live captions in the call to start capturing." };
      case "uploading": return { heading: "Saving captions", description: "Your meeting has ended. ActionPulse is saving the transcript." };
      case "processing": return { heading: "Preparing suggested tasks", description: "ActionPulse is finding action items in the transcript.", action: "Open meeting" };
      case "ready": return { heading: "Review suggested tasks", description: "Check the suggestions and assign them to participants.", action: "Review tasks" };
      case "failed": return { heading: "Task extraction needs attention", description: state.error || "Your transcript is saved. Retry extraction from the meeting.", action: "Open meeting" };
      case "empty": return { heading: "No captions captured", description: "Your meeting is saved. You can add an exported transcript.", action: "Add transcript" };
      default: return { heading: "Captions need attention", description: state.error || "Open the extension to retry the upload or download the transcript." };
    }
  }

  function isId(value) {
    return typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
  }

  function captionCount(count) {
    return `${count} ${count === 1 ? "caption" : "captions"}`;
  }

  return { names, platformAt, identify, isId, statusCopy, captionCount };
})();
