// Share the configured ActionPulse site’s current access token with the extension worker.
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
              userId: session.user?.id || "",
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
      userId: "",
    };
  }

  let lastSignature = "";

  function syncContext(force = false) {
    try {
      if (!chrome?.runtime?.id) return;
      const auth = findSupabaseSession();
      const payload = {
        accessToken: auth.accessToken,
        tokenExpiresAt: auth.expiresAt,
        userId: auth.userId,
        userEmail: auth.userEmail,
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

  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message.type !== "READ_ACTIONPULSE_AUTH" || sender.id !== chrome.runtime.id) return;
    const { accessToken, expiresAt, userId, userEmail } = findSupabaseSession();
    respond({ accessToken, tokenExpiresAt: expiresAt, userId, userEmail });
  });

  syncContext(true);

  window.addEventListener("storage", () => syncContext(true));
  window.addEventListener("actionpulse:workspace-changed", () => syncContext(true));
  window.addEventListener("focus", () => syncContext(false));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) syncContext(false);
  });

  setInterval(() => syncContext(false), 2500);
})();

