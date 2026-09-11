/* player_party_av_media: gUM constraints, local mirror prefs, speech VAD + TV ducking */
(function sdPartyAvMediaBoot() {
  const LS_DUCK = "sd_party_av_duck";
  const LS_MIRROR = "sd_party_av_mirror";
  const DUCK_LEVEL = 0.32;
  const DUCK_HOLD_MS = 900;
  const SPEECH_THRESH = 0.045;
  const SPEECH_HANG_MS = 280;

  function readBool(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      if (v == null) return fallback;
      return v === "1" || v === "true";
    } catch (e) {
      return fallback;
    }
  }

  function writeBool(key, val) {
    try {
      localStorage.setItem(key, val ? "1" : "0");
    } catch (e) {}
  }

  function getDuckEnabled() {
    return readBool(LS_DUCK, true);
  }

  function setDuckEnabled(on) {
    writeBool(LS_DUCK, !!on);
  }

  function getMirrorLocal() {
    return readBool(LS_MIRROR, true);
  }

  function setMirrorLocal(on) {
    writeBool(LS_MIRROR, !!on);
  }

  function buildAudioConstraints() {
    const audio = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    };
    try {
      const supported =
        (navigator.mediaDevices &&
          typeof navigator.mediaDevices.getSupportedConstraints === "function" &&
          navigator.mediaDevices.getSupportedConstraints()) ||
        {};
      if (supported.voiceIsolation) audio.voiceIsolation = true;
    } catch (e) {}
    return audio;
  }

  function buildVideoConstraints() {
    return { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } };
  }

  function getProgramVideo() {
    return document.getElementById("v");
  }

  function programUserSilenced(v) {
    return !v || v.muted || (typeof v.volume === "number" && v.volume < 0.01);
  }

  /** Lightweight RMS monitor for a MediaStream audio track. */
  function createSpeechMonitor(stream, opts) {
    opts = opts || {};
    const onSpeaking = typeof opts.onSpeaking === "function" ? opts.onSpeaking : null;
    const onLevel = typeof opts.onLevel === "function" ? opts.onLevel : null;
    const id = opts.id || "anon";
    let ctx = null;
    let analyser = null;
    let source = null;
    let raf = 0;
    let speaking = false;
    let lastAbove = 0;
    let stopped = false;

    const audioTracks = stream && stream.getAudioTracks ? stream.getAudioTracks() : [];
    if (!audioTracks.length) {
      return {
        id: id,
        stop: function () {},
        isSpeaking: function () {
          return false;
        },
      };
    }

    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error("no AudioContext");
      ctx = new AC();
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.55;
      source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Do not connect to destination — monitor only (avoid double audio).
    } catch (e) {
      return {
        id: id,
        stop: function () {},
        isSpeaking: function () {
          return false;
        },
      };
    }

    const data = new Uint8Array(analyser.fftSize);

    function tick() {
      if (stopped || !analyser) return;
      try {
        if (ctx.state === "suspended") ctx.resume().catch(function () {});
      } catch (e) {}
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const n = (data[i] - 128) / 128;
        sum += n * n;
      }
      const rms = Math.sqrt(sum / data.length);
      if (onLevel) onLevel(rms, id);
      const now = Date.now();
      if (rms >= SPEECH_THRESH) {
        lastAbove = now;
        if (!speaking) {
          speaking = true;
          if (onSpeaking) onSpeaking(true, id);
        }
      } else if (speaking && now - lastAbove > SPEECH_HANG_MS) {
        speaking = false;
        if (onSpeaking) onSpeaking(false, id);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return {
      id: id,
      stop: function () {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        try {
          if (source) source.disconnect();
        } catch (e) {}
        try {
          if (analyser) analyser.disconnect();
        } catch (e) {}
        try {
          if (ctx && ctx.state !== "closed") ctx.close();
        } catch (e) {}
        source = null;
        analyser = null;
        ctx = null;
        if (speaking && onSpeaking) onSpeaking(false, id);
        speaking = false;
      },
      isSpeaking: function () {
        return speaking;
      },
    };
  }

  function createProgramDucker() {
    let holdTimer = null;
    let savedVol = null;
    let speechIds = Object.create(null);

    function anySpeech() {
      return Object.keys(speechIds).some(function (k) {
        return speechIds[k];
      });
    }

    function applyDuck() {
      if (!getDuckEnabled()) {
        restoreNow();
        return;
      }
      const v = getProgramVideo();
      if (programUserSilenced(v)) return;
      if (anySpeech()) {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
        if (savedVol == null) savedVol = typeof v.volume === "number" ? v.volume : 1;
        if (v.volume > DUCK_LEVEL) v.volume = DUCK_LEVEL;
      } else if (savedVol != null && !holdTimer) {
        holdTimer = setTimeout(function () {
          holdTimer = null;
          restoreNow();
        }, DUCK_HOLD_MS);
      }
    }

    function restoreNow() {
      const v = getProgramVideo();
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
      if (savedVol != null && v && !v.muted) {
        // Only restore if still at/near duck level (user may have moved slider).
        if (Math.abs(v.volume - DUCK_LEVEL) < 0.06 || v.volume < savedVol) {
          v.volume = savedVol;
        }
      }
      savedVol = null;
    }

    return {
      setSpeaking: function (id, on) {
        if (on) speechIds[id] = true;
        else delete speechIds[id];
        applyDuck();
      },
      refresh: applyDuck,
      stop: function () {
        speechIds = Object.create(null);
        restoreNow();
      },
    };
  }

  function initialsFromName(name) {
    const s = String(name || "").trim();
    if (!s) return "?";
    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
    return s.slice(0, 2).toUpperCase();
  }

  window.SDPartyAvMedia = {
    LS_DUCK: LS_DUCK,
    LS_MIRROR: LS_MIRROR,
    DUCK_LEVEL: DUCK_LEVEL,
    getDuckEnabled: getDuckEnabled,
    setDuckEnabled: setDuckEnabled,
    getMirrorLocal: getMirrorLocal,
    setMirrorLocal: setMirrorLocal,
    buildAudioConstraints: buildAudioConstraints,
    buildVideoConstraints: buildVideoConstraints,
    getProgramVideo: getProgramVideo,
    createSpeechMonitor: createSpeechMonitor,
    createProgramDucker: createProgramDucker,
    initialsFromName: initialsFromName,
  };
})();
