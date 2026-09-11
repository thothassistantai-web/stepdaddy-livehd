"""Resolve missing season/episode via TVmaze plot/subtitle matching.

epg.pw JSON (and US gzip) often ship series titles + synopses with no
episode-num. UI (guide / on-air / X-Ray) needs ``season`` / ``episode`` /
``episode_label``. Match the EPG subtitle/desc against TVmaze episode
summaries for the same series title.
"""

from __future__ import annotations

import hashlib
import html
import json
import logging
import re
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from StepDaddyLiveHD.supplements.episode_meta import format_episode_label

log = logging.getLogger(__name__)

TVMAZE_API = "https://api.tvmaze.com"
_UA = "Mozilla/5.0 (X11; Linux x86_64) StepDaddy-Gateway/1.0 (+episode-resolve)"
_CACHE_DIR = Path(__file__).resolve().parents[2] / "data" / "episode_resolve"
_SHOW_TTL_SEC = 14 * 24 * 3600
_NEG_TTL_SEC = 6 * 3600
_MIN_PLOT_CHARS = 40
_MIN_OVERLAP = 6
_MIN_SCORE = 0.45
_STOP = frozenset(
    """
    a an the and or of to in on for with by from is are was were be been being
    that this these those when who whom which their his her its they them we
    our you your as at into about after before while during over under out up
    down off than then so if but not no nor only just also into onto upon
    detectives detective police unit special victims crime case
    """.split()
)

_lock = threading.Lock()
_mem_show: dict[str, tuple[float, list[dict[str, Any]] | None]] = {}
_mem_hit: dict[str, tuple[float, dict[str, Any] | None]] = {}


def _norm_text(value: str) -> str:
    s = html.unescape(value or "")
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def _tokens(value: str) -> set[str]:
    return {t for t in _norm_text(value).split() if t and t not in _STOP and len(t) > 1}


def _cache_path(kind: str, key: str) -> Path:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:24]
    return _CACHE_DIR / kind / f"{digest}.json"


def _read_disk(kind: str, key: str, ttl: float) -> Any | None:
    path = _cache_path(kind, key)
    try:
        if not path.is_file():
            return None
        age = time.time() - path.stat().st_mtime
        if age > ttl:
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        return None


def _write_disk(kind: str, key: str, payload: Any) -> None:
    path = _cache_path(kind, key)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        log.debug("episode_resolve disk write failed: %s", exc)


