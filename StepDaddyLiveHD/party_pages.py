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

    poster_html = (
        f'<img class="poster" src="{poster}" alt="" loading="lazy"/>' if poster else ""
    )
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
    <button type="button" id="go">Watch together</button>
  </div>
  <div id="missingBlock" {"hidden" if exists else ""}>
    <p class="err">Room not found or expired. Ask the host for a new invite, or browse open parties.</p>
    <button type="button" class="secondary" id="goHome">Open Party Home</button>
  </div>
  <p class="err" id="err"></p>
  <p class="hint" id="hint">After PIN login you land on the stream with this party already queued.</p>
  <div class="links"><a href="/party">Party Home</a> · <a href="/tv/">TV Guide</a></div>
</div>
<script>
const CODE="{code}";
const WATCH={repr(watch_js)};
const LOCKED="{locked_js}";
const EXISTS="{exists_js}";
const TITLE={repr(title or "")};
const ROOM_NAME={repr(room_name or "")};
const MEMBERS={members};
const CHANNEL={repr(ch)};
const META_URL="/party/join/"+encodeURIComponent(CODE)+"/meta";

function $(id){{ return document.getElementById(id); }}
function setErr(msg){{ $("err").textContent = msg || ""; }}

try {{
  const saved = localStorage.getItem("sd_party_name") || "";
  if (saved) $("name").value = saved;
  else $("name").value = "Guest";
}} catch (e) {{ $("name").value = "Guest"; }}

function buildWatchUrl(base, name) {{
  let path = base || "/tv/";
  if (CHANNEL && (!path || path === "/tv/" || path === "/tv")) {{
    path = "/tv/" + encodeURIComponent(CHANNEL);
  }}
  const join = path + (path.includes("?") ? "&" : "?") +
    "party=" + encodeURIComponent(CODE) +
    "&name=" + encodeURIComponent(name || "Guest");
  return join;
}}

function goWatch() {{
  if (EXISTS !== "1") {{
    setErr("Room not found or expired.");
    return;
  }}
  const n = ($("name").value || "Guest").trim() || "Guest";
  const p = (($("pwd") && $("pwd").value) || "").trim();
  if (LOCKED === "1" && !p) {{
    setErr("This party needs a password.");
    $("pwd").focus();
    return;
  }}
  setErr("");
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
  location.href = buildWatchUrl(WATCH, n);
}}

$("go").onclick = goWatch;
$("goHome").onclick = () => {{ location.href = "/party"; }};
["name","pwd"].forEach((id) => {{
  const el = $(id);
  if (el) el.addEventListener("keydown", (e) => {{ if (e.key === "Enter") goWatch(); }});
}});

