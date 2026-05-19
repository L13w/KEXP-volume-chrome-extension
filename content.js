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

  const POLL_MS = 10000;
  const FAIL_THRESHOLD = 5;

  let mode = "idle";          // "idle" | "skip-song" | "skip-block"
  let anchorId = null;
  let lastSeenType = null;
  let pollTimer = null;
  let failCount = 0;
  let wasUnreachable = false;
  let onModeChange = () => {}; // UI hook, set in a later task

  function setMute(value) {
    if (player && typeof player.setMute === "function") {
      player.setMute(value);
    }
  }

  async function tick() {
    const top = await fetchTopPlay();
    if (!top) {
      failCount++;
      if (failCount >= FAIL_THRESHOLD && !wasUnreachable) {
        wasUnreachable = true;
        onModeChange(mode, { unreachable: true });
      }
      return;
    }
    failCount = 0;
    if (wasUnreachable) {
      wasUnreachable = false;
      onModeChange(mode, {});
    }

    if (top.id === anchorId) return;

    if (mode === "skip-song") {
      exitSkipMode();
      return;
    }

    if (mode === "skip-block") {
      const wasAirbreak = lastSeenType === "airbreak";
      const nowTrack = top.play_type === "trackplay";
      if (wasAirbreak && nowTrack) {
        exitSkipMode();
        return;
      }
      anchorId = top.id;
      lastSeenType = top.play_type;
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(tick, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  async function enterSkipMode(nextMode) {
    // Mute synchronously so the click feels instant, even on slow networks.
    setMute(true);
    const top = await fetchTopPlay();
    if (!top) {
      setMute(false);             // can't anchor; revert
      return;
    }
    mode = nextMode;
    anchorId = top.id;
    lastSeenType = top.play_type;
    failCount = 0;
    wasUnreachable = false;
    startPolling();
    onModeChange(mode, {});
  }

  function exitSkipMode() {
    mode = "idle";
    anchorId = null;
    lastSeenType = null;
    failCount = 0;
    wasUnreachable = false;
    stopPolling();
    setMute(false);
    onModeChange(mode, {});
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

  // ── SVG Icons ────────────────────────────────────────────────────────

  function iconSkipOne() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>' +
      '<line x1="14" y1="8" x2="20" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="20" y1="8" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<polyline points="22,8 22,16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  function iconSkipMany() {
    return '<svg viewBox="0 0 28 24" aria-hidden="true">' +
      '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>' +
      '<line x1="14" y1="8" x2="20" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="20" y1="8" x2="14" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      '<polyline points="22,8 22,16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<polyline points="26,8 26,16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '</svg>';
  }

  // ── Build UI ─────────────────────────────────────────────────────────

  function createSkipButtons() {
    const wrap = document.createElement("div");
    wrap.className = "kexp-skip-wrap";

    const songBtn = document.createElement("button");
    songBtn.className = "kexp-skip-btn kexp-skip-song";
    songBtn.type = "button";
    songBtn.title = "Mute until the next playlist entry begins";
    songBtn.innerHTML = iconSkipOne() + '<span>SKIP SONG</span>';

    const blockBtn = document.createElement("button");
    blockBtn.className = "kexp-skip-btn kexp-skip-block";
    blockBtn.type = "button";
    blockBtn.title = "Mute through the rest of this block and the next air break";
    blockBtn.innerHTML = iconSkipMany() + '<span>SKIP BLOCK</span>';

    wrap.appendChild(songBtn);
    wrap.appendChild(blockBtn);
    return { wrap, songBtn, blockBtn };
  }

  function injectSkipButtons(ui) {
    if (document.querySelector(".kexp-skip-wrap")) return true;
    const toggle = document.querySelector(".PlayerControlTray-toggle");
    if (!toggle || !toggle.parentNode) return false;
    toggle.parentNode.insertBefore(ui.wrap, toggle);
    return true;
  }

  function wireButtons(ui) {
    function onClick(targetMode) {
      return (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (mode === targetMode) {
          exitSkipMode();
        } else if (mode === "idle") {
          enterSkipMode(targetMode);
        } else {
          // Switch from one active mode to the other; stay muted.
          // exitSkipMode unmutes, so do an in-place switch instead.
          switchSkipMode(targetMode);
        }
      };
    }
    ui.songBtn.addEventListener("click", onClick("skip-song"));
    ui.blockBtn.addEventListener("click", onClick("skip-block"));
  }

  async function switchSkipMode(nextMode) {
    const top = await fetchTopPlay();
    if (!top) return;
    mode = nextMode;
    anchorId = top.id;
    lastSeenType = top.play_type;
    failCount = 0;
    wasUnreachable = false;
    // Already muted and polling; no setMute or startPolling needed.
    onModeChange(mode, {});
  }

  function renderModeChange(ui) {
    return (currentMode, flags) => {
      ui.songBtn.classList.toggle("active", currentMode === "skip-song");
      ui.blockBtn.classList.toggle("active", currentMode === "skip-block");
      const unreachable = !!(flags && flags.unreachable);
      ui.songBtn.classList.toggle("unreachable", unreachable && currentMode === "skip-song");
      ui.blockBtn.classList.toggle("unreachable", unreachable && currentMode === "skip-block");
      if (unreachable) {
        const which = currentMode === "skip-song" ? ui.songBtn : ui.blockBtn;
        which.title = "Playlist unreachable — click to cancel and unmute";
      } else {
        ui.songBtn.title = "Mute until the next playlist entry begins";
        ui.blockBtn.title = "Mute through the rest of this block and the next air break";
      }
    };
  }

  // ── Init ─────────────────────────────────────────────────────────────

  async function init() {
    try {
      player = await waitForPlayer();
    } catch (e) {
      return;
    }

    const ui = createSkipButtons();
    wireButtons(ui);
    onModeChange = renderModeChange(ui);

    if (!injectSkipButtons(ui)) {
      const obs = new MutationObserver(() => {
        if (injectSkipButtons(ui)) obs.disconnect();
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }

    // Re-inject on SPA navigation, debounced.
    let reTimer = null;
    const reObs = new MutationObserver(() => {
      if (reTimer) return;
      reTimer = setTimeout(() => {
        reTimer = null;
        if (!document.querySelector(".kexp-skip-wrap")) {
          injectSkipButtons(ui);
        }
      }, 500);
    });
    reObs.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
