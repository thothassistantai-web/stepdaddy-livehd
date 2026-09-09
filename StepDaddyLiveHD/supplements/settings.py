"""Household gateway settings — persists Use DaddyLive toggle (default ON)."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any


def _default_settings_path() -> Path:
    env = os.environ.get("HOUSEHOLD_SETTINGS_PATH", "").strip()
    if env:
        return Path(env)
    root = Path(__file__).resolve().parents[2]
    return root / "data" / "household_settings.json"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


class HouseholdSettings:
    """Server-side household prefs. use_daddylive defaults ON (thrash guards keep CDN safe)."""

    def __init__(self, path: Path | None = None) -> None:
        self.path = path or _default_settings_path()
        self._lock = threading.Lock()
        self._data: dict[str, Any] = {}
        self.reload()

    def reload(self) -> None:
        defaults = {
            "use_daddylive": _env_bool("USE_DADDYLIVE", True),
            "supplement_freetv": _env_bool("SUPPLEMENT_FREETV", True),
            "supplement_iptv_org": _env_bool("SUPPLEMENT_IPTV_ORG", True),
            "supplement_adult_swim": _env_bool("SUPPLEMENT_ADULT_SWIM", True),
            "supplement_dulo": _env_bool("SUPPLEMENT_DULO", True),
            "supplement_ntv": _env_bool("SUPPLEMENT_NTV", True),
        }
        loaded: dict[str, Any] = {}
        if self.path.is_file():
            try:
                loaded = json.loads(self.path.read_text(encoding="utf-8"))
            except Exception:
                loaded = {}
        with self._lock:
            self._data = {**defaults, **{k: v for k, v in loaded.items() if k in defaults}}
            # Explicit env wins over persisted household file.
            env_raw = os.environ.get("USE_DADDYLIVE", "").strip().lower()
            if env_raw in ("0", "false", "no", "off"):
                self._data["use_daddylive"] = False
            elif env_raw in ("1", "true", "yes", "on"):
                self._data["use_daddylive"] = True

    def _persist(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.part")
        tmp.write_text(json.dumps(self._data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        tmp.replace(self.path)

    def as_dict(self) -> dict[str, Any]:
        with self._lock:
            return dict(self._data)

    def get(self, key: str, default: Any = None) -> Any:
        with self._lock:
            return self._data.get(key, default)

    @property
    def use_daddylive(self) -> bool:
        return bool(self.get("use_daddylive", True))

    def update(self, patch: dict[str, Any]) -> dict[str, Any]:
        allowed = {
            "use_daddylive",
            "supplement_freetv",
            "supplement_iptv_org",
            "supplement_adult_swim",
            "supplement_dulo",
            "supplement_ntv",
        }
        with self._lock:
            for key, val in patch.items():
                if key not in allowed:
                    continue
                if isinstance(val, str):
                    val = val.strip().lower() in ("1", "true", "yes", "on")
                self._data[key] = bool(val)
            self._persist()
            return dict(self._data)


_settings: HouseholdSettings | None = None


def get_settings() -> HouseholdSettings:
    global _settings
    if _settings is None:
        _settings = HouseholdSettings()
    return _settings