def _http_json(url: str, timeout: float = 12.0) -> Any | None:
    try:
        req = urllib.request.Request(
            url, headers={"User-Agent": _UA, "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as exc:
        log.debug("episode_resolve fetch failed %s: %s", url, exc)
        return None


def _load_show_episodes(title: str) -> list[dict[str, Any]] | None:
    clean = (title or "").strip()
    if len(clean) < 2:
        return None
    key = _norm_text(clean)
    now = time.time()
    with _lock:
        hit = _mem_show.get(key)
        if hit and now - hit[0] < _SHOW_TTL_SEC:
            return hit[1]

    disk = _read_disk("show", key, _SHOW_TTL_SEC)
    if isinstance(disk, dict) and "episodes" in disk:
        eps = disk.get("episodes")
        if isinstance(eps, list):
            with _lock:
                _mem_show[key] = (now, eps)
            return eps

    url = (
        f"{TVMAZE_API}/singlesearch/shows?q={urllib.parse.quote(clean)}"
        f"&embed=episodes"
    )
    data = _http_json(url)
    eps: list[dict[str, Any]] | None = None
    if isinstance(data, dict):
        embedded = data.get("_embedded") if isinstance(data.get("_embedded"), dict) else {}
        raw = embedded.get("episodes") if isinstance(embedded, dict) else None
        if isinstance(raw, list):
            eps = []
            for row in raw:
                if not isinstance(row, dict):
                    continue
                season = row.get("season")
                number = row.get("number")
                try:
                    season_i = int(season) if season is not None else None
                    number_i = int(number) if number is not None else None
                except (TypeError, ValueError):
                    continue
                if season_i is None or number_i is None:
                    continue
                eps.append(
                    {
                        "season": season_i,
                        "episode": number_i,
                        "name": str(row.get("name") or "").strip(),
                        "summary": str(row.get("summary") or ""),
                    }
                )
    _write_disk(
        "show",
        key,
        {
            "title": clean,
            "matched": str((data or {}).get("name") or "") if isinstance(data, dict) else "",
            "episodes": eps or [],
            "fetched_at": now,
        },
    )
    with _lock:
        _mem_show[key] = (now, eps)
    return eps


def _score_plot(plot_tokens: set[str], summary: str) -> tuple[float, int]:
    st = _tokens(summary)
    if not plot_tokens or not st:
        return 0.0, 0
    inter = len(plot_tokens & st)
    if inter <= 0:
        return 0.0, 0
    # Prefer covering the EPG plot (guide copy), not the longer TVmaze blurb.
    score = inter / max(len(plot_tokens), 8)
    return score, inter


def resolve_episode_from_plot(
    title: str,
    plot: str,
    *,
    allow_network: bool = True,
) -> dict[str, Any] | None:
    """Return {season, episode, episode_label, episode_name, source, score} or None."""
    title_clean = (title or "").strip()
    plot_clean = (plot or "").strip()
    if not title_clean or len(plot_clean) < _MIN_PLOT_CHARS:
        return None

    cache_key = f"{_norm_text(title_clean)}|{_norm_text(plot_clean)[:240]}"
    now = time.time()
    with _lock:
        mem = _mem_hit.get(cache_key)
        if mem and now - mem[0] < _SHOW_TTL_SEC:
            return dict(mem[1]) if mem[1] else None

    disk = _read_disk("hit", cache_key, _SHOW_TTL_SEC)
    if isinstance(disk, dict):
        if disk.get("miss"):
            with _lock:
                _mem_hit[cache_key] = (now, None)
            return None
        if disk.get("season") is not None and disk.get("episode") is not None:
            out = {
                "season": int(disk["season"]),
                "episode": int(disk["episode"]),
                "episode_label": str(disk.get("episode_label") or ""),
                "episode_name": str(disk.get("episode_name") or ""),
                "source": str(disk.get("source") or "tvmaze-plot"),
                "score": float(disk.get("score") or 0),
            }
            if not out["episode_label"]:
                out["episode_label"] = format_episode_label(out["season"], out["episode"])
            with _lock:
                _mem_hit[cache_key] = (now, out)
            return dict(out)

    if not allow_network:
        return None

    eps = _load_show_episodes(title_clean)
    if not eps:
        _write_disk("hit", cache_key, {"miss": True, "reason": "no_show"})
        with _lock:
            _mem_hit[cache_key] = (now, None)
        return None

    plot_tokens = _tokens(plot_clean)
    if len(plot_tokens) < 5:
        _write_disk("hit", cache_key, {"miss": True, "reason": "short_plot"})
        with _lock:
            _mem_hit[cache_key] = (now, None)
        return None

    best: tuple[float, int, dict[str, Any]] | None = None
    for ep in eps:
        score, overlap = _score_plot(plot_tokens, str(ep.get("summary") or ""))
        if overlap < _MIN_OVERLAP or score < _MIN_SCORE:
            continue
        if best is None or score > best[0] or (score == best[0] and overlap > best[1]):
            best = (score, overlap, ep)

    if best is None:
        _write_disk("hit", cache_key, {"miss": True, "reason": "no_match"})
        with _lock:
            _mem_hit[cache_key] = (now, None)
        return None

    score, _overlap, ep = best
    season = int(ep["season"])
    episode = int(ep["episode"])
    out = {
        "season": season,
        "episode": episode,
        "episode_label": format_episode_label(season, episode),
        "episode_name": str(ep.get("name") or ""),
        "source": "tvmaze-plot",
        "score": round(float(score), 4),
    }
    _write_disk("hit", cache_key, out)
    with _lock:
        _mem_hit[cache_key] = (now, out)
    return dict(out)


def enrich_api_programme(prog: dict[str, Any], *, allow_network: bool = True) -> dict[str, Any]:
    """Fill season/episode/episode_label on an API programme dict when missing."""
    if not isinstance(prog, dict):
        return prog
    if prog.get("season") is not None and prog.get("episode") is not None:
        if not prog.get("episode_label"):
            prog["episode_label"] = format_episode_label(prog.get("season"), prog.get("episode"))
        return prog
    if prog.get("episode_label"):
        return prog

    title = str(prog.get("title") or "").strip()
    plot = str(prog.get("subtitle") or prog.get("desc") or prog.get("description") or "").strip()
    resolved = resolve_episode_from_plot(title, plot, allow_network=allow_network)
    if not resolved:
        return prog
    prog["season"] = resolved["season"]
    prog["episode"] = resolved["episode"]
    prog["episode_label"] = resolved["episode_label"]
    if prog.get("programme_type") in (None, "", "other", "EPG"):
        prog["programme_type"] = "series"
    return prog
