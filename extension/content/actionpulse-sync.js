/**
 * ActionPulse Web App -> Chrome Extension Context Sync
 *
 * Syncs the authenticated user's Supabase JWT access token, active workspace ID,
 * workspace name, and manager role (admin/organiser) into chrome.storage.local
 * so the extension performs real authenticated uploads without dev tokens.
 */
(function () {
  if (window.__actionPulseSyncInjected) return;
  window.__actionPulseSyncInjected = true;

  function findSupabaseSession() {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && /^sb-.*-auth-token$/.test(key)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || "null");
          const session = parsed?.currentSession || parsed;
          if (session && typeof session.access_token === "string") {
            return {
              accessToken: session.access_token,
              expiresAt: Number(session.expires_at || 0),
              userEmail: session.user?.email || "",
            };
          }
        } catch {
          // Ignore malformed localStorage entries
        }
      }
    }
    return {
      accessToken: "",
      expiresAt: 0,
      userEmail: "",
    };
  }

  let lastSignature = "";

  function syncContext(force = false) {
    try {
      if (!chrome?.runtime?.id) return;
      const auth = findSupabaseSession();
      const workspaceId = localStorage.getItem("currentWorkspaceId") || "";
      const workspaceName = localStorage.getItem("currentWorkspaceName") || "";
      const managerRole = localStorage.getItem("currentWorkspaceRole") || "";

      const payload = {
        appUrl: window.location.origin,
        accessToken: auth.accessToken,
        tokenExpiresAt: auth.expiresAt,
        userEmail: auth.userEmail,
        workspaceId,
        workspaceName,
        managerRole,
      };

      const signature = JSON.stringify(payload);
      if (!force && signature === lastSignature) return;
      lastSignature = signature;

      chrome.runtime.sendMessage(
        { type: "SYNC_AUTH_CONTEXT", data: payload },
        () => {
          void chrome.runtime.lastError;
        }
      );
    } catch {
      // Extension context may be invalidated during reload
    }
  }

  syncContext(true);

  window.addEventListener("storage", () => syncContext(true));
  window.addEventListener("actionpulse:workspace-changed", () => syncContext(true));
  window.addEventListener("focus", () => syncContext(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncContext(false);
  });

  setInterval(() => syncContext(false), 2500);
})();

