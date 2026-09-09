# Example channel audits

| File | Channel | Notes |
|------|---------|-------|
| `example-343-usa-network.json` | 343 USA Network | Auto probe + human fields from decode field test |
| `example-51-abc-usa.json` | 51 ABC USA | Auto probe + human notes; EPG empty |
| `audit-*-*.json` | raw script output | Timestamped auto runs |

Regenerate auto runs:

```bash
python3 scripts/channel-audit.py 343 --probe-media --grab-frame --md
python3 scripts/channel-audit.py 51 --probe-media --grab-frame --md
```