async function refreshMeta() {{
  if (EXISTS !== "1") return;
  try {{
    const r = await fetch(META_URL, {{ credentials: "same-origin" }});
    const data = await r.json();
    if (!data || !data.ok) {{
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
    if (data.title) {{
      $("meta").textContent = "Now playing: " + data.title +
        (data.memberCount ? " · " + data.memberCount + " watching" : "");
    }} else if (data.memberCount) {{
      $("meta").textContent = data.memberCount + " watching";
    }}
    if (data.locked) {{
      $("pwdWrap").style.display = "block";
      $("statusBadge").textContent = "Locked";
      $("statusBadge").classList.add("lock");
    }}
  }} catch (e) {{}}
}}
if (EXISTS === "1") {{
  if (MEMBERS) $("meta").textContent = ($("meta").textContent || "") + (MEMBERS ? " · " + MEMBERS + " watching" : "");
  if (LOCKED === "1") $("statusBadge").classList.add("lock");
  setTimeout(refreshMeta, 2500);
  setInterval(refreshMeta, 12000);
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
.poster.ph { display:grid; place-items:center; font-size:11px; color:var(--muted); border:1px solid var(--line); }
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
  <section class="panel">
    <h2>Join with code</h2>
    <form class="row" id="joinForm">
      <input id="joinCode" placeholder="Party code" maxlength="8" autocomplete="off" spellcheck="false"/>
      <input id="joinName" placeholder="Display name" maxlength="32" autocomplete="nickname"/>
      <button type="submit">Join</button>
    </form>
    <p class="err" id="joinErr"></p>
  </section>

  <section class="panel">
    <h2>Create a party</h2>
    <p class="muted">Start on live TV or open VOD, then invite friends with a code.</p>
    <div class="actions">
      <a class="btn" id="startLive" href="/tv/?party_create=1">Start on live TV</a>
      <a class="btn secondary" id="startVod" href="/vod?party_create=1">Start from VOD</a>
      <a class="btn secondary" id="startLast" href="/tv/?party_create=1" hidden>Start on last channel</a>
    </div>
  </section>

  <section class="panel">
    <h2>Who’s online</h2>
    <p class="pill"><span class="dot"></span> <span id="onlineSummary">Checking…</span></p>
    <div class="grid" id="onlineList" style="margin-top:10px"></div>
  </section>

  <section class="panel">
    <h2>Active public parties</h2>
    <div class="grid cards" id="publicList"><p class="empty">Loading…</p></div>
  </section>

  <section class="panel">
    <h2>Your recent parties</h2>
    <div class="grid" id="recentList"><p class="empty">No recent parties on this device.</p></div>
  </section>

  <section class="panel">
    <h2>Suggested</h2>
    <div class="grid" id="suggestList"><p class="empty">Watch something, then start a party from here.</p></div>
  </section>
</main>
<script>
function esc(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function $(id) { return document.getElementById(id); }
try {
  const n = localStorage.getItem("sd_party_name") || "";
  if (n) $("joinName").value = n;
} catch (e) {}

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
  const name = ($("joinName").value || "Guest").trim() || "Guest";
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
  const poster = room.posterPath
    ? '<img class="poster" src="' + esc(room.posterPath) + '" alt=""/>'
    : '<div class="poster ph">LIVE</div>';
  const href = opts.href || watchJoinUrl(room.code, $("joinName").value || "Guest", room.watchPath);
  return (
    '<div class="card">' + poster +
    '<div class="body"><strong>' + esc(title) + '</strong><span>' + esc(meta.join(" · ")) + '</span></div>' +
    '<a class="btn" href="' + esc(href) + '">Join</a></div>'
  );
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
      n + " in parties now" + (priv ? " · " + priv + " private room" + (priv === 1 ? "" : "s") : "");
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

function loadRecent() {
  const el = $("recentList");
  let recent = [];
  try { recent = JSON.parse(localStorage.getItem("sd_party_recent") || "[]"); } catch (e) {}
  if (!Array.isArray(recent) || !recent.length) {
    el.innerHTML = '<p class="empty">No recent parties on this device.</p>';
    return;
  }
  el.innerHTML = recent.slice(0, 8).map((room) => {
    const href = "/party/join/" + encodeURIComponent(room.code || "");
    return roomCard({
      code: room.code,
      name: room.name,
      title: room.title,
      watchPath: href,
      memberCount: null,
    }, { href: href });
  }).join("");
}

function loadSuggested() {
  const el = $("suggestList");
  let place = null;
  try { place = JSON.parse(localStorage.getItem("sd_last_place") || "null"); } catch (e) {}
  const cards = [];
  if (place && place.channelId) {
    const href = "/tv/" + encodeURIComponent(place.channelId) + "?party_create=1";
    cards.push(
      '<div class="card"><div class="poster ph">TV</div><div class="body"><strong>Start party on Ch ' +
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
  if (place && place.partyCode) {
    cards.push(
      '<div class="card"><div class="poster ph">↻</div><div class="body"><strong>Resume party ' +
      esc(place.partyCode) + '</strong><span>' + esc(place.title || place.path || "") +
      '</span></div><a class="btn secondary" href="/party/join/' + esc(place.partyCode) + '">Rejoin</a></div>'
    );
  }
  el.innerHTML = cards.length ? cards.join("") : '<p class="empty">Watch something, then start a party from here.</p>';
}

loadPublic();
loadPresence();
loadRecent();
loadSuggested();
setInterval(() => { loadPublic(); loadPresence(); }, 20000);
</script>
<script src="/tv-assets/pull_reload.js" defer></script>
</body></html>"""
