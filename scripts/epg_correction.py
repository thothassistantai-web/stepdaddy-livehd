#!/usr/bin/env python3
"""EPG correction algorithm + confirmed-case registry helpers.

Learns from high-confidence visually_confirmed repairs so future audits
prefer proven resolutions for the same failure class — not one-off map pins.

Registry: data/epg_confirmed_corrections.json
Protocol: docs/channel-audit/PROTOCOL.md § Confirmed-case feedback loop

Examples:
  python3 scripts/epg_correction.py classify --now-title "ABC World News Now" --region US
  python3 scripts/epg_correction.py lookup 51
  python3 scripts/epg_correction.py list
  python3 scripts/epg_correction.py register --gateway-id 51 --tvg-id ABC.us \\
      --epgpw-pin 464902 --ground-truth "The View" --root-cause gzip_tz_poison \\
      --version 20260908p
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REGISTRY = ROOT / "data" / "epg_confirmed_corrections.json"
CHANNEL_MAP = ROOT / "assets" / "epgpw_channel_map.json"

# Shared with channel-audit daypart heuristics (keep patterns aligned).
_OVERNIGHT_TITLE_RE = re.compile(
    r"\b("
    r"world news now|nightline|jimmy kimmel|late\s*night|after\s*midnight|"
    r"overnight|news now|first look"
    r")\b",
    re.I,
)
_PAID_PROG_RE = re.compile(r"\b(paid\s*programming|program\s*paid|infomercial)\b", re.I)
_DAYTIME_TITLE_RE = re.compile(
    r"\b("
    r"the view|general hospital|gma3|good morning america(?!\s*first\s*look)|"
    r"oprah|live with|the talk|kelly and"
    r")\b",
    re.I,
)

# US OTA call signs (station codes). Prefer these over marketing names for locals/news.
_CALL_SIGN_RE = re.compile(
    r"\b(W[A-Z]{2,3}|K[A-Z]{2,3})\b",
    re.I,
)
_CALL_SIGN_TVG_RE = re.compile(
    r"^(W[A-Z]{2,3}|K[A-Z]{2,3})(?:-DT|-TV|\d)?\b",
    re.I,
)
# Marketing / branding labels that often collide across NY/NJ locals (My9 NJ vs My9 USA vs Fox 5, etc.).
_LOCAL_MARKETING_RE = re.compile(
    r"\b("
    r"my\s*9(?:\s*nj|\s*usa|tv)?|my9(?:tv|nj|usa)?|fox\s*5|foxny|fox\s*ny|cw\s*11|pix\s*11|ny1|"
    r"abc\s*7|nbc\s*(?:4|new\s*york)|cbs\s*(?:2|new\s*york)"
    r")\b",
    re.I,
)

# Confirmation tiers for local/news identity (highest first).
IDENTITY_CONFIRMATION_TIERS = (
    "station_code_visual",  # OCR/visual bug shows call sign (WNYW) or definitive station bug + call-sign EPG
    "station_code_epg",  # tvg/epg.pw pinned by call sign (WNYW-DT) with programme match
    "network_bug_visual",  # on-screen network bug (FOX 5) contradicts catalog marketing name
    "catalog_marketing_name",  # DaddyLive / guide marketing label alone — weakest for locals
)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_registry(path: Path | None = None) -> dict[str, Any]:
    p = path or DEFAULT_REGISTRY
    if not p.exists():
        return {
            "schema_version": "1.0.0",
            "algorithm_version": "1.0.0",
            "updated_at": utc_now(),
            "global_rules": [],
            "root_cause_classes": {},
            "cases": [],
        }
    return json.loads(p.read_text(encoding="utf-8"))


def save_registry(registry: dict[str, Any], path: Path | None = None) -> Path:
    p = path or DEFAULT_REGISTRY
    p.parent.mkdir(parents=True, exist_ok=True)
    registry["updated_at"] = utc_now()
    p.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
    return p


def _case_active(case: dict[str, Any]) -> bool:
    status = (case.get("status") or "active").strip().lower()
    return status not in ("superseded", "inactive", "retired")


def cases_by_gateway(registry: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for case in registry.get("cases") or []:
        if not _case_active(case):
            continue
        gid = str(case.get("gateway_id") or "").strip()
        if not gid:
            continue
        out.setdefault(gid, []).append(case)
    return out


def cases_by_class(registry: dict[str, Any], root_cause: str) -> list[dict[str, Any]]:
    want = (root_cause or "").strip().lower()
    hits = []
    for case in registry.get("cases") or []:
        if not _case_active(case):
            continue
        primary = (case.get("root_cause_class") or "").lower()
        secondary = [c.lower() for c in (case.get("secondary_classes") or [])]
        if primary == want or want in secondary:
            hits.append(case)
    return hits


def active_global_rules(
    registry: dict[str, Any], root_cause: str | None = None
) -> list[dict[str, Any]]:
    rules = []
    for rule in registry.get("global_rules") or []:
        if (rule.get("status") or "active").lower() != "active":
            continue
        if root_cause and (rule.get("root_cause_class") or "").lower() not in (
            root_cause.lower(),
            "false_healthy",
        ):
            # Always include false_healthy auditor rule; otherwise filter by class.
            if (rule.get("root_cause_class") or "").lower() != root_cause.lower():
                continue
        rules.append(rule)
    return rules



def extract_call_sign(*texts: str | None) -> str | None:
    """Extract a US OTA call sign (WNYW, WWOR, WABC, …) from free text or tvg_id."""
    for raw in texts:
        if not raw:
            continue
        s = str(raw).strip()
        # Prefer leading call sign in tvg ids like WNYW-DT.us_locals1
        m = _CALL_SIGN_TVG_RE.match(s.replace("_", "-").split(".")[0])
        if m:
            return m.group(1).upper()
        m = _CALL_SIGN_RE.search(s)
        if m:
            return m.group(1).upper()
    return None


def identity_confirmation_tier(
    *,
    call_sign: str | None = None,
    visual_call_sign: str | None = None,
    visual_network_bug: bool | None = None,
    catalog_name: str | None = None,
    tvg_id: str | None = None,
) -> dict[str, Any]:
    """Rank how strongly we know a local channel's identity.

    Station codes beat marketing names. Visual call-sign / definitive network bug
    that contradicts the catalog → high confidence wrong_label / remap.
    """
    cs = (call_sign or extract_call_sign(tvg_id) or "").upper() or None
    vis_cs = (visual_call_sign or "").upper() or None
    catalog = (catalog_name or "").strip()
    marketing = bool(catalog and _LOCAL_MARKETING_RE.search(catalog))
    tvg_cs = extract_call_sign(tvg_id)

    if vis_cs and (not cs or vis_cs == cs):
        tier = "station_code_visual"
        confidence = "high"
        rationale = f"visual/OCR station code {vis_cs}"
    elif cs and tvg_cs and cs == tvg_cs:
        tier = "station_code_epg"
        confidence = "high"
        rationale = f"EPG/tvg pinned by call sign {cs}"
    elif visual_network_bug and (not marketing or (cs and marketing)):
        tier = "network_bug_visual"
        confidence = "high"
        rationale = "on-screen network bug overrides catalog marketing name"
    else:
        tier = "catalog_marketing_name"
        confidence = "low" if marketing else "medium"
        rationale = "catalog/guide marketing name only — weak for US locals/news"

    return {
        "tier": tier,
        "confidence": confidence,
        "rationale": rationale,
        "call_sign": cs or vis_cs or tvg_cs,
        "catalog_name": catalog or None,
        "marketing_name_risk": marketing,
        "tiers_ranked": list(IDENTITY_CONFIRMATION_TIERS),
    }


def classify_epg_failure(
    *,
    now_title: str | None,
    next_title: str | None = None,
    has_data: bool | None,
    tvg_id: str | None,
    region_hint: str | None = None,
    daypart_hint: str | None = None,
    epg_match_status: str | None = None,
    wrong_feed_suspect: bool | None = None,
    known_bad_tvg: str | None = None,
    catalog_name: str | None = None,
    visual_call_sign: str | None = None,
    visual_network_bug: bool | None = None,
) -> dict[str, Any]:
    """Classify EPG failure into root_cause_class(+candidates) for playbook lookup."""
    title = (now_title or "").strip()
    tvg = (tvg_id or "").strip()
    region = (region_hint or "").upper()
    us_like = region in ("US", "USA") or tvg.lower().endswith(".us") or ".us" in tvg.lower()
    status = (epg_match_status or "").strip().lower()
    classes: list[str] = []
    confidence = "low"
    rationale: list[str] = []
    identity = identity_confirmation_tier(
        call_sign=extract_call_sign(tvg, catalog_name),
        visual_call_sign=visual_call_sign,
        visual_network_bug=visual_network_bug,
        catalog_name=catalog_name,
        tvg_id=tvg,
    )

    if has_data is False or not title:
        classes.append("empty")
        rationale.append("now/next empty or missing programmes")
        confidence = "medium"

    # Catalog marketing name vs visual station/network identity.
    vis_cs = (visual_call_sign or "").upper() or None
    tvg_cs = extract_call_sign(tvg)
    if visual_network_bug or (vis_cs and tvg_cs and vis_cs != tvg_cs):
        classes.append("wrong_label")
        rationale.append(
            "visual network bug / station code contradicts catalog or mapped tvg "
            "(prefer call sign over marketing names like My9/Fox 5)"
        )
        confidence = "high"
        if tvg_cs and vis_cs and vis_cs != tvg_cs:
            classes.append("wrong_tvg")
            classes.append("affiliate_collision")

    if wrong_feed_suspect or status == "mismatch_suspected":
        if us_like and title and _OVERNIGHT_TITLE_RE.search(title):
            classes.append("gzip_tz_poison")
            rationale.append("US daypart mismatch with overnight/news-block title → gzip false +0000 class")
            confidence = "high"
        elif us_like and title and _PAID_PROG_RE.search(title):
            classes.append("gzip_tz_poison")
            classes.append("paid_programming_poison")
            rationale.append("US paid-programming daytime slot often means poisoned gzip cache")
            confidence = "high"
        else:
            classes.append("wrong_feed")
            rationale.append("mismatch_suspected / wrong_feed_suspect without classic gzip signature")
            confidence = "medium"

    if known_bad_tvg and tvg and known_bad_tvg.lower() == tvg.lower():
        classes.append("wrong_tvg")
        rationale.append(f"tvg_id matches known-bad prior id {known_bad_tvg}")
        confidence = "high"

    # OTA callsign tvg on a *national* marketing label is collision risk;
    # for locals/news, callsign tvg is the preferred identity (not a failure alone).
    catalog = (catalog_name or "").strip()
    looks_national = bool(
        catalog
        and re.search(r"\b(USA|Network|HD)\b", catalog, re.I)
        and not _LOCAL_MARKETING_RE.search(catalog)
        and not re.search(r"\b(local|news)\b", catalog, re.I)
    )
    if looks_national and re.match(r"^[A-Z]{3,4}\d", tvg.split(".")[0] if tvg else "", re.I):
        classes.append("affiliate_collision")
        rationale.append("national catalog name mapped to OTA callsign+channel tvg — affiliate collision risk")
        if confidence == "low":
            confidence = "medium"

    if daypart_hint == "daytime" and us_like and title and _OVERNIGHT_TITLE_RE.search(title):
        if "gzip_tz_poison" not in classes:
            classes.append("gzip_tz_poison")
        rationale.append("daytime + overnight title pattern")
        confidence = "high"

    if daypart_hint == "daytime" and us_like and title and _DAYTIME_TITLE_RE.search(title):
        pass

    if not classes and status in ("api_only", "title_plausible"):
        classes.append("false_healthy")
        rationale.append("API-only / title_plausible — not visually confirmed; do not mark healthy")
        confidence = "medium"

    if not classes:
        classes.append("empty" if not title else "wrong_feed")
        rationale.append("fallback class")

    seen: set[str] = set()
    ordered: list[str] = []
    for c in classes:
        if c not in seen:
            seen.add(c)
            ordered.append(c)

    return {
        "primary_class": ordered[0],
        "classes": ordered,
        "confidence": confidence,
        "rationale": rationale,
        "us_like": us_like,
        "now_title": title or None,
        "next_title": (next_title or None),
        "tvg_id": tvg or None,
        "daypart_hint": daypart_hint,
        "call_sign": identity.get("call_sign"),
        "identity_tier": identity.get("tier"),
        "identity": identity,
    }



def lookup_corrections(
    registry: dict[str, Any],
    *,
    gateway_id: str | None = None,
    root_cause: str | None = None,
    tvg_id: str | None = None,
) -> dict[str, Any]:
    """Find proven resolutions for a gateway id and/or failure class."""
    by_gw = cases_by_gateway(registry)
    exact = list(by_gw.get(str(gateway_id or ""), []))
    class_hits: list[dict[str, Any]] = []
    if root_cause:
        class_hits = cases_by_class(registry, root_cause)
    elif exact:
        class_hits = cases_by_class(registry, exact[0].get("root_cause_class") or "")

    if tvg_id:
        tvg_l = tvg_id.lower()
        class_hits = [
            c
            for c in class_hits
            if (c.get("tvg_id") or "").lower() == tvg_l
            or (c.get("resolution") or {}).get("previous_tvg_id", "").lower() == tvg_l
        ] or class_hits

    rules = active_global_rules(
        registry, (exact[0].get("root_cause_class") if exact else root_cause)
    )

    suggestions: list[dict[str, Any]] = []
    for case in exact:
        res = case.get("resolution") or {}
        suggestions.append(
            {
                "source": "exact_gateway_case",
                "case_id": case.get("case_id"),
                "safe_auto_apply": bool(res.get("safe_auto_apply")),
                "tvg_id": res.get("authoritative_tvg_id") or case.get("tvg_id"),
                "epgpw_pin": res.get("epgpw_pin") or case.get("epgpw_pin"),
                "prefer_source": res.get("prefer_source") or case.get("prefer_source"),
                "clear_prog_cache": res.get("clear_prog_cache") or [],
                "apply_global_rules": res.get("apply_global_rules") or [],
                "ground_truth_title": case.get("ground_truth_title"),
                "resolution_version": case.get("resolution_version"),
            }
        )

    # Class-level: prefer global rules + example pins (not auto-remap other channels).
    for rule in rules:
        suggestions.append(
            {
                "source": "global_rule",
                "rule_id": rule.get("id"),
                "safe_auto_apply": bool((rule.get("runtime") or {}).get("auto_applied_globally")),
                "summary": rule.get("summary"),
                "steps": rule.get("steps") or [],
                "runtime": rule.get("runtime") or {},
                "root_cause_class": rule.get("root_cause_class"),
            }
        )

    for case in class_hits:
        if gateway_id and str(case.get("gateway_id")) == str(gateway_id):
            continue  # already in exact
        suggestions.append(
            {
                "source": "same_class_case",
                "case_id": case.get("case_id"),
                "safe_auto_apply": False,  # never auto-remap other gateway ids
                "example_gateway_id": case.get("gateway_id"),
                "example_tvg_id": case.get("tvg_id"),
                "example_epgpw_pin": case.get("epgpw_pin"),
                "prefer_source": case.get("prefer_source"),
                "root_cause_class": case.get("root_cause_class"),
                "lesson": (
                    f"Class {case.get('root_cause_class')}: prefer "
                    f"{case.get('prefer_source') or 'json'} + pin pattern from "
                    f"{case.get('case_id')} (do not copy pin to unrelated channels)."
                ),
            }
        )

    return {
        "gateway_id": gateway_id,
        "exact_cases": exact,
        "class_cases": class_hits,
        "global_rules": rules,
        "suggestions": suggestions,
    }


def repair_actions_from_lookup(lookup: dict[str, Any]) -> list[dict[str, Any]]:
    """Turn registry lookup into auditor repair_actions entries."""
    actions: list[dict[str, Any]] = []
    for s in lookup.get("suggestions") or []:
        src = s.get("source")
        if src == "exact_gateway_case":
            actions.append(
                {
                    "action": (
                        f"Registry case {s.get('case_id')}: keep/apply tvg_id="
                        f"{s.get('tvg_id')} epgpw_pin={s.get('epgpw_pin')} "
                        f"prefer_source={s.get('prefer_source')}; clear cache "
                        f"{s.get('clear_prog_cache')}; GT was {s.get('ground_truth_title')!r}."
                    ),
                    "severity": "medium",
                    "owner": "epg",
                    "auto_suggested": True,
                    "registry_case_id": s.get("case_id"),
                    "safe_auto_apply": s.get("safe_auto_apply"),
                }
            )
        elif src == "global_rule":
            if s.get("safe_auto_apply"):
                actions.append(
                    {
                        "action": (
                            f"Global rule `{s.get('rule_id')}` already in gateway "
                            f"(since {(s.get('runtime') or {}).get('since_version')}): "
                            f"{s.get('summary')}"
                        ),
                        "severity": "info",
                        "owner": "epg",
                        "auto_suggested": True,
                        "registry_rule_id": s.get("rule_id"),
                    }
                )
            else:
                actions.append(
                    {
                        "action": f"Apply global rule `{s.get('rule_id')}`: {s.get('summary')}",
                        "severity": "medium",
                        "owner": "epg",
                        "auto_suggested": True,
                        "registry_rule_id": s.get("rule_id"),
                    }
                )
        elif src == "same_class_case":
            actions.append(
                {
                    "action": s.get("lesson") or f"Consult case {s.get('case_id')}",
                    "severity": "low",
                    "owner": "epg",
                    "auto_suggested": True,
                    "registry_case_id": s.get("case_id"),
                }
            )
    return actions


def register_confirmed_case(
    registry: dict[str, Any],
    *,
    gateway_id: str,
    tvg_id: str,
    epgpw_pin: str,
    ground_truth_title: str,
    root_cause_class: str,
    resolution_version: str,
    display_name: str | None = None,
    prefer_source: str = "json",
    secondary_classes: list[str] | None = None,
    artifacts: list[str] | None = None,
    previous_tvg_id: str | None = None,
    case_id: str | None = None,
    safe_auto_apply: bool = True,
    call_sign: str | None = None,
    identity_tier: str | None = None,
    supersedes: str | list[str] | None = None,
    visual_network_bug: bool | None = None,
) -> dict[str, Any]:
    """Insert or update a visually_confirmed repair in the registry."""
    gid = str(gateway_id).strip()
    cid = case_id or (
        f"{(display_name or tvg_id or gid).lower().replace(' ', '-')}"
        f"-{gid}-{resolution_version}"
    )
    resolved_call = (call_sign or extract_call_sign(tvg_id, display_name) or "").upper() or None
    tier_info = identity_confirmation_tier(
        call_sign=resolved_call,
        visual_call_sign=resolved_call if identity_tier == "station_code_visual" else None,
        visual_network_bug=visual_network_bug,
        catalog_name=display_name,
        tvg_id=tvg_id,
    )
    if identity_tier:
        tier_info["tier"] = identity_tier
    supersede_ids = []
    if isinstance(supersedes, str) and supersedes.strip():
        supersede_ids = [supersedes.strip()]
    elif isinstance(supersedes, list):
        supersede_ids = [str(x).strip() for x in supersedes if str(x).strip()]

    case = {
        "case_id": cid,
        "status": "active",
        "gateway_id": gid,
        "display_name": display_name or tvg_id,
        "tvg_id": tvg_id,
        "call_sign": resolved_call,
        "identity_tier": tier_info.get("tier"),
        "epgpw_pin": str(epgpw_pin),
        "prefer_source": prefer_source,
        "ground_truth_title": ground_truth_title,
        "root_cause_class": root_cause_class,
        "secondary_classes": secondary_classes or [],
        "epg_match_status": "visually_confirmed",
        "resolution_version": resolution_version,
        "confirmed_at": utc_now(),
        "artifacts": artifacts or [],
        "supersedes": supersede_ids,
        "resolution": {
            "authoritative_tvg_id": tvg_id,
            "previous_tvg_id": previous_tvg_id,
            "epgpw_pin": str(epgpw_pin),
            "prefer_source": prefer_source,
            "call_sign": resolved_call,
            "identity_tier": tier_info.get("tier"),
            "clear_prog_cache": [str(epgpw_pin)],
            "apply_global_rules": [
                r.get("id")
                for r in (registry.get("global_rules") or [])
                if (r.get("root_cause_class") or "").lower()
                in (root_cause_class.lower(), "false_healthy", "wrong_label")
                and (r.get("status") or "active") == "active"
            ],
            "safe_auto_apply": safe_auto_apply,
        },
    }
    cases = registry.setdefault("cases", [])
    replaced = False
    for i, existing in enumerate(cases):
        if existing.get("case_id") == cid or (
            str(existing.get("gateway_id")) == gid
            and existing.get("resolution_version") == resolution_version
            and _case_active(existing)
        ):
            cases[i] = case
            replaced = True
            break
    if not replaced:
        cases.append(case)

    # Mark superseded predecessors inactive so lookup ignores them.
    for old_id in supersede_ids:
        for existing in cases:
            if existing.get("case_id") == old_id:
                existing["status"] = "superseded"
                existing["superseded_by"] = cid
                existing["superseded_at"] = utc_now()
    return case


def supersede_case(
    registry: dict[str, Any],
    old_case_id: str,
    *,
    superseded_by: str,
) -> dict[str, Any] | None:
    """Mark a prior confirmed case superseded (e.g. wrong identity later corrected)."""
    for existing in registry.get("cases") or []:
        if existing.get("case_id") == old_case_id:
            existing["status"] = "superseded"
            existing["superseded_by"] = superseded_by
            existing["superseded_at"] = utc_now()
            return existing
    return None



def verify_pin_in_channel_map(
    epgpw_pin: str, gateway_id: str, *, map_path: Path | None = None
) -> dict[str, Any]:
    """Check whether a confirmed pin is present in assets/epgpw_channel_map.json."""
    path = map_path or CHANNEL_MAP
    if not path.exists():
        return {"ok": False, "error": f"missing map {path}"}
    data = json.loads(path.read_text(encoding="utf-8"))
    entry = (data.get("map") or {}).get(str(epgpw_pin))
    if not entry:
        return {"ok": False, "pin_present": False, "epgpw_pin": epgpw_pin}
    ids = [str(x) for x in (entry.get("channel_ids") or [])]
    return {
        "ok": str(gateway_id) in ids,
        "pin_present": True,
        "epgpw_pin": epgpw_pin,
        "channel_ids": ids,
        "tvg_id": entry.get("tvg_id"),
        "prefer_source": entry.get("prefer_source"),
    }


def enrich_audit_record(
    record: dict[str, Any], registry: dict[str, Any] | None = None
) -> dict[str, Any]:
    """Classify + attach registry-driven correction hints onto an audit record."""
    reg = registry if registry is not None else load_registry()
    epg = record.get("epg") or {}
    classification = classify_epg_failure(
        now_title=epg.get("now_title"),
        next_title=epg.get("next_title"),
        has_data=epg.get("epg_has_data"),
        tvg_id=epg.get("tvg_id"),
        region_hint=epg.get("region_hint"),
        daypart_hint=epg.get("daypart_hint"),
        epg_match_status=epg.get("epg_match_status"),
        wrong_feed_suspect=epg.get("wrong_feed_suspect"),
    )
    # Exact gateway cases first (even when currently healthy / title_plausible).
    lookup = lookup_corrections(
        reg,
        gateway_id=str(record.get("channel_id") or ""),
        root_cause=None,
    )
    # Merge class-level suggestions for the classified failure.
    class_lookup = lookup_corrections(
        reg,
        gateway_id=str(record.get("channel_id") or ""),
        root_cause=classification["primary_class"],
        tvg_id=epg.get("tvg_id"),
    )
    seen_keys: set[str] = set()
    merged: list[dict[str, Any]] = []
    for s in (lookup.get("suggestions") or []) + (class_lookup.get("suggestions") or []):
        key = json.dumps(s, sort_keys=True, default=str)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        merged.append(s)
    lookup["suggestions"] = merged
    lookup["class_cases"] = class_lookup.get("class_cases") or []
    lookup["global_rules"] = class_lookup.get("global_rules") or lookup.get("global_rules")
    lookup["classification"] = classification

    corr = {
        "registry_path": str(DEFAULT_REGISTRY.relative_to(ROOT)),
        "algorithm_version": reg.get("algorithm_version"),
        "classification": classification,
        "exact_cases": [
            {"case_id": c.get("case_id"), "epg_match_status": c.get("epg_match_status")}
            for c in lookup.get("exact_cases") or []
        ],
        "suggestions": lookup.get("suggestions") or [],
    }
    record["epg_correction"] = corr

    # Merge repair actions (avoid dupes by action text).
    verdict = record.setdefault("verdict", {})
    actions = list(verdict.get("repair_actions") or [])
    existing = {a.get("action") for a in actions}
    for a in repair_actions_from_lookup(lookup):
        if a.get("action") not in existing:
            actions.append(a)
            existing.add(a.get("action"))
    verdict["repair_actions"] = actions
    return record


def main() -> int:
    ap = argparse.ArgumentParser(description="EPG correction algorithm + confirmed-case registry")
    ap.add_argument("--registry", type=Path, default=DEFAULT_REGISTRY)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_list = sub.add_parser("list", help="List confirmed cases")
    p_list.add_argument("--class", dest="root_cause", default=None)

    p_lookup = sub.add_parser("lookup", help="Lookup corrections for a gateway id")
    p_lookup.add_argument("gateway_id")
    p_lookup.add_argument("--class", dest="root_cause", default=None)

    p_cls = sub.add_parser("classify", help="Classify an EPG failure from symptoms")
    p_cls.add_argument("--now-title", default="")
    p_cls.add_argument("--tvg-id", default="")
    p_cls.add_argument("--region", default="US")
    p_cls.add_argument("--daypart", default="daytime")
    p_cls.add_argument("--has-data", action="store_true", default=True)
    p_cls.add_argument("--no-data", action="store_true")
    p_cls.add_argument("--match-status", default="mismatch_suspected")
    p_cls.add_argument("--catalog-name", default="")
    p_cls.add_argument("--visual-call-sign", default="")
    p_cls.add_argument("--visual-network-bug", action="store_true")

    p_reg = sub.add_parser("register", help="Register a visually_confirmed repair")
    p_reg.add_argument("--gateway-id", required=True)
    p_reg.add_argument("--tvg-id", required=True)
    p_reg.add_argument("--epgpw-pin", required=True)
    p_reg.add_argument("--ground-truth", required=True)
    p_reg.add_argument("--root-cause", required=True)
    p_reg.add_argument("--version", required=True, help="Resolution VERSION tag")
    p_reg.add_argument("--display-name", default=None)
    p_reg.add_argument("--prefer-source", default="json")
    p_reg.add_argument("--previous-tvg-id", default=None)
    p_reg.add_argument("--secondary", default="", help="Comma-separated secondary classes")
    p_reg.add_argument("--artifact", action="append", default=[])
    p_reg.add_argument("--call-sign", default=None, help="OTA station code e.g. WNYW")
    p_reg.add_argument("--identity-tier", default=None)
    p_reg.add_argument("--supersedes", default=None, help="Prior case_id to supersede")
    p_reg.add_argument("--visual-network-bug", action="store_true")

    p_check = sub.add_parser("check-pins", help="Verify confirmed pins exist in channel map")

    args = ap.parse_args()
    registry = load_registry(args.registry)

    if args.cmd == "list":
        cases = registry.get("cases") or []
        if args.root_cause:
            cases = cases_by_class(registry, args.root_cause)
        print(json.dumps({"count": len(cases), "cases": cases}, indent=2))
        return 0

    if args.cmd == "lookup":
        out = lookup_corrections(
            registry, gateway_id=args.gateway_id, root_cause=args.root_cause
        )
        print(json.dumps(out, indent=2))
        return 0

    if args.cmd == "classify":
        out = classify_epg_failure(
            now_title=args.now_title,
            has_data=not args.no_data,
            tvg_id=args.tvg_id,
            region_hint=args.region,
            daypart_hint=args.daypart,
            epg_match_status=args.match_status,
            catalog_name=args.catalog_name or None,
            visual_call_sign=args.visual_call_sign or None,
            visual_network_bug=bool(args.visual_network_bug),
        )
        out["lookup"] = lookup_corrections(
            registry, root_cause=out["primary_class"], tvg_id=args.tvg_id or None
        )
        print(json.dumps(out, indent=2))
        return 0

    if args.cmd == "register":
        secondary = [s.strip() for s in (args.secondary or "").split(",") if s.strip()]
        case = register_confirmed_case(
            registry,
            gateway_id=args.gateway_id,
            tvg_id=args.tvg_id,
            epgpw_pin=args.epgpw_pin,
            ground_truth_title=args.ground_truth,
            root_cause_class=args.root_cause,
            resolution_version=args.version,
            display_name=args.display_name,
            prefer_source=args.prefer_source,
            secondary_classes=secondary,
            artifacts=args.artifact,
            previous_tvg_id=args.previous_tvg_id,
            call_sign=args.call_sign,
            identity_tier=args.identity_tier,
            supersedes=args.supersedes,
            visual_network_bug=bool(args.visual_network_bug),
        )
        path = save_registry(registry, args.registry)
        pin_check = verify_pin_in_channel_map(args.epgpw_pin, args.gateway_id)
        print(json.dumps({"ok": True, "registry": str(path), "case": case, "pin_check": pin_check}, indent=2))
        return 0 if pin_check.get("ok") or not pin_check.get("pin_present") else 0

    if args.cmd == "check-pins":
        results = []
        all_ok = True
        for case in registry.get("cases") or []:
            check = verify_pin_in_channel_map(
                str(case.get("epgpw_pin")), str(case.get("gateway_id"))
            )
            check["case_id"] = case.get("case_id")
            results.append(check)
            if not check.get("ok"):
                all_ok = False
        print(json.dumps({"ok": all_ok, "results": results}, indent=2))
        return 0 if all_ok else 1

    return 2


if __name__ == "__main__":
    raise SystemExit(main())
