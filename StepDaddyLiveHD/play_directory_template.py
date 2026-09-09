"""Channel directory HTML for GET /play (no channel id)."""


def render_play_directory_page(total_channels: int) -> str:
    total_label = str(total_channels) if total_channels else "—"
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="apple-mobile-web-app-capable" content="yes"/>
  <title>Channels — StepDaddy Live</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #0b0b0b; color: #eee;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 0 0 24px; }
    header { display: flex; align-items: center; gap: 8px; padding: 10px 12px;
      background: #141414; border-bottom: 1px solid #222; position: sticky; top: 0; z-index: 10; }
    header h1 { flex: 1; margin: 0; font-size: 17px; font-weight: 600; }
    .icon-btn { border: 0; border-radius: 12px; min-width: 44px; min-height: 44px;
      font-size: 14px; font-weight: 600; color: #fff; background: rgba(40,40,40,.95);
      cursor: pointer; touch-action: manipulation; display: inline-flex; align-items: center;
      justify-content: center; text-decoration: none; padding: 0 12px; }
    .search-wrap { padding: 12px; background: #111; border-bottom: 1px solid #222; }
    .search-wrap input { width: 100%; min-height: 48px; border-radius: 12px; border: 1px solid #333;
      background: #1b1b1b; color: #fff; font-size: 16px; padding: 0 14px; }
    .meta { padding: 8px 14px; font-size: 13px; color: #9aa; }
    .section-label { padding: 10px 14px 4px; font-size: 12px; color: #8a9; text-transform: uppercase;
      letter-spacing: .05em; }
    .ch-row { display: flex; align-items: center; gap: 10px; padding: 14px 14px;
      border-bottom: 1px solid #1e1e1e; cursor: pointer; touch-action: manipulation;
      min-height: 52px; text-decoration: none; color: inherit; }
    .ch-row:active { background: #1a1a1a; }
    .ch-row .num { font-size: 12px; color: #666; min-width: 36px; }
    .ch-row .name { flex: 1; font-size: 15px; line-height: 1.3; }
    .ch-row .go { font-size: 18px; color: #555; }
    .group-hdr { padding: 8px 14px 4px; font-size: 13px; font-weight: 700; color: #b45309;
      background: #0f0f0f; border-top: 1px solid #1a1a1a; }
    .empty { padding: 20px 14px; color: #888; font-size: 14px; text-align: center; }
    .spinner { padding: 32px; text-align: center; color: #888; }
    .spinner::after { content: ""; display: inline-block; width: 32px; height: 32px;
      border: 3px solid rgba(255,255,255,.2); border-top-color: #fff; border-radius: 50%;
      animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    #list { min-height: 120px; }
  </style>
</head>
<body>
  <div class="wrap">
    <header>
      <h1>Pick a channel</h1>
      <a class="icon-btn" href="/legacy" title="Full browse UI (legacy)">Browse</a>
    </header>
    <div class="search-wrap">
      <input id="q" type="search" placeholder="Search channels…" autocomplete="off" enterkeyhint="search"/>
    </div>
    <div class="meta" id="meta">""" + total_label + """ channels · tap to play</div>
    <div class="section-label" id="favLabel">Favorites</div>
    <div id="favList"></div>
    <div class="section-label" id="recentLabel">Recent</div>
    <div id="recentList"></div>
    <div class="section-label" id="mainLabel">All channels</div>
    <div id="list"><div class="spinner"></div></div>
  </div>
  <script>
    const LS_FAV = "sd_favorites";
    const LS_RECENT = "sd_recents";
    const q = document.getElementById("q");
    const list = document.getElementById("list");
    const meta = document.getElementById("meta");
    const favList = document.getElementById("favList");
    const recentList = document.getElementById("recentList");
    let channels = [];
    let idToNum = {};
    let searchTimer = null;
    let searchMode = false;

    function readJson(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
      catch (e) { return fallback; }
    }

    function getFavorites() { return readJson(LS_FAV, []); }
    function getRecents() { return readJson(LS_RECENT, []); }

    function go(id) {
      window.location.href = "/play/" + encodeURIComponent(id);
    }

    function renderRows(container, items, emptyText) {
      container.innerHTML = "";
      if (!items.length) {
        container.innerHTML = '<div class="empty">' + emptyText + '</div>';
        return;
      }
      for (const item of items) {
        const row = document.createElement("a");
        row.className = "ch-row";
        row.href = "/play/" + encodeURIComponent(item.id);
        const num = idToNum[item.id] || "";
        row.innerHTML = '<span class="num">' + (num ? "#" + num : "") + '</span>'
          + '<span class="name">' + escapeHtml(item.name) + '</span><span class="go">›</span>';
        container.appendChild(row);
      }
    }

    function escapeHtml(s) {
      return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    function renderFavRecent() {
      renderRows(favList, getFavorites(), "No favorites — star channels on the player page");
      renderRows(recentList, getRecents(), "No recent channels");
    }

    function alphaKey(name) {
      const t = (name || "").trim();
      if (!t) return "#";
      const c = t[0].toUpperCase();
      return /[A-Z0-9]/.test(c) ? c : "#";
    }

    function renderBrowse(filtered) {
      list.innerHTML = "";
      if (!filtered.length) {
        list.innerHTML = '<div class="empty">No channels match</div>';
        meta.textContent = "0 matches";
        return;
      }
      const groups = {};
      for (const c of filtered) {
        const k = alphaKey(c.name);
        if (!groups[k]) groups[k] = [];
        groups[k].push(c);
      }
      const keys = Object.keys(groups).sort();
      let shown = 0;
      for (const k of keys) {
        const hdr = document.createElement("div");
        hdr.className = "group-hdr";
        hdr.textContent = k;
        list.appendChild(hdr);
        for (const c of groups[k]) {
          const row = document.createElement("a");
          row.className = "ch-row";
          row.href = "/play/" + encodeURIComponent(c.id);
          const num = idToNum[c.id] || "";
          row.innerHTML = '<span class="num">' + (num ? "#" + num : "") + '</span>'
            + '<span class="name">' + escapeHtml(c.name) + '</span><span class="go">›</span>';
          list.appendChild(row);
          shown += 1;
        }
      }
      meta.textContent = shown + " channels · tap to play";
    }

    async function loadOrder() {
      try {
        const r = await fetch("/channels/order");
        if (!r.ok) return;
        const data = await r.json();
        const ids = data.ids || [];
        idToNum = {};
        ids.forEach((id, i) => { idToNum[String(id)] = i + 1; });
      } catch (e) {}
    }

    async function loadChannels() {
      list.innerHTML = '<div class="spinner"></div>';
      try {
        const r = await fetch("/channels?include_dead=false");
        if (!r.ok) throw new Error("load_failed");
        channels = await r.json();
        channels.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
        meta.textContent = channels.length + " channels · tap to play";
        renderBrowse(channels);
      } catch (e) {
        list.innerHTML = '<div class="empty">Could not load channels. <button type="button" onclick="loadChannels()">Retry</button></div>';
        meta.textContent = "Load failed";
      }
    }

    async function runSearch() {
      const term = q.value.trim();
      if (!term) {
        searchMode = false;
        document.getElementById("favLabel").style.display = "";
        document.getElementById("recentLabel").style.display = "";
        document.getElementById("mainLabel").style.display = "";
        favList.style.display = "";
        recentList.style.display = "";
        renderBrowse(channels);
        return;
      }
      searchMode = true;
      document.getElementById("favLabel").style.display = "none";
      document.getElementById("recentLabel").style.display = "none";
      document.getElementById("mainLabel").style.display = "none";
      favList.style.display = "none";
      recentList.style.display = "none";
      list.innerHTML = '<div class="spinner"></div>';
      try {
        const r = await fetch("/channels/search?q=" + encodeURIComponent(term));
        if (!r.ok) throw new Error("search_failed");
        const hits = await r.json();
        const mapped = hits.map(c => ({ id: String(c.id), name: c.name }));
        renderBrowse(mapped);
        meta.textContent = mapped.length + " search results";
      } catch (e) {
        list.innerHTML = '<div class="empty">Search failed</div>';
      }
    }

    q.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(runSearch, 250);
    });

    (async () => {
      renderFavRecent();
      await loadOrder();
      await loadChannels();
    })();
  </script>
  <script src="/tv-assets/pull_reload.js" defer></script>
</body>
</html>"""
