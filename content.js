(function () {
  "use strict";

  const POLL_INTERVAL = 500;
  const POLL_TIMEOUT = 30000;

  const PLAYLIST_URL = "https://api.kexp.org/v2/plays/?limit=1";

  async function fetchTopPlay() {
    try {
      const res = await fetch(PLAYLIST_URL, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      const top = data && data.results && data.results[0];
      if (!top) return null;
      return { id: top.id, play_type: top.play_type };
    } catch (e) {
      return null;
    }
  }

  let player = null;

  // ── Player Detection ─────────────────────────────────────────────────

  function getPlayer() {
    try {
      if (typeof jwplayer === "function") {
        const p = jwplayer();
        if (p && typeof p.setMute === "function") return p;
      }
    } catch (e) {
      // not ready yet
    }
    return null;
  }

  function waitForPlayer() {
    return new Promise((resolve, reject) => {
      const p = getPlayer();
      if (p) return resolve(p);

      let elapsed = 0;
      const timer = setInterval(() => {
        elapsed += POLL_INTERVAL;
        const p = getPlayer();
        if (p) {
          clearInterval(timer);
          resolve(p);
        } else if (elapsed >= POLL_TIMEOUT) {
          clearInterval(timer);
          reject(new Error("JW Player not found"));
        }
      }, POLL_INTERVAL);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────

  async function init() {
    try {
      player = await waitForPlayer();
    } catch (e) {
      return;
    }
    // UI and state machine come in later tasks.
  }

  init();
})();
