#!/usr/bin/env bash
# Emergency: re-open TCP 3000 on OCI security list for home IP only (173.52.220.92/32).
# Full public reopen: use config/oci-security-list-revert-3000-open.json with oci network security-list update.
set -euo pipefail

HOME_CIDR="${HOME_CIDR:-173.52.220.92/32}"
SL_ID="${OCI_SECURITY_LIST_ID:-ocid1.securitylist.oc1.iad.aaaaaaaa6huhrgnfzgynqpgc3tcx6benewmbh6uwkbsdfkt3d2a5jniida4a}"
REVERT_JSON="${REVERT_JSON:-$(cd "$(dirname "$0")/.." && pwd)/config/oci-security-list-revert-3000-open.json}"

if [ ! -f "$REVERT_JSON" ]; then
  echo "Missing revert snapshot: $REVERT_JSON" >&2
  exit 1
fi

python3 - <<PY > /tmp/oci-ingress-home-3000.json
import json
with open("$REVERT_JSON") as f:
    rules = json.load(f)["data"]["ingress-security-rules"]
# drop any existing 3000 rules, add home-only rule
rules = [r for r in rules if not (
    r.get("protocol") == "6"
    and (r.get("tcp-options") or {}).get("destination-port-range", {}).get("min") == 3000
)]
rules.append({
    "protocol": "6",
    "source": "$HOME_CIDR",
    "isStateless": False,
    "tcpOptions": {
        "destinationPortRange": {"min": 3000, "max": 3000}
    }
})
print(json.dumps(rules))
PY

echo "Applying home-only TCP 3000 ($HOME_CIDR) to security list $SL_ID"
oci network security-list update \
  --security-list-id "$SL_ID" \
  --ingress-security-rules file:///tmp/oci-ingress-home-3000.json \
  --force \
  --query 'data."display-name"' --raw-output

echo "On VPS, also run: sudo firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=$HOME_CIDR port port=3000 protocol=tcp accept' && sudo firewall-cmd --reload"
