#!/usr/bin/env python3
"""Generate PIN config on first setup. Writes hashed pins + one-time cleartext file."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG_DIR = ROOT / "config"
PINS_FILE = CONFIG_DIR / "pins.json"
ISSUED_FILE = CONFIG_DIR / "PINS-ISSUED.txt"


def _hash_pin(pin: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        pin.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()


def _gen_pin(length: int = 6) -> str:
    while True:
        pin = "".join(str(secrets.randbelow(10)) for _ in range(length))
        if len(set(pin)) >= 2:
            return pin


def main() -> int:
    parser = argparse.ArgumentParser(description="Setup StepDaddyLiveHD PIN auth")
    parser.add_argument("--force", action="store_true", help="Overwrite existing pins.json")
    parser.add_argument("--admin-len", type=int, default=6)
    parser.add_argument("--user-len", type=int, default=6)
    parser.add_argument("--user-count", type=int, default=10)
    args = parser.parse_args()

    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if PINS_FILE.exists() and not args.force:
        print(f"Refusing to overwrite existing {PINS_FILE} (use --force)", file=sys.stderr)
        return 1

    salt = secrets.token_hex(16)
    admin_pin = _gen_pin(args.admin_len)
    user_pins = [_gen_pin(args.user_len) for _ in range(args.user_count)]

    data = {
        "enabled": True,
        "salt": salt,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "admin": {
            "id": "admin",
            "hash": _hash_pin(admin_pin, salt),
        },
        "users": [
            {"id": f"user{i+1:02d}", "hash": _hash_pin(p, salt)}
            for i, p in enumerate(user_pins)
        ],
    }

    PINS_FILE.write_text(json.dumps(data, indent=2) + "\n")
    os.chmod(PINS_FILE, 0o600)

    issued_lines = [
        "# StepDaddyLiveHD PINs — ONE-TIME ISSUANCE",
        f"# Generated: {data['created_at']}",
        "# Store securely; delete after copying to password manager.",
        "",
        f"ADMIN PIN (multi-device): {admin_pin}",
        "",
        "USER PINs (one device each):",
    ]
    for i, p in enumerate(user_pins, start=1):
        issued_lines.append(f"  user{i:02d}: {p}")

    ISSUED_FILE.write_text("\n".join(issued_lines) + "\n")
    os.chmod(ISSUED_FILE, 0o600)

    print(f"Wrote {PINS_FILE} (hashed)")
    print(f"Wrote {ISSUED_FILE} (cleartext, chmod 600) — retrieve via SSH only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
