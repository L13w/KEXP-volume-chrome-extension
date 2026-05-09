(function () {
  "use strict";

  const POLL_INTERVAL = 500;
  const POLL_TIMEOUT = 30000;

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
