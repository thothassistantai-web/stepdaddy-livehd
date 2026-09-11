/**
 * Smart TV ↔ Music audio focus (Auto focus Music ↔ TV).
 * Default ON (localStorage sd_music_tv_audio_smart). Toggle in Settings → Playback.
 *
 * When ON:
 *  - Music focus (play / sheet open / dock expand / Music zone pointer) → mute+pause live TV
 *    via Media Session release path; short crossfade on volumes.
 *  - Music Stop + TV reclaim → unmute and jump-to-live (not stale buffer).
 * When OFF: both may play; Media Session ownership still updates but TV is not paused.
 *
 * Party: does not fight active speech-duck (partyHoldingDuck) — leaves TV near duck level.
 * Dynamic focus uses the same zones as Media Session (sheet, dock, TV chrome).
 */
(function () {
  if (window.SDMusicTvAudio) return;

  var LS = "sd_music_tv_audio_smart";
  var FADE_MS = 480;
  var TV_DUCK = 0.06;
  var MUSIC_DUCK = 0.1;
  var focus = "tv"; // 'music' | 'tv'
  var tvBase = null;
  var musicBase = null;
  var fadeToken = 0;
  var enabled = true;

  function readEnabled() {
    try {
      var v = localStorage.getItem(LS);
      if (v == null) return true;
      return v === "1" || v === "true";
    } catch (e) {
      return true;
    }
  }

  function writeEnabled(on) {
    try {
      localStorage.setItem(LS, on ? "1" : "0");
    } catch (e) {}
  }

  enabled = readEnabled();

  function getTv() {
    return document.getElementById("v");
  }

  function getMusicInst() {
    try {
      return window.StepDaddyMusicPlayer && window.StepDaddyMusicPlayer._instance;
    } catch (e) {
      return null;
    }
  }

  function musicAudio() {
    var inst = getMusicInst();
    return inst && inst.audio ? inst.audio : null;
  }

  function musicPlaying() {
    var a = musicAudio();
    var inst = getMusicInst();
    if (!a || !inst) return false;
    // Intent matters for screen-off / leave-browser — don't require dock .show (may be mid-hide).
    if (inst._wantPlaying) return true;
    return !!(a && !a.paused && a.src);
  }

  function partyHoldingDuck() {
    try {
      var m = window.SDPartyAvMedia;
      if (!m || typeof m.getDuckEnabled !== "function" || !m.getDuckEnabled()) return false;
      var v = getTv();
      // Heuristic: party ducker parks near ~0.32
      return !!(v && !v.muted && typeof v.volume === "number" && v.volume > 0.2 && v.volume < 0.38);
    } catch (e) {
      return false;
    }
  }

  function fadeProp(getEl, getVol, setVol, to, ms) {
    return new Promise(function (resolve) {
      var el = getEl();
      if (!el) return resolve();
      var from = getVol(el);
      if (typeof from !== "number" || isNaN(from)) from = to;
      if (Math.abs(from - to) < 0.01) {
        setVol(el, to);
        return resolve();
      }
      var my = ++fadeToken;
      var t0 = performance.now();
      var localRaf = 0;
      function tick(now) {
        if (my !== fadeToken && false) {
          /* allow parallel fades; only abort if element gone */
        }
        var el2 = getEl();
        if (!el2) return resolve();
        var p = Math.min(1, (now - t0) / ms);
        var eased = p * (2 - p);
        setVol(el2, from + (to - from) * eased);
        if (p < 1) localRaf = requestAnimationFrame(tick);
        else resolve();
      }
      localRaf = requestAnimationFrame(tick);
    });
  }

  function fadeTv(to) {
    return fadeProp(
      getTv,
      function (v) {
        return typeof v.volume === "number" ? v.volume : 1;
      },
      function (v, val) {
        if (v.muted && val > 0.02) {
          /* leave user mute alone when restoring only if they unmuted path */
        }
        try {
          v.volume = Math.max(0, Math.min(1, val));
        } catch (e) {}
      },
      to,
      FADE_MS
    );
  }

  function fadeMusic(to) {
    return fadeProp(
      musicAudio,
      function (a) {
        return typeof a.volume === "number" ? a.volume : 1;
      },
      function (a, val) {
        try {
          a.volume = Math.max(0, Math.min(1, val));
        } catch (e) {}
        var inst = getMusicInst();
        if (inst && inst.state && !inst.state.muted) {
          // Keep slider state as user base; applied gain is ephemeral via audio.volume
        }
      },
      to,
      FADE_MS
    );
  }

  function captureBases() {
    var tv = getTv();
    if (tv && tvBase == null && !tv.muted) {
      var vol = typeof tv.volume === "number" ? tv.volume : 1;
      if (vol > TV_DUCK + 0.05) tvBase = vol;
    }
    var a = musicAudio();
    var inst = getMusicInst();
    if (a && musicBase == null) {
      var mv = inst && typeof inst.state.volume === "number" ? inst.state.volume : a.volume;
      if (typeof mv === "number" && mv > MUSIC_DUCK + 0.05) musicBase = mv;
    }
  }

  function applyFocus(next, reason) {
    if (!enabled) return;
    if (next !== "music" && next !== "tv") return;
    if (next === focus && reason !== "force" && reason !== "play" && reason !== "stop") return;
    focus = next;
    captureBases();
    var tvTarget = tvBase != null ? tvBase : 1;
    var musicTarget = musicBase != null ? musicBase : 1;
    if (instMutedMusic()) musicTarget = 0;

    if (next === "music") {
      if (!partyHoldingDuck()) {
        fadeTv(Math.min(tvTarget, TV_DUCK));
      }
      if (musicPlaying() || reason === "play" || reason === "force" || reason === "screen-off") {
        fadeMusic(instMutedMusic() ? 0 : musicTarget);
      }
      // Dynamic Media Session handoff: Music owns lock-screen / notification controls.
      try {
        var inst = getMusicInst();
        if (inst && typeof inst._claimMediaSession === "function") {
          // Only pause/mute TV on real play/force intent — not on pause-resume nudges.
          var touchTv =
            reason === "play" ||
            reason === "force" ||
            reason === "expand" ||
            reason === "sheet-open" ||
            reason === "screen-off" ||
            reason === "visibility-visible";
          inst._claimMediaSession({ releaseTv: touchTv, skipKicks: !touchTv || reason !== "play" });
        } else if (window.SDFeatures && typeof window.SDFeatures.releaseTvMediaSessionForMusic === "function") {
          window.SDFeatures.releaseTvMediaSessionForMusic();
        }
      } catch (eMs) {}
    } else {
      // TV intent — duck music hard (or pause if already near-silent)
      if (musicPlaying()) {
        fadeMusic(MUSIC_DUCK);
      }
      var tv = getTv();
      if (tv && !tv.muted && !partyHoldingDuck()) {
        fadeTv(tvTarget);
      }
      // Reclaim Media Session only when Music is not the focused audio.
      try {
        if (!musicPlaying()) {
          if (window.SDFeatures && typeof window.SDFeatures.reclaimMediaSessionForTv === "function") {
            window.SDFeatures.reclaimMediaSessionForTv(reason === "stop" || reason === "force");
          } else if (window.SDFeatures && typeof window.SDFeatures.syncMediaSession === "function") {
            window.SDFeatures.syncMediaSession(true);
          }
        }
      } catch (eMs2) {}
    }
    try {
      document.documentElement.dataset.sdAudioFocus = focus;
    } catch (e) {}
  }

  function instMutedMusic() {
    var inst = getMusicInst();
    return !!(inst && inst.state && inst.state.muted);
  }

  function musicSheetOpen() {
    try {
      return !!(window.SDMusic && typeof window.SDMusic.isOpen === "function" && window.SDMusic.isOpen());
    } catch (e) {
      var sheet = document.getElementById("musicCatalog");
      return !!(sheet && sheet.classList.contains("open"));
    }
  }

  function musicExpanded() {
    var inst = getMusicInst();
    return !!(inst && inst.state && inst.state.expanded);
  }

  function inMusicZone(t) {
    return !!(
      t &&
      t.closest &&
      t.closest(
        "#musicCatalog, #musicCatalogBackdrop, #musicCatalogBtn, .sd-music-player, #sdMusicPlayer"
      )
    );
  }

  function inTvZone(t) {
    return !!(
      t &&
      t.closest &&
      t.closest(
        ".tv-root, #v, .video-area, .epg-panel, .collapsed-chrome, #unmuteBtn, #tapPlay, #showGuideBtn, .guide-sheet-handle"
      )
    );
  }

  function onPointer(e) {
    if (!enabled) return;
    var t = e.target;
    if (inMusicZone(t)) {
      applyFocus("music", "pointer");
    } else if (inTvZone(t) && !inMusicZone(t)) {
      applyFocus("tv", "pointer");
    }
  }

  function onVisibility() {
    if (document.visibilityState === "hidden") {
      // Leave-browser / screen-off: keep Music focus so TV ducking does not kill Music.
      if (musicPlaying()) applyFocus("music", "screen-off");
      return;
    }
    // Foreground again: re-claim Media Session immediately (no leave-browser required).
    if (musicPlaying()) {
      applyFocus("music", "visibility-visible");
      return;
    }
    if (musicSheetOpen() || musicExpanded()) {
      /* keep current unless TV was last */
    }
  }

  function hookMusicApi() {
    var api = window.StepDaddyMusicPlayer;
    if (!api || api.__sdTvAudioHooked) return;
    api.__sdTvAudioHooked = true;
    var origPlay = api.play;
    var origStop = api.stop;
    var origSetExpanded = api.setExpanded;
    if (typeof origPlay === "function") {
      api.play = function (payload) {
        applyFocus("music", "play");
        return origPlay.apply(this, arguments);
      };
    }
    if (typeof origStop === "function") {
      api.stop = function () {
        var r = origStop.apply(this, arguments);
        applyFocus("tv", "stop");
        return r;
      };
    }
    if (typeof origSetExpanded === "function") {
      api.setExpanded = function (on) {
        var r = origSetExpanded.apply(this, arguments);
        if (on) applyFocus("music", "expand");
        return r;
      };
    }
  }

  function hookMusicShell() {
    var sd = window.SDMusic;
    if (!sd || sd.__sdTvAudioHooked) return;
    sd.__sdTvAudioHooked = true;
    var origOpen = sd.open;
    var origClose = sd.close;
    if (typeof origOpen === "function") {
      sd.open = function () {
        var r = origOpen.apply(this, arguments);
        applyFocus("music", "sheet-open");
        return r;
      };
    }
    if (typeof origClose === "function") {
      sd.close = function () {
        var r = origClose.apply(this, arguments);
        // If music still playing, stay music-focused until TV interaction
        if (!musicPlaying()) applyFocus("tv", "sheet-close");
        return r;
      };
    }
  }

  function boot() {
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("visibilitychange", onVisibility);
    hookMusicApi();
    hookMusicShell();
    // Late-bind if modules load after us
    var tries = 0;
    var t = setInterval(function () {
      hookMusicApi();
      hookMusicShell();
      tries += 1;
      if (tries > 40) clearInterval(t);
    }, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.SDMusicTvAudio = {
    setFocus: applyFocus,
    getFocus: function () {
      return focus;
    },
    setEnabled: function (on) {
      enabled = !!on;
      writeEnabled(enabled);
    },
    isEnabled: function () {
      return enabled;
    },
  };
})();
