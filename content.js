(function () {
  "use strict";

  const POLL_INTERVAL = 500;
  const POLL_TIMEOUT = 30000;
  const STORAGE_KEY = "kexp_volume_state";

  let player = null;

  // ── Player Detection ─────────────────────────────────────────────────

  function getPlayer() {
    try {
      if (typeof jwplayer === "function") {
        const p = jwplayer();
        if (p && typeof p.setVolume === "function") return p;
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

  function iconVolHigh() {
    return '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/><path d="M19 12c0 3.53-2.04 6.58-5 8.03v2.05c4.01-1.54 6.83-5.36 6.83-10.08S18.01 3.46 14 1.92v2.05c2.96 1.46 5 4.5 5 8.03z"/></svg>';
  }

  function iconVolLow() {
    return '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>';
  }

  function iconVolMute() {
    return '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3z"/><line x1="18" y1="9" x2="24" y2="15" stroke="#fff" stroke-width="2"/><line x1="24" y1="9" x2="18" y2="15" stroke="#fff" stroke-width="2"/></svg>';
  }

  function getSpeakerIcon(volume, muted) {
    if (muted || volume === 0) return iconVolMute();
    if (volume <= 50) return iconVolLow();
    return iconVolHigh();
  }

  function getIconState(volume, muted) {
    if (muted || volume === 0) return "mute";
    if (volume <= 50) return "low";
    return "high";
  }

  // ── Build UI ─────────────────────────────────────────────────────────

  function createVolumeControl() {
    const wrap = document.createElement("div");
    wrap.className = "kexp-vol-wrap";

    const btn = document.createElement("button");
    btn.className = "kexp-vol-btn";
    btn.title = "Mute";
    btn.innerHTML = iconVolHigh();

    const slider = document.createElement("div");
    slider.className = "kexp-vol-slider";
    slider.setAttribute("role", "slider");
    slider.setAttribute("aria-label", "Volume");
    slider.setAttribute("aria-valuemin", "0");
    slider.setAttribute("aria-valuemax", "100");
    slider.setAttribute("aria-valuenow", "100");
    slider.tabIndex = 0;

    const track = document.createElement("div");
    track.className = "kexp-vol-track";

    const fill = document.createElement("div");
    fill.className = "kexp-vol-fill";

    const thumb = document.createElement("div");
    thumb.className = "kexp-vol-thumb";

    slider.appendChild(track);
    slider.appendChild(fill);
    slider.appendChild(thumb);

    wrap.appendChild(btn);
    wrap.appendChild(slider);

    return { wrap, btn, slider, fill, thumb };
  }

  // ── Find Player Bar & Inject ─────────────────────────────────────────

  function findPlayButton() {
    // Target the specific KEXP play/pause button by its data attribute
    const btn = document.querySelector("button[data-play-button]");
    if (btn) return btn;

    // Fallback: target by class name
    const ctaBtn = document.querySelector("button.Player-ctaButton");
    if (ctaBtn) return ctaBtn;

    return null;
  }

  function injectVolumeControl(ui) {
    const playBtn = findPlayButton();
    if (!playBtn) return false;

    if (document.querySelector(".kexp-vol-wrap")) return true;

    // The play button lives in div.Player-cta (inline-block, text-align: center).
    // Just append the volume control after the button — it will naturally
    // appear below it and inherit the parent's center alignment.
    const parent = playBtn.parentElement;
    if (parent) {
      parent.insertBefore(ui.wrap, playBtn.nextSibling);
      return true;
    }
    return false;
  }

  // ── Volume State & Persistence ───────────────────────────────────────

  let currentVolume = 100;
  let isMuted = false;
  let preMuteVolume = 100;
  let lastIconState = null;

  function updateUI(ui) {
    const pct = currentVolume + "%";
    ui.fill.style.width = pct;
    ui.thumb.style.left = pct;

    const iconState = getIconState(currentVolume, isMuted);
    if (iconState !== lastIconState) {
      ui.btn.innerHTML = getSpeakerIcon(currentVolume, isMuted);
      lastIconState = iconState;
    }

    ui.btn.title = isMuted ? "Unmute" : "Mute";
    ui.wrap.classList.toggle("muted", isMuted);
    ui.slider.setAttribute("aria-valuenow", currentVolume.toString());
  }

  function applyVolume() {
    if (!player) return;
    player.setVolume(currentVolume);
    player.setMute(isMuted);
  }

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ volume: currentVolume, muted: isMuted })
      );
    } catch (e) {
      // localStorage may be unavailable in some contexts
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw);
        currentVolume = state.volume ?? 100;
        isMuted = state.muted ?? false;
        preMuteVolume = currentVolume > 0 ? currentVolume : 100;
      }
    } catch (e) {
      // corrupted or unavailable
    }
  }

  function setVolumeFromSlider(slider, clientX) {
    const rect = slider.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    currentVolume = pct;
    if (isMuted && pct > 0) {
      isMuted = false;
    }
    preMuteVolume = pct > 0 ? pct : preMuteVolume;
    applyVolume();
  }

  // ── Event Wiring ─────────────────────────────────────────────────────

  function wireEvents(ui) {
    // Mute button click
    ui.btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isMuted) {
        isMuted = false;
        currentVolume = preMuteVolume || 100;
      } else {
        preMuteVolume = currentVolume > 0 ? currentVolume : preMuteVolume;
        isMuted = true;
      }
      applyVolume();
      saveState();
      updateUI(ui);
    });

    // Slider drag — add/remove document listeners dynamically
    function onMouseMove(e) {
      setVolumeFromSlider(ui.slider, e.clientX);
      updateUI(ui);
    }

    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      ui.slider.classList.remove("dragging");
      saveState();
    }

    ui.slider.addEventListener("mousedown", (e) => {
      e.preventDefault();
      ui.slider.classList.add("dragging");
      setVolumeFromSlider(ui.slider, e.clientX);
      updateUI(ui);
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });

    // Scroll wheel
    ui.wrap.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 5 : -5;
        currentVolume = Math.max(0, Math.min(100, currentVolume + delta));
        if (isMuted && currentVolume > 0) isMuted = false;
        preMuteVolume = currentVolume > 0 ? currentVolume : preMuteVolume;
        applyVolume();
        saveState();
        updateUI(ui);
      },
      { passive: false }
    );

    // Keyboard support for slider
    ui.slider.addEventListener("keydown", (e) => {
      let delta = 0;
      if (e.key === "ArrowRight" || e.key === "ArrowUp") delta = 5;
      else if (e.key === "ArrowLeft" || e.key === "ArrowDown") delta = -5;
      else if (e.key === "Home") { currentVolume = 0; delta = null; }
      else if (e.key === "End") { currentVolume = 100; delta = null; }
      else return;

      e.preventDefault();
      if (delta !== null) {
        currentVolume = Math.max(0, Math.min(100, currentVolume + delta));
      }
      if (isMuted && currentVolume > 0) isMuted = false;
      preMuteVolume = currentVolume > 0 ? currentVolume : preMuteVolume;
      applyVolume();
      saveState();
      updateUI(ui);
    });

    // Sync with JW Player events
    player.on("volume", (e) => {
      currentVolume = e.volume;
      preMuteVolume = currentVolume > 0 ? currentVolume : preMuteVolume;
      saveState();
      updateUI(ui);
    });

    player.on("mute", (e) => {
      isMuted = e.mute;
      saveState();
      updateUI(ui);
    });
  }

  // ── Init & MutationObserver ──────────────────────────────────────────

  async function init() {
    try {
      player = await waitForPlayer();
    } catch (e) {
      return;
    }

    loadState();

    const ui = createVolumeControl();
    const injected = injectVolumeControl(ui);
    if (!injected) {
      const observer = new MutationObserver(() => {
        if (injectVolumeControl(ui)) {
          applyVolume();
          updateUI(ui);
          observer.disconnect();
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      applyVolume();
      updateUI(ui);
    }

    wireEvents(ui);

    // Watch for player bar re-renders (SPA navigation), debounced
    let reinjectorTimeout = null;
    const reinjector = new MutationObserver(() => {
      if (reinjectorTimeout) return;
      reinjectorTimeout = setTimeout(() => {
        reinjectorTimeout = null;
        if (!document.querySelector(".kexp-vol-wrap")) {
          injectVolumeControl(ui);
          updateUI(ui);
        }
      }, 500);
    });
    reinjector.observe(document.body, { childList: true, subtree: true });
  }

  init();
})();
