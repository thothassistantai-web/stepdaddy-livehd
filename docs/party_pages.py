"""HTML shells for Watch Party home and join landing pages."""

from __future__ import annotations

from html import escape


def render_party_join_page(
    code: str,
    *,
    watch: str,
    locked: bool,
    title: str,
    room_name: str,
    member_count: int,
    exists: bool,
    poster_path: str | None = None,
    channel_id: str | None = None,
) -> str:
    code = escape(code or "")
    watch_js = watch or "/tv/"
    title_safe = escape(title or "")
    name_safe = escape(room_name or "")
    poster = escape(poster_path or "") if poster_path else ""
    ch = escape(str(channel_id)) if channel_id else ""
    locked_js = "1" if locked else "0"
    exists_js = "1" if exists else "0"
    members = int(member_count or 0)

    status_line = ""
    if not exists:
        status_line = "This room was not found or has expired."
    elif title_safe:
        status_line = f"Now playing: {title_safe}"
    elif name_safe:
        status_line = name_safe
    else:
        status_line = "Opens the host’s stream, then joins the party."

    letter = escape(((title or room_name or code) or "?").strip()[:1].upper() or "?")
    if poster:
        poster_html = (
            f'<img class="poster" src="{poster}" alt="" loading="lazy" '
            f'data-letter="{letter}" '
            f'onerror="this.onerror=null;var d=document.createElement(\'div\');'
            f'd.className=\'poster ph\';d.textContent=this.getAttribute(\'data-letter\')||\'?\';'
            f'this.replaceWith(d);"/>'
        )
    elif exists:
        poster_html = f'<div class="poster ph">{letter}</div>'
    else:
        poster_html = ""
    room_heading = name_safe or f"Party {code}"

    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#0b0d12"/>
