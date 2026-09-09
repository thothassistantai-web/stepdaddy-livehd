/* player_report: /tv ⋯ Report popup — audit snapshot + screenshot + POST /api/channel-reports */
(function sdReportBoot() {
  const CATEGORIES = [
    { id: "epg_mismatch", label: "EPG mismatch" },
    { id: "wrong_title", label: "Wrong title" },
    { id: "wrong_logo", label: "Logo issue" },
    { id: "wrong_network", label: "Wrong network" },
    { id: "playback", label: "Playback / stream" },
    { id: "paint_death", label: "Paint death (green/black)" },
    { id: "other", label: "Other" },
  ];
  const SEVERITIES = [
    { id: "low", label: "Low" },
    { id: "medium", label: "Medium" },
    { id: "high", label: "High" },
    { id: "critical", label: "Critical" },
  ];
  const LS_DEDUP = "sd_channel_report_dedup_v1";
  const DEDUP_MS = 15 * 60 * 1000;
  const MAX_SHOT_W = 480;

  let submitting = false;
  let lastAudit = null;
  let lastShot = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(msg) {
    try {
      if (window.SDParty && typeof SDParty.toast === "function") {
        SDParty.toast(msg);
        return;
      }
    } catch (e) {}
    const el = $("errToast") || $("partyToast");
    if (el) {
      el.textContent = String(msg || "");
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 3500);
    }
  }

  function channelIdFromUrl() {
    const m = (location.pathname || "").match(/^\/tv\/([^/]+)\/?$/);
    return m ? decodeURIComponent(m[1]) : "";
  }

  function readDedup() {
    try {
      return JSON.parse(localStorage.getItem(LS_DEDUP) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function writeDedup(map) {
    try {
      localStorage.setItem(LS_DEDUP, JSON.stringify(map));
    } catch (e) {}
  }

  function localDupKey(channelId, cats, gt, severity) {
    return [channelId, cats.slice().sort().join(","), String(gt || "").trim().toLowerCase(), severity].join("|");
  }

  function isLocalDup(key) {
    const map = readDedup();
    const ts = Number(map[key] || 0);
    return ts && Date.now() - ts < DEDUP_MS;
  }

  function markLocalDup(key) {
    const map = readDedup();
    const now = Date.now();
    Object.keys(map).forEach((k) => {
      if (now - Number(map[k] || 0) > DEDUP_MS * 2) delete map[k];
    });
    map[key] = now;
    writeDedup(map);
  }

  function ensureUi() {
    if ($("sdReportModal")) return;
    const bd = document.createElement("div");
    bd.className = "sd-modal-backdrop";
    bd.id = "sdReportBackdrop";
    const modal = document.createElement("div");
    modal.className = "sd-modal sd-modal-report";
    modal.id = "sdReportModal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "sdReportTitle");
    modal.innerHTML =
      '<h3 id="sdReportTitle">Report channel issue</h3>' +
      '<p class="sd-report-hint" id="sdReportHint">Gathering audit snapshot…</p>' +
      '<div class="sd-report-meta" id="sdReportMeta"></div>' +
      '<div class="sd-report-shot-wrap">' +
      '<img id="sdReportShot" class="sd-report-shot" alt="Capture preview" hidden/>' +
      '<div class="sd-report-shot-status" id="sdReportShotStatus"></div></div>' +
      '<label class="sd-report-label">Categories</label>' +
      '<div class="sd-report-cats" id="sdReportCats"></div>' +
      '<div class="sd-report-grid">' +
      '<label class="sd-report-label">Severity' +
      '<select id="sdReportSeverity"></select></label>' +
      '<label class="sd-report-label">Ground-truth title' +
      '<input id="sdReportGroundTruth" type="text" maxlength="240" placeholder="Correct show / movie title" autocomplete="off"/></label>' +
      '</div>' +
      '<label class="sd-report-label">What\'s actually airing' +
      '<input id="sdReportAiring" type="text" maxlength="240" placeholder="What you see on the video right now" autocomplete="off"/></label>' +
      '<label class="sd-report-label">Notes' +
      '<textarea id="sdReportNotes" rows="3" maxlength="4000" placeholder="EPG mismatch, logo wrong, stuck buffering…"></textarea></label>' +
      '<label class="sd-report-check"><input type="checkbox" id="sdReportAttachAudit" checked/> Attach full audit JSON</label>' +
      '<label class="sd-report-check"><input type="checkbox" id="sdReportForce"/> Submit even if duplicate</label>' +
      '<div class="row">' +
      '<button type="button" class="primary" id="sdReportSubmit">Submit report</button>' +
      '<button type="button" id="sdReportRecapture">Recapture</button>' +
      '<button type="button" id="sdReportClose">Cancel</button></div>' +
      '<p class="sd-report-status" id="sdReportStatus" aria-live="polite"></p>';
    document.body.appendChild(bd);
    document.body.appendChild(modal);

    const cats = $("sdReportCats");
    CATEGORIES.forEach((c) => {
      const lab = document.createElement("label");
      lab.className = "sd-report-cat";
      lab.innerHTML =
        '<input type="checkbox" value="' +
        c.id +
        '"/> <span>' +
        c.label +
        "</span>";
      cats.appendChild(lab);
    });
    const sev = $("sdReportSeverity");
    SEVERITIES.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.label;
      if (s.id === "medium") opt.selected = true;
      sev.appendChild(opt);
    });

    bd.addEventListener("click", close);
    $("sdReportClose").addEventListener("click", close);
    $("sdReportSubmit").addEventListener("click", () => submitReport(false));
    $("sdReportRecapture").addEventListener("click", () => {
      captureScreenshot().then((shot) => {
        lastShot = shot;
        applyShot(shot);
      });
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && modal.classList.contains("open")) close();
    });
  }

  function selectedCategories() {
    return Array.from(document.querySelectorAll("#sdReportCats input:checked")).map(
      (el) => el.value
    );
  }

  function setStatus(msg, isErr) {
    const el = $("sdReportStatus");
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("err", !!isErr);
  }

  function applyShot(shot) {
    const img = $("sdReportShot");
    const st = $("sdReportShotStatus");
    if (!img || !st) return;
    if (shot && shot.dataUrl) {
      img.src = shot.dataUrl;
      img.hidden = false;
      st.textContent =
        "Capture: " +
        (shot.source || "frame") +
        (shot.width ? " · " + shot.width + "×" + shot.height : "");
    } else {
      img.hidden = true;
      img.removeAttribute("src");
      st.textContent = "No screenshot (video frame unavailable — notes still help).";
    }
  }

  function renderMeta(ctx, audit) {
    const el = $("sdReportMeta");
    const hint = $("sdReportHint");
    if (!el) return;
    const id = (ctx && ctx.channel_id) || channelIdFromUrl() || "—";
    const name = (ctx && ctx.display_name) || "—";
    const tvg = (ctx && ctx.tvg_id) || (audit && audit.tvg_id) || "—";
    const nowT =
      (ctx && ctx.epg_now && (ctx.epg_now.title || ctx.epg_now.name)) ||
      (audit && audit.epg && audit.epg.now && audit.epg.now.title) ||
      "—";
    const nextT =
      (ctx && ctx.epg_next && (ctx.epg_next.title || ctx.epg_next.name)) ||
      (audit && audit.epg && audit.epg.next && audit.epg.next.title) ||
      "—";
    const play = (ctx && ctx.playback) || {};
    const ver = (audit && audit.bundle_version) || "—";
    if (hint) {
      hint.textContent =
        "Channel " + id + " · audit + capture ready. Pick categories and ground truth.";
    }
    el.innerHTML =
      "<div><b>Ch</b> " +
      escapeHtml(String(id)) +
      " · " +
      escapeHtml(String(name)) +
      "</div>" +
      "<div><b>tvg</b> " +
      escapeHtml(String(tvg)) +
      "</div>" +
      "<div><b>EPG now</b> " +
      escapeHtml(String(nowT)) +
      "</div>" +
      "<div><b>EPG next</b> " +
      escapeHtml(String(nextT)) +
      "</div>" +
      "<div><b>Playback</b> rs=" +
      escapeHtml(String(play.readyState != null ? play.readyState : "?")) +
      " · " +
      (play.paused ? "paused" : "playing") +
      (play.paint_dead ? " · paint-dead" : "") +
      " · " +
      escapeHtml(String(play.videoWidth || 0)) +
      "×" +
      escapeHtml(String(play.videoHeight || 0)) +
      "</div>" +
      "<div><b>Bundle</b> " +
      escapeHtml(String(ver)) +
      "</div>";
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function captureVideoFrame() {
    const v = $("v");
    if (!v || v.readyState < 2 || v.videoWidth < 2) return null;
    try {
      const scale = Math.min(1, MAX_SHOT_W / v.videoWidth);
      const w = Math.max(1, Math.round(v.videoWidth * scale));
      const h = Math.max(1, Math.round(v.videoHeight * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(v, 0, 0, w, h);
      return {
        dataUrl: c.toDataURL("image/jpeg", 0.72),
        source: "video_frame",
        width: w,
        height: h,
      };
    } catch (e) {
      return null;
    }
  }

  async function captureGuideFallback() {
    // Lightweight: composite now-on-air + chrome text into a small canvas (no html2canvas dep).
    try {
      const now = $("nowOnAir");
      const text = (now && (now.innerText || now.textContent) || "").trim().slice(0, 220);
      if (!text) return null;
      const c = document.createElement("canvas");
      c.width = 480;
      c.height = 120;
      const ctx = c.getContext("2d");
      if (!ctx) return null;
      ctx.fillStyle = "#0e1218";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#e8edf5";
      ctx.font = "600 16px system-ui,sans-serif";
      wrapText(ctx, text, 16, 36, 448, 22);
      ctx.fillStyle = "#9aa3b5";
      ctx.font = "500 12px system-ui,sans-serif";
      ctx.fillText("Guide strip capture · " + new Date().toISOString(), 16, 104);
      return {
        dataUrl: c.toDataURL("image/jpeg", 0.8),
        source: "guide_strip",
        width: c.width,
        height: c.height,
      };
    } catch (e) {
      return null;
    }
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = String(text).split(/\s+/);
    let line = "";
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
        if (yy > 80) break;
      } else {
        line = test;
      }
    }
    if (line && yy <= 88) ctx.fillText(line, x, yy);
  }

  async function captureScreenshot() {
    const frame = captureVideoFrame();
    if (frame) return frame;
    // Optional html2canvas if already on page
    try {
      if (typeof window.html2canvas === "function") {
        const target = document.querySelector(".tv-root") || document.body;
        const canvas = await window.html2canvas(target, {
          scale: 0.35,
          logging: false,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#0b0d12",
        });
        const scale = Math.min(1, MAX_SHOT_W / canvas.width);
        const w = Math.max(1, Math.round(canvas.width * scale));
        const h = Math.max(1, Math.round(canvas.height * scale));
        const out = document.createElement("canvas");
        out.width = w;
        out.height = h;
        out.getContext("2d").drawImage(canvas, 0, 0, w, h);
        return {
          dataUrl: out.toDataURL("image/jpeg", 0.7),
          source: "html2canvas",
          width: w,
          height: h,
        };
      }
    } catch (e) {}
    return await captureGuideFallback();
  }

  async function fetchJson(url) {
    try {
      const r = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) {
      return null;
    }
  }

  async function gatherAudit() {
    const ctx =
      typeof window.SDGetReportContext === "function" ? window.SDGetReportContext() : null;
    const channelId = (ctx && ctx.channel_id) || channelIdFromUrl();
    const health = await fetchJson("/health?lite=1");
    const bundle =
      (health && (health.bundle_version || health.version)) ||
      (document.querySelector('script[src*="player_bundle"]') || {}).src ||
      "";
    let match = null;
    let nowNext = null;
    let neighbors = null;
    let liveMeta = null;
    if (channelId) {
      const results = await Promise.all([
        fetchJson("/epg/match/" + encodeURIComponent(channelId)),
        fetchJson("/epg/now-next/" + encodeURIComponent(channelId)),
        fetchJson("/channels/neighbors/" + encodeURIComponent(channelId)),
        fetchJson("/live/" + encodeURIComponent(channelId) + "/meta"),
      ]);
      match = results[0];
      nowNext = results[1];
      neighbors = results[2];
      liveMeta = results[3];
    }

    const v = $("v");
    const playback = (ctx && ctx.playback) || {
      paused: !!(v && v.paused),
      readyState: v ? v.readyState : 0,
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      muted: !!(v && v.muted),
      networkState: v ? v.networkState : 0,
    };

    const streamStatus = {
      live_meta_ok: !!(liveMeta && !liveMeta.error),
      dead: !!(liveMeta && liveMeta.dead),
      referer_host: liveMeta && liveMeta.referer_host ? String(liveMeta.referer_host) : null,
      proxy_mode: liveMeta && liveMeta.proxy_mode ? String(liveMeta.proxy_mode) : null,
      path_kind: channelId ? "/live/" + channelId + ".m3u8" : null,
    };

    const audit = {
      schema_hint: "channel-report-client-audit/1",
      gathered_at: new Date().toISOString(),
      gateway_base: location.origin,
      channel_id: channelId || null,
      display_name: (ctx && ctx.display_name) || (match && match.channel_name) || null,
      tvg_id:
        (ctx && ctx.tvg_id) ||
        (match && match.mapped_tvg_id) ||
        null,
      epg: {
        match_method: match && match.method,
        match_confidence: match && match.confidence,
        now: (ctx && ctx.epg_now) || (nowNext && nowNext.now) || null,
        next: (ctx && ctx.epg_next) || (nowNext && nowNext.next) || null,
        has_data: match ? !!match.epg_has_data : null,
      },
      stream: streamStatus,
      playback: playback,
      neighbors: neighbors
        ? {
            index: neighbors.index,
            number: neighbors.number,
            prev: neighbors.prev && neighbors.prev.id,
            next: neighbors.next && neighbors.next.id,
          }
        : null,
      bundle_version: typeof bundle === "string" ? bundle.replace(/^.*[?&]v=/, "").slice(0, 32) : null,
      health_bundle_version: health && health.bundle_version,
      theme: ctx && ctx.theme,
      guide_collapsed: ctx && ctx.guide_collapsed,
      path: location.pathname,
      href_host: location.host,
    };
    return { ctx, audit, channelId, health };
  }

  function guessCategoryDefaults(audit) {
    const boxes = document.querySelectorAll("#sdReportCats input");
    boxes.forEach((b) => {
      b.checked = false;
    });
    let pick = "other";
    try {
      if (audit && audit.playback && audit.playback.paint_dead) pick = "paint_death";
      else if (audit && audit.stream && audit.stream.dead) pick = "playback";
      else if (audit && audit.epg && audit.epg.now) pick = "epg_mismatch";
    } catch (e) {}
    boxes.forEach((b) => {
      if (b.value === pick) b.checked = true;
    });
  }

  async function open() {
    ensureUi();
    const modal = $("sdReportModal");
    const bd = $("sdReportBackdrop");
    if (!modal || !bd) return;
    setStatus("");
    $("sdReportNotes").value = "";
    $("sdReportGroundTruth").value = "";
    $("sdReportAiring").value = "";
    $("sdReportForce").checked = false;
    $("sdReportAttachAudit").checked = true;
    $("sdReportSeverity").value = "medium";
    lastAudit = null;
    lastShot = null;
    applyShot(null);
    renderMeta(null, null);
    bd.classList.add("open");
    modal.classList.add("open");

    try {
      const gathered = await gatherAudit();
      lastAudit = gathered;
      renderMeta(gathered.ctx, gathered.audit);
      guessCategoryDefaults(gathered.audit);
      // Prefill airing from EPG now as a starting point (user edits to ground truth).
      const nowT =
        (gathered.ctx && gathered.ctx.epg_now && (gathered.ctx.epg_now.title || gathered.ctx.epg_now.name)) ||
        (gathered.audit && gathered.audit.epg && gathered.audit.epg.now && gathered.audit.epg.now.title) ||
        "";
      if (nowT && !$("sdReportAiring").value) {
        // Leave airing empty — user should type what they *see*; put EPG in placeholder.
        $("sdReportAiring").placeholder = "EPG says: " + String(nowT).slice(0, 80);
      }
    } catch (e) {
      setStatus("Audit gather partial — you can still submit notes.", true);
    }

    try {
      lastShot = await captureScreenshot();
      applyShot(lastShot);
    } catch (e) {
      applyShot(null);
    }

    setTimeout(() => {
      try {
        $("sdReportGroundTruth").focus();
      } catch (e) {}
    }, 50);
  }

  function close() {
    const modal = $("sdReportModal");
    const bd = $("sdReportBackdrop");
    if (modal) modal.classList.remove("open");
    if (bd) bd.classList.remove("open");
  }

  async function submitReport(forceFlag) {
    if (submitting) return;
    ensureUi();
    const cats = selectedCategories();
    if (!cats.length) {
      setStatus("Select at least one category.", true);
      return;
    }
    const severity = $("sdReportSeverity").value || "medium";
    const gt = ($("sdReportGroundTruth").value || "").trim();
    const airing = ($("sdReportAiring").value || "").trim();
    const notes = ($("sdReportNotes").value || "").trim();
    const force = forceFlag || ($("sdReportForce") && $("sdReportForce").checked);
    const attach = !($("sdReportAttachAudit") && !$("sdReportAttachAudit").checked);

    let gathered = lastAudit;
    if (!gathered) {
      try {
        gathered = await gatherAudit();
        lastAudit = gathered;
      } catch (e) {
        gathered = { ctx: null, audit: {}, channelId: channelIdFromUrl() };
      }
    }
    const channelId = gathered.channelId || channelIdFromUrl();
    if (!channelId) {
      setStatus("No channel id — tune a channel first.", true);
      return;
    }

    const dupKey = localDupKey(channelId, cats, gt || airing, severity);
    if (!force && isLocalDup(dupKey)) {
      setStatus("Duplicate suppressed locally (same channel/category in last 15m). Check “Submit even if duplicate” to force.", true);
      return;
    }

    if (!lastShot) {
      try {
        lastShot = await captureScreenshot();
        applyShot(lastShot);
      } catch (e) {}
    }

    const payload = {
      channel_id: channelId,
      channel_name:
        (gathered.ctx && gathered.ctx.display_name) ||
        (gathered.audit && gathered.audit.display_name) ||
        null,
      categories: cats,
      severity: severity,
      ground_truth_title: gt || null,
      actually_airing: airing || null,
      notes: notes || null,
      bundle_version:
        (gathered.audit && gathered.audit.health_bundle_version) ||
        (gathered.audit && gathered.audit.bundle_version) ||
        null,
      client_reported_at: new Date().toISOString(),
      client: {
        user_agent: navigator.userAgent || "",
        platform: navigator.platform || "",
        language: navigator.language || "",
        timezone: (Intl.DateTimeFormat().resolvedOptions() || {}).timeZone || null,
        online: navigator.onLine,
        viewport: {
          w: window.innerWidth || 0,
          h: window.innerHeight || 0,
          dpr: window.devicePixelRatio || 1,
        },
      },
      force: !!force,
      screenshot: lastShot && lastShot.dataUrl ? lastShot.dataUrl : null,
      audit: attach ? gathered.audit : { channel_id: channelId, stripped: true },
    };

    submitting = true;
    setStatus("Submitting…");
    const btn = $("sdReportSubmit");
    if (btn) btn.disabled = true;
    try {
      const r = await fetch("/api/channel-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await r.json();
      } catch (e) {
        data = null;
      }
      if (!r.ok || !data || !data.ok) {
        setStatus(
          "Submit failed" + (data && data.error ? ": " + data.error : " (" + r.status + ")"),
          true
        );
        return;
      }
      markLocalDup(dupKey);
      if (data.duplicate) {
        setStatus("Duplicate on server — earlier report " + (data.id || "") + " still counts.", false);
        toast("Report already on file");
      } else {
        setStatus("Submitted · " + (data.id || "ok"), false);
        toast("Report submitted");
        setTimeout(close, 700);
      }
    } catch (e) {
      setStatus("Network error submitting report.", true);
    } finally {
      submitting = false;
      if (btn) btn.disabled = false;
    }
  }

  window.SDReport = {
    open,
    close,
    gatherAudit,
    captureScreenshot,
  };
})();
