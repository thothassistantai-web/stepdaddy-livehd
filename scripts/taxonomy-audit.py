#!/usr/bin/env python3
"""Audit channel taxonomy facets against a live (or local) gateway catalog.

Dumps histograms for genre / distributor / country / language and lists raw
group_title / tag strings that did not resolve into facets — feed those into
data/taxonomy/*_aliases.json (same loop as EPG confirmed corrections).

Examples:
  python3 scripts/taxonomy-audit.py
  python3 scripts/taxonomy-audit.py --gateway https://sdgateway.duckdns.org
  python3 scripts/taxonomy-audit.py --local-normalize   # re-run normalizer on raw fields
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_GATEWAY = os.environ.get("SD_GATEWAY", "https://sdgateway.duckdns.org").rstrip("/")
UA = "StepDaddy-taxonomy-audit/1.0.0"


def _get_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8", errors="replace"))


def _ensure_path() -> None:
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--gateway", default=DEFAULT_GATEWAY)
    ap.add_argument(
        "--local-normalize",
        action="store_true",
        help="Ignore API facet fields and recompute via taxonomy.normalize_channel_taxonomy",
    )
    ap.add_argument(
        "--out",
        default="",
        help="Optional JSON report path (default: stdout summary only)",
    )
    ap.add_argument("--top", type=int, default=40)
    args = ap.parse_args()

    channels = _get_json(f"{args.gateway.rstrip('/')}/channels")
    if not isinstance(channels, list):
        print("unexpected /channels payload", file=sys.stderr)
        return 2

    _ensure_path()
    from StepDaddyLiveHD.supplements.taxonomy import (  # noqa: WPS433
        label_for,
        normalize_channel_taxonomy,
    )

    genre_c: Counter[str] = Counter()
    dist_c: Counter[str] = Counter()
    country_c: Counter[str] = Counter()
    lang_c: Counter[str] = Counter()
    source_c: Counter[str] = Counter()
    unresolved_groups: Counter[str] = Counter()
    unresolved_tags: Counter[str] = Counter()
    mega_buckets = 0
    missing_distributor = 0
    missing_country = 0
    samples: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for ch in channels:
        if not isinstance(ch, dict):
            continue
        source_c[str(ch.get("source") or "?")] += 1
        if args.local_normalize:
            tax = normalize_channel_taxonomy(
                name=ch.get("name"),
                tags=ch.get("tags"),
                group_title=ch.get("group_title"),
                source=ch.get("source"),
                provider=ch.get("provider"),
                tvg_id=ch.get("tvg_id"),
            )
            genre, genres = tax.genre, list(tax.genres)
            distributor, country, language = tax.distributor, tax.country, tax.language
        else:
            genre = ch.get("genre")
            genres = list(ch.get("genres") or [])
            distributor = ch.get("distributor")
            country = ch.get("country")
            language = ch.get("language")
            # If API not yet deployed, fall back to local normalize
            if genre is None and distributor is None:
                tax = normalize_channel_taxonomy(
                    name=ch.get("name"),
                    tags=ch.get("tags"),
                    group_title=ch.get("group_title"),
                    source=ch.get("source"),
                    provider=ch.get("provider"),
                    tvg_id=ch.get("tvg_id"),
                )
                genre, genres = tax.genre, list(tax.genres)
                distributor, country, language = tax.distributor, tax.country, tax.language

        if genre:
            genre_c[str(genre)] += 1
        if distributor:
            dist_c[str(distributor)] += 1
        else:
            missing_distributor += 1
        if country:
            country_c[str(country)] += 1
        else:
            missing_country += 1
        if language:
            lang_c[str(language)] += 1

        gt = str(ch.get("group_title") or "").strip()
        low = gt.lower()
        if "dulo live" in low or "📡" in gt or low.startswith("iptv-org |"):
            # Mega / platform buckets should not be the only browse key anymore.
            mega_buckets += 1
            if not distributor and gt:
                unresolved_groups[gt] += 1

        # Tags that look like facets but didn't contribute
        for raw in ch.get("tags") or []:
            t = str(raw).strip()
            if not t:
                continue
            low_t = t.lower()
            if low_t in ("#live", "#iptv-org", "#freetv", "#dulo", "#ntv", "#adultswim"):
                continue
            if t.startswith("#") or len(t) <= 4 or t in ("🇺🇸", "🇬🇧", "🇨🇦"):
                # If neither genre nor country absorbed this, count unresolved
                tax2 = normalize_channel_taxonomy(tags=[t])
                if not tax2.genre and not tax2.country and not tax2.distributor and tax2.genre is None:
                    if not (tax2.country or tax2.distributor or (tax2.genres and tax2.genres != ["general"])):
                        unresolved_tags[t] += 1

        key = f"{ch.get('source')}:{distributor}:{genre}:{country}"
        if len(samples[key]) < 3:
            samples[key].append(
                {
                    "id": ch.get("id"),
                    "name": ch.get("name"),
                    "group_title": gt or None,
                    "tags": ch.get("tags"),
                    "genre": genre,
                    "genres": genres,
                    "distributor": distributor,
                    "country": country,
                    "language": language,
                }
            )

    def top(counter: Counter[str], n: int) -> list[dict[str, Any]]:
        out = []
        for k, v in counter.most_common(n):
            out.append({"id": k, "count": v, "label": label_for(
                "genre" if k in genre_c and counter is genre_c else
                "distributor" if counter is dist_c else
                "country" if counter is country_c else
                "language" if counter is lang_c else "genre",
                k,
            ) if counter in (genre_c, dist_c, country_c, lang_c) else k})
        return out

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "gateway": args.gateway,
        "channel_count": len(channels),
        "local_normalize": bool(args.local_normalize),
        "sources": dict(source_c),
        "missing_distributor": missing_distributor,
        "missing_country": missing_country,
        "legacy_mega_or_platform_group_titles": mega_buckets,
        "genres": top(genre_c, args.top),
        "distributors": top(dist_c, args.top),
        "countries": top(country_c, args.top),
        "languages": top(lang_c, args.top),
        "unresolved_group_titles": unresolved_groups.most_common(args.top),
        "unresolved_tags": unresolved_tags.most_common(args.top),
        "samples": {k: v for i, (k, v) in enumerate(samples.items()) if i < 40},
    }

    # Human summary
    print(f"channels={report['channel_count']} gateway={args.gateway}")
    print("sources:", dict(source_c))
    print("genres:")
    for row in report["genres"][:15]:
        print(f"  {row['count']:5d}  {row['id']:16s}  {row['label']}")
    print("distributors:")
    for row in report["distributors"][:15]:
        print(f"  {row['count']:5d}  {row['id']:16s}  {row['label']}")
    print("countries:")
    for row in report["countries"][:15]:
        print(f"  {row['count']:5d}  {row['id']:8s}  {row['label']}")
    print("languages:")
    for row in report["languages"][:10]:
        print(f"  {row['count']:5d}  {row['id']:8s}  {row['label']}")
    print(f"missing_distributor={missing_distributor} missing_country={missing_country}")
    uk = country_c.get("UK", 0)
    us = country_c.get("US", 0)
    print(f"country collapse check: US={us} UK={uk} (expect no separate usa/uk raw ids)")
    pluto = dist_c.get("pluto", 0)
    print(f"pluto distributor={pluto}")

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
        print(f"wrote {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