<meta name="description" content="Join Watch Party {code} on StepDaddyLiveHD"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="StepDaddyLiveHD"/>
<meta property="og:title" content="Join {code} — Watch Party"/>
<meta property="og:description" content="{status_line or "Watch together on StepDaddyLiveHD"}"/>
<meta property="og:image" content="/tv-assets/icon-512.png"/>
<meta name="twitter:card" content="summary"/>
<link rel="manifest" href="/tv-assets/site.webmanifest"/>
<link rel="apple-touch-icon" href="/tv-assets/icon-192.png"/>
<title>Join {code} — Watch Party</title>
<style>
:root {{ --bg:#0b0d12; --card:#141820; --line:#2a3140; --text:#e8edf5; --muted:#9aa4b2; --accent:#2563eb; --danger:#f87171; }}
* {{ box-sizing:border-box; }}
body {{ margin:0; min-height:100vh; background:radial-gradient(1200px 600px at 50% -10%, #1a2744 0%, var(--bg) 55%);
  color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  display:grid; place-items:center; padding:24px 16px; }}
.card {{ width:min(440px,100%); padding:28px 24px; border-radius:18px; background:var(--card);
  border:1px solid var(--line); text-align:center; box-shadow:0 24px 60px rgba(0,0,0,.45); }}
.poster {{ width:96px; height:144px; object-fit:cover; border-radius:10px; margin:0 auto 14px; display:block;
  background:#0b0d12; border:1px solid var(--line); }}
h1 {{ margin:0 0 6px; font-size:1.35rem; letter-spacing:.01em; }}
.code {{ font-size:1.6rem; font-weight:800; letter-spacing:.18em; margin:4px 0 10px; }}
.meta {{ font-size:14px; color:var(--muted); margin:0 0 16px; line-height:1.4; min-height:1.2em; }}
.badge {{ display:inline-block; font-size:11px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
  padding:3px 8px; border-radius:999px; border:1px solid var(--line); color:var(--muted); margin-bottom:10px; }}
.badge.lock {{ color:#fbbf24; border-color:#5b4a1e; }}
.badge.gone {{ color:var(--danger); border-color:#7f1d1d; }}
label {{ display:block; text-align:left; font-size:12px; color:var(--muted); margin:10px 0 4px; }}
input,button {{ width:100%; margin:0; padding:13px 14px; border-radius:12px; border:1px solid var(--line);
  background:#0b0d12; color:var(--text); font-size:15px; }}
button {{ background:var(--accent); border:0; font-weight:700; cursor:pointer; margin-top:14px; }}
button:hover {{ filter:brightness(1.08); }}
button:disabled {{ opacity:.55; cursor:not-allowed; }}
button.secondary {{ background:transparent; border:1px solid var(--line); color:var(--text); margin-top:10px; font-weight:600; }}
.err {{ color:var(--danger); font-size:13px; min-height:18px; margin:10px 0 0; }}
.hint {{ font-size:12px; color:var(--muted); margin:14px 0 0; line-height:1.45; }}
.links {{ margin-top:16px; font-size:13px; }}
.links a {{ color:#93c5fd; text-decoration:none; }}
.links a:hover {{ text-decoration:underline; }}
.row {{ display:flex; gap:8px; align-items:center; justify-content:center; flex-wrap:wrap; margin-bottom:8px; }}
</style></head>
<body>
<div class="card" id="card">
  {poster_html}
  <div class="row">
    <span class="badge" id="statusBadge">{"Room missing" if not exists else ("Locked" if locked else "Invite")}</span>
  </div>
  <h1 id="roomHeading">{room_heading}</h1>
  <div class="code" id="codeLabel">{code}</div>
  <p class="meta" id="meta">{status_line}</p>
  <div id="joinForm" {"hidden" if not exists else ""}>
    <label for="name">Display name</label>
    <input id="name" placeholder="Your name" maxlength="32" autocomplete="nickname"/>
    <div id="pwdWrap" style="{"display:none" if not locked else "display:block"}">
      <label for="pwd">Room password</label>
      <input id="pwd" type="password" placeholder="Password" autocomplete="current-password"/>
    </div>
    <button type="button" id="go" data-join="1">Join &amp; watch</button>
    <button type="button" class="secondary" id="holdAuto" hidden>Stay on this page</button>
  </div>
  <div id="missingBlock" {"hidden" if exists else ""}>
    <p class="err">Room not found or expired. Ask the host for a new invite, or browse open parties.</p>
    <button type="button" class="secondary" id="goHome">Open Party Home</button>
  </div>
  <p class="err" id="err"></p>
  <p class="hint" id="hint">Opens the live stream and joins this party. PIN unlock (if enabled) keeps the invite queued.</p>
  <div class="links"><a href="/party">Party Home</a> · <a href="/tv/">TV Guide</a></div>
</div>
<script>
const CODE="{code}";
const LOCKED="{locked_js}";
const EXISTS="{exists_js}";
const TITLE={repr(title or "")};
const ROOM_NAME={repr(room_name or "")};
const MEMBERS={members};
const META_URL="/party/join/"+encodeURIComponent(CODE)+"/meta";
let watchPath = {repr(watch_js)};
let channelId = {repr(ch)};
let autoTimer = null;
let autoLeft = 0;
let autoCancelled = false;
let roomLocked = LOCKED === "1";

function $(id){{ return document.getElementById(id); }}
function setErr(msg){{ $("err").textContent = msg || ""; }}

function guestFallbackName() {{
  try {{
    let id = localStorage.getItem("sd_party_client_id") || "";
    if (!id) {{
      id = (crypto.randomUUID && crypto.randomUUID()) ||
        ("c" + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem("sd_party_client_id", id);
    }}
    const suf = String(id).replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "GUEST";
    return "Guest-" + suf;
  }} catch (e) {{
    return "Guest";
  }}
}}

try {{
  const saved = (localStorage.getItem("sd_party_name") || "").trim();
  if (saved && saved.toLowerCase() !== "guest") $("name").value = saved;
  else {{
    const gen = guestFallbackName();
    $("name").value = gen;
    try {{ localStorage.setItem("sd_party_name", gen); }} catch (e2) {{}}
  }}
}} catch (e) {{ $("name").value = guestFallbackName(); }}

function buildWatchUrl(base, name) {{
  let path = base || watchPath || "/tv/";
  if (channelId && (!path || path === "/tv/" || path === "/tv")) {{
    path = "/tv/" + encodeURIComponent(channelId);
  }}
  const join = path + (path.includes("?") ? "&" : "?") +
    "party=" + encodeURIComponent(CODE) +
    "&name=" + encodeURIComponent(name || "Guest");
  return join;
}}

function cancelAuto(reason) {{
  autoCancelled = true;
  if (autoTimer) {{ clearInterval(autoTimer); autoTimer = null; }}
  const hold = $("holdAuto");
  if (hold) hold.hidden = true;
  const hint = $("hint");
  if (hint && reason) hint.textContent = reason;
  else if (hint) hint.textContent = "Tap Join & watch when you are ready.";
  const go = $("go");
  if (go && !go.disabled) go.textContent = "Join & watch";
}}

function goWatch() {{
  if (EXISTS !== "1") {{
    setErr("Room not found or expired.");
    return;
  }}
  const n = ($("name").value || "").trim() || guestFallbackName();
  const p = (($("pwd") && $("pwd").value) || "").trim();
  if (roomLocked && !p) {{
    cancelAuto("Enter the room password, then Join & watch.");
    setErr("This party needs a password.");
    $("pwd").focus();
    return;
  }}
  setErr("");
  cancelAuto("");
  try {{
    sessionStorage.setItem("sd_party_pending", CODE);
    sessionStorage.setItem("sd_party_name_pending", n);
    if (p) sessionStorage.setItem("sd_party_password_pending", p);
    else sessionStorage.removeItem("sd_party_password_pending");
    localStorage.setItem("sd_party_name", n);
    const recent = JSON.parse(localStorage.getItem("sd_party_recent") || "[]");
    const entry = {{ code: CODE, name: ROOM_NAME || ("Party " + CODE), title: TITLE || "", ts: Date.now() }};
    const next = [entry].concat(recent.filter((x) => x && x.code !== CODE)).slice(0, 12);
    localStorage.setItem("sd_party_recent", JSON.stringify(next));
  }} catch (e) {{}}
  $("go").disabled = true;
  $("go").textContent = "Opening…";
  location.href = buildWatchUrl(watchPath, n);
}}

function startAutoJoin() {{
  if (EXISTS !== "1" || roomLocked || autoCancelled) return;
  const hold = $("holdAuto");
  if (hold) hold.hidden = false;
  autoLeft = 2;
  const tick = () => {{
    if (autoCancelled) return;
    const go = $("go");
    if (go) go.textContent = autoLeft > 0 ? ("Joining in " + autoLeft + "…") : "Opening…";
    const hint = $("hint");
    if (hint) hint.textContent = "Auto-joining the stream. Tap Stay on this page to edit your name first.";
    if (autoLeft <= 0) {{
      if (autoTimer) {{ clearInterval(autoTimer); autoTimer = null; }}
      goWatch();
      return;
    }}
    autoLeft -= 1;
  }};
  tick();
  autoTimer = setInterval(tick, 1000);
}}

$("go").onclick = goWatch;
$("goHome").onclick = () => {{ location.href = "/party"; }};
const holdBtn = $("holdAuto");
if (holdBtn) holdBtn.onclick = () => cancelAuto("Auto-join paused. Edit your name, then tap Join & watch.");
["name","pwd"].forEach((id) => {{
  const el = $(id);
  if (!el) return;
  el.addEventListener("keydown", (e) => {{ if (e.key === "Enter") goWatch(); }});
  el.addEventListener("focus", () => cancelAuto(""));
  el.addEventListener("input", () => cancelAuto(""));
}});

async function refreshMeta() {{
  if (EXISTS !== "1") return;
  try {{
    const r = await fetch(META_URL, {{ credentials: "same-origin" }});
    const data = await r.json();
    if (!data || !data.ok) {{
      cancelAuto("");
      $("statusBadge").textContent = "Room missing";
      $("statusBadge").classList.add("gone");
      $("joinForm").hidden = true;
      $("missingBlock").hidden = false;
      $("meta").textContent = "This room was not found or has expired.";
      return;
    }}
    if (data.name) {{
      $("roomHeading").textContent = data.name;
    }}
    if (data.watchPath) watchPath = String(data.watchPath);
    if (data.channelId) channelId = String(data.channelId);
    if (data.title) {{
      $("meta").textContent = "Now playing: " + data.title +
        (data.memberCount ? " · " + data.memberCount + " watching" : "");
    }} else if (data.memberCount) {{
      $("meta").textContent = data.memberCount + " watching";
    }}
    if (data.locked) {{
      roomLocked = true;
      $("pwdWrap").style.display = "block";
      $("statusBadge").textContent = "Locked";
      $("statusBadge").classList.add("lock");
      cancelAuto("This party needs a password before joining.");
    }}
  }} catch (e) {{}}
}}
if (EXISTS === "1") {{
  if (MEMBERS) $("meta").textContent = ($("meta").textContent || "") + (MEMBERS ? " · " + MEMBERS + " watching" : "");
  if (LOCKED === "1") $("statusBadge").classList.add("lock");
  setTimeout(refreshMeta, 2500);
  setInterval(refreshMeta, 12000);
  setTimeout(startAutoJoin, 400);
}} else {{
  $("statusBadge").classList.add("gone");
}}
</script>
<script src="/tv-assets/pull_reload.js" defer></script>
</body></html>"""


def render_party_home_page() -> str:
    return """<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
<meta name="theme-color" content="#0b0d12"/>
<meta name="description" content="Browse public Watch Parties, resume, and create a room — StepDaddyLiveHD"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="StepDaddyLiveHD"/>
<meta property="og:title" content="Watch Party — StepDaddyLiveHD"/>
<meta property="og:description" content="Join a public room or start your own Watch Party."/>
<meta property="og:image" content="/tv-assets/icon-512.png"/>
<meta name="twitter:card" content="summary"/>
<link rel="canonical" href="/party"/>
<link rel="manifest" href="/tv-assets/site.webmanifest"/>
<link rel="apple-touch-icon" href="/tv-assets/icon-192.png"/>
<title>Watch Party — StepDaddyLiveHD</title>
<style>
:root { --bg:#0b0d12; --card:#141820; --line:#2a3140; --text:#e8edf5; --muted:#9aa4b2; --accent:#2563eb; --good:#34d399; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:radial-gradient(1000px 480px at 10% -10%, #1a2744 0%, var(--bg) 50%);
  color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
header { display:flex; align-items:center; gap:12px; padding:18px 20px; border-bottom:1px solid var(--line);
  position:sticky; top:0; background:rgba(11,13,18,.92); backdrop-filter:blur(10px); z-index:5; }
header img { width:36px; height:36px; border-radius:8px; }
header h1 { margin:0; font-size:1.15rem; flex:1; }
header a.nav { color:#93c5fd; text-decoration:none; font-size:14px; margin-left:10px; }
main { max-width:920px; margin:0 auto; padding:20px 16px 48px; display:grid; gap:18px; }
.panel { background:var(--card); border:1px solid var(--line); border-radius:16px; padding:16px 16px 14px; }
.panel h2 { margin:0 0 10px; font-size:1rem; }
.muted { color:var(--muted); font-size:13px; }
.grid { display:grid; gap:10px; }
@media (min-width:720px) { .grid.cards { grid-template-columns:repeat(2,minmax(0,1fr)); } }
.card { display:flex; gap:12px; align-items:center; padding:12px; border-radius:12px; border:1px solid var(--line); background:#0f131a; }
.card .body { flex:1; min-width:0; }
.card strong { display:block; font-size:14px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.card span { display:block; font-size:12px; color:var(--muted); margin-top:2px; }
.poster { width:44px; height:66px; border-radius:6px; object-fit:cover; background:#0b0d12; flex-shrink:0; }
.poster.ph { display:grid; place-items:center; font-size:15px; font-weight:700; color:#e8edf5; border:1px solid var(--line);
  background:linear-gradient(145deg,#243044 0%,#121820 100%); }
button, .btn { appearance:none; border:0; border-radius:10px; padding:10px 14px; background:var(--accent); color:#fff;
  font-weight:700; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; font-size:13px; }
button.secondary, a.btn.secondary { background:transparent; border:1px solid var(--line); color:var(--text); font-weight:600; }
button:disabled { opacity:.5; cursor:not-allowed; }
.actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
form.row { display:flex; gap:8px; flex-wrap:wrap; }
form.row input { flex:1; min-width:140px; padding:11px 12px; border-radius:10px; border:1px solid var(--line);
  background:#0b0d12; color:var(--text); font-size:14px; }
.pill { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); }
.dot { width:8px; height:8px; border-radius:50%; background:var(--good); }
.chip { display:inline-block; font-size:11px; padding:2px 7px; border-radius:999px; border:1px solid var(--line); color:var(--muted); margin-left:6px; }
.err { color:#f87171; font-size:13px; margin-top:8px; min-height:18px; }
.empty { padding:8px 0; color:var(--muted); font-size:13px; }
</style></head>
<body>
<header>
  <img src="/tv-assets/icon-192.png" alt=""/>
  <h1>Watch Party</h1>
  <a class="nav" href="/tv/">TV</a>
  <a class="nav" href="/vod">VOD</a>
</header>
<main>
  <section class="panel" id="hero">
    <p class="muted" style="margin:0 0 14px;font-size:14px;line-height:1.45">Watch together — create a room, enter a code, or jump into something nearby.</p>
    <div class="actions" style="margin:0" role="group" aria-label="Party actions">
      <button type="button" id="ctaCreate" aria-expanded="false" aria-controls="createPanel">Create party</button>
      <button type="button" class="secondary" id="ctaJoin" aria-expanded="false" aria-controls="joinPanel">Enter code</button>
    </div>
  </section>

  <section class="panel" id="createPanel" hidden>
    <h2>Create a party</h2>
    <p class="muted">Name it, choose public or private, then start on live TV or VOD.</p>
    <form class="row" id="createMeta" onsubmit="return false">
      <input id="createName" placeholder="Room name" maxlength="64" autocomplete="off"/>
      <input id="joinName" placeholder="Display name" maxlength="32" autocomplete="nickname"/>
    </form>
    <label class="muted" style="display:flex;gap:8px;align-items:center;margin-top:10px;cursor:pointer">
      <input type="checkbox" id="createPublic" checked/> Public room (browseable on this PIN)
    </label>
    <form class="row" style="margin-top:10px" onsubmit="return false">
      <input id="createPassword" type="password" placeholder="Password (optional)" maxlength="64" autocomplete="new-password"/>
    </form>
    <div class="actions">
      <a class="btn" id="startLive" href="/tv/?party_create=1">Start on live TV</a>
      <a class="btn secondary" id="startVod" href="/vod?party_create=1">Start from VOD</a>
      <a class="btn secondary" id="startLast" href="/tv/?party_create=1" hidden>Start on last channel</a>
    </div>
  </section>

  <section class="panel" id="joinPanel" hidden>
    <h2>Enter code</h2>
    <form class="row" id="joinForm">
      <input id="joinCode" placeholder="Party code" maxlength="8" autocomplete="off" spellcheck="false" aria-label="Party code"/>
      <input id="joinNameJoin" placeholder="Display name" maxlength="32" autocomplete="nickname" aria-label="Display name"/>
      <button type="submit">Join</button>
    </form>
    <p class="err" id="joinErr"></p>
  </section>

  <section class="panel" id="nearbyPanel">
    <h2>Nearby on this Wi‑Fi</h2>
    <p class="muted">Rooms announcing on this network. Locked rooms still need a password.</p>
    <div class="grid cards" id="nearbyList"><p class="empty">Checking…</p></div>
  </section>

  <section class="panel">
    <h2>Continue / recent</h2>
    <div class="grid cards" id="continueList"><p class="empty">Loading…</p></div>
  </section>

  <section class="panel">
    <h2>Live public parties</h2>
    <div class="grid cards" id="publicList"><p class="empty">Loading…</p></div>
  </section>

  <section class="panel">
    <h2>Who’s watching</h2>
    <p class="pill"><span class="dot"></span> <span id="onlineSummary">Checking…</span></p>
    <div class="grid" id="onlineList" style="margin-top:10px"></div>
  </section>

  <p class="muted" style="font-size:12px"><a class="nav" href="/tv/" style="color:#93c5fd;text-decoration:none;font-weight:600">TV Guide</a> · Invite tips: share the link, or use Wi‑Fi nearby from inside a party.</p>
</main>
<script>
function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function $(id) { return document.getElementById(id); }
try {
  const n = localStorage.getItem("sd_party_name") || "";
  if (n) {
    if ($("joinName")) $("joinName").value = n;
    if ($("joinNameJoin")) $("joinNameJoin").value = n;
  }
} catch (e) {}

let createExpanded = false, joinExpanded = false;
function syncCta() {
  $("createPanel").hidden = !createExpanded;
  $("joinPanel").hidden = !joinExpanded;
  $("ctaCreate").setAttribute("aria-expanded", createExpanded ? "true" : "false");
  $("ctaJoin").setAttribute("aria-expanded", joinExpanded ? "true" : "false");
}
$("ctaCreate").onclick = () => { createExpanded = !createExpanded; if (createExpanded) joinExpanded = false; syncCta(); };
$("ctaJoin").onclick = () => { joinExpanded = !joinExpanded; if (joinExpanded) createExpanded = false; syncCta(); };
function stashCreate() {
  try {
    sessionStorage.setItem("sd_party_create_name", ($("createName").value || "").trim());
    sessionStorage.setItem("sd_party_create_public", $("createPublic").checked ? "1" : "0");
    const pwd = ($("createPassword").value || "").trim();
    if (pwd) sessionStorage.setItem("sd_party_create_password", pwd);
    else sessionStorage.removeItem("sd_party_create_password");
    localStorage.setItem("sd_party_name", ($("joinName").value || "Guest").trim() || "Guest");
  } catch (e) {}
}
["startLive","startVod","startLast"].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener("click", stashCreate);
});

function watchJoinUrl(code, name, watchPath) {
  let path = watchPath || "/tv/";
  return path + (path.includes("?") ? "&" : "?") +
    "party=" + encodeURIComponent(code) +
    "&name=" + encodeURIComponent(name || "Guest");
}

function stashPending(code, name) {
  try {
    sessionStorage.setItem("sd_party_pending", code);
    sessionStorage.setItem("sd_party_name_pending", name || "Guest");
    localStorage.setItem("sd_party_name", name || "Guest");
  } catch (e) {}
}

$("joinForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = ($("joinCode").value || "").trim().toUpperCase();
  const name = (($("joinNameJoin") && $("joinNameJoin").value) || ($("joinName") && $("joinName").value) || "Guest").trim() || "Guest";
  $("joinErr").textContent = "";
  if (!code || code.length < 4) {
    $("joinErr").textContent = "Enter a valid party code.";
    return;
  }
  stashPending(code, name);
  let watch = "/tv/";
  try {
    const r = await fetch("/party/join/" + encodeURIComponent(code) + "/meta", { credentials: "same-origin" });
    const data = await r.json();
    if (data && data.ok && data.watchPath) watch = data.watchPath;
    else if (data && data.error === "not_found") {
      $("joinErr").textContent = "Room not found or expired.";
      return;
    }
  } catch (err) {}
  location.href = watchJoinUrl(code, name, watch);
});

function roomCard(room, opts) {
  opts = opts || {};
  const title = room.name || room.title || room.code || "Party";
  const meta = [];
  if (room.memberCount != null) meta.push(room.memberCount + " watching");
  if (room.locked) meta.push("Locked");
  if (room.title && room.title !== title) meta.push(room.title);
  if (room.channelId) meta.push("Ch " + room.channelId);
  function usable(u) {
    if (u == null) return "";
    const s = String(u).trim();
    return (!s || s === "null" || s === "undefined") ? "" : s;
  }
  const poster = usable(room.posterPath);
  const logo = usable(room.logoPath || room.logo);
  const letter = String(title).trim().charAt(0).toUpperCase() || "P";
  let thumb;
  if (poster || logo) {
    const src = poster || logo;
    const fb = poster && logo && poster !== logo ? logo : "";
    thumb = '<img class="poster" src="' + esc(src) + '" alt="" loading="lazy"' +
      (fb ? ' data-fallback="' + esc(fb) + '"' : "") +
      ' data-letter="' + esc(letter) + '"' +
      " onerror=\"this.onerror=null;var f=this.getAttribute('data-fallback');if(f){this.removeAttribute('data-fallback');this.src=f;return;}var d=document.createElement('div');d.className='poster ph';d.textContent=this.getAttribute('data-letter')||'?';this.replaceWith(d);\"/>";
  } else {
    thumb = '<div class="poster ph">' + esc(opts.badge || letter) + '</div>';
  }
  const href = opts.href || watchJoinUrl(room.code, $("joinName").value || "Guest", room.watchPath);
  return (
    '<div class="card">' + thumb +
    '<div class="body"><strong>' + esc(title) + '</strong><span>' + esc(meta.join(" · ")) + '</span></div>' +
    '<a class="btn" href="' + esc(href) + '">Join</a></div>'
  );
}

async function loadNearby() {
  const el = $("nearbyList");
  if (!el) return;
  try {
    const r = await fetch("/party/nearby", { credentials: "same-origin" });
    if (r.status === 401) {
      el.innerHTML = '<p class="empty">Sign in with PIN to see nearby parties.</p>';
      return;
    }
    const data = await r.json();
    const rooms = (data && data.rooms) || [];
    if (!rooms.length) {
      el.innerHTML = '<p class="empty">No parties on this Wi‑Fi right now.</p>';
      return;
    }
    el.innerHTML = rooms.map((room) => roomCard(room)).join("");
    const panel = $("nearbyPanel");
    const main = panel && panel.parentNode;
    if (panel && main && rooms.length) {
      panel.classList.add("has-nearby");
      const hero = $("hero");
      if (hero && hero.nextSibling !== panel) main.insertBefore(panel, hero.nextSibling);
    }
  } catch (e) {
    el.innerHTML = '<p class="empty">Nearby discovery unavailable.</p>';
  }
}

async function loadPublic() {
  const el = $("publicList");
  try {
    const r = await fetch("/party/public", { credentials: "same-origin" });
    if (r.status === 401) {
      el.innerHTML = '<p class="empty">Sign in with PIN to see public parties.</p>';
      return;
    }
    const data = await r.json();
    const rooms = (data && data.rooms) || [];
    if (!rooms.length) {
      el.innerHTML = '<p class="empty">No public parties right now.</p>';
      return;
    }
    el.innerHTML = rooms.map((room) => roomCard(room)).join("");
  } catch (e) {
    el.innerHTML = '<p class="empty">Could not load public parties.</p>';
  }
}

async function loadPresence() {
  try {
    const r = await fetch("/party/presence", { credentials: "same-origin" });
    if (r.status === 401) {
      $("onlineSummary").textContent = "Sign in to see who’s online";
      return;
    }
    const data = await r.json();
    const n = (data && data.inParties) || 0;
    const priv = (data && data.privateRooms) || 0;
    $("onlineSummary").textContent =
      n + " watching now" + (priv ? " · " + priv + " private room" + (priv === 1 ? "" : "s") : "");
    const people = (data && data.online) || [];
    const el = $("onlineList");
    if (!people.length) {
      el.innerHTML = '<p class="empty">Nobody in a party right now.</p>';
      return;
    }
    el.innerHTML = people.slice(0, 24).map((p) => {
      const where = p.roomName || (p.public ? "Public party" : "In a party");
      const title = p.title ? " · " + p.title : "";
      return (
        '<div class="card"><div class="body"><strong>' + esc(p.displayName || "Guest") +
        '</strong><span>' + esc(where + title) + '</span></div>' +
        (p.watchPath && p.code
          ? '<a class="btn secondary" href="' + esc(watchJoinUrl(p.code, $("joinName").value || "Guest", p.watchPath)) + '">Join</a>'
          : "") +
        "</div>"
      );
    }).join("");
  } catch (e) {
    $("onlineSummary").textContent = "Presence unavailable";
  }
}

function loadContinue() {
  const el = $("continueList");
  let recent = [];
  let place = null;
  try { recent = JSON.parse(localStorage.getItem("sd_party_recent") || "[]"); } catch (e) {}
  try { place = JSON.parse(localStorage.getItem("sd_last_place") || "null"); } catch (e) {}
  const cards = [];
  const seen = {};
  if (place && place.partyCode) {
    seen[String(place.partyCode).toUpperCase()] = 1;
    cards.push(roomCard({
      code: place.partyCode,
      name: place.title || "Resume party",
      title: place.path || "",
    }, { href: "/party/join/" + encodeURIComponent(place.partyCode) }));
  }
  if (place && place.channelId && !place.partyCode) {
    const href = "/tv/" + encodeURIComponent(place.channelId) + "?party_create=1";
    cards.push(
      '<div class="card"><div class="poster ph">TV</div><div class="body"><strong>Party on Ch ' +
      esc(place.channelId) + '</strong><span>' + esc(place.title || "Last live channel") +
      '</span></div><a class="btn" href="' + esc(href) + '">Start</a></div>'
    );
    $("startLast").hidden = false;
    $("startLast").href = href;
    $("startLast").textContent = "Start on Ch " + place.channelId;
  }
  if (place && place.tmdbId) {
    const mt = (place.mediaType === "tv" || place.mediaType === "series") ? "tv" : "movie";
    let path = "/vod/" + mt + "/" + encodeURIComponent(place.tmdbId);
    if (mt === "tv" && place.season) {
      path += "?season=" + encodeURIComponent(place.season);
      if (place.episode) path += "&episode=" + encodeURIComponent(place.episode);
      path += "&party_create=1";
    } else path += (path.includes("?") ? "&" : "?") + "party_create=1";
    cards.push(
      '<div class="card"><div class="poster ph">VOD</div><div class="body"><strong>Continue ' +
      esc(place.title || "title") + '</strong><span>Start a party on this title</span></div>' +
      '<a class="btn" href="' + esc(path) + '">Start</a></div>'
    );
  }
  if (Array.isArray(recent)) {
    recent.slice(0, 8).forEach((room) => {
      const code = String((room && room.code) || "").toUpperCase();
      if (!code || seen[code]) return;
      seen[code] = 1;
      const href = "/party/join/" + encodeURIComponent(code);
      cards.push(roomCard({
        code: code,
        name: room.name || code,
        title: room.title,
      }, { href: href }));
    });
  }
  el.innerHTML = cards.length ? cards.join("") : '<p class="empty">No recent parties on this device yet.</p>';
}

loadNearby();
loadPublic();
loadPresence();
loadContinue();
setInterval(() => { loadNearby(); loadPublic(); loadPresence(); }, 22000);
</script>
<script src="/tv-assets/pull_reload.js" defer></script>
</body></html>"""
