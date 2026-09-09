# Channel audit tooling

Gapless **single-channel** audit for StepDaddyLiveHD repair / rebuild / maintenance.

| File | Role |
|------|------|
| [PROTOCOL.md](./PROTOCOL.md) | Ordered phases + checklist + confirmed-case feedback loop |
| [schema/channel-audit.schema.json](./schema/channel-audit.schema.json) | JSON Schema for one audit record |
| [template/channel-audit.template.json](./template/channel-audit.template.json) | Empty record |
| [examples/](./examples/) | Filled audits (auto + human stubs) |
| `../../scripts/channel-audit.py` | Runnable auditor (consults registry) |
| `../../scripts/epg_correction.py` | Correction algorithm + registry CLI |
| `../../data/epg_confirmed_corrections.json` | High-confidence visually confirmed repairs |

## Quick start

```bash
cd /home/nova/StepDaddyLiveHD
python3 scripts/channel-audit.py 343 --probe-media --grab-frame --md
python3 scripts/channel-audit.py 51 --probe-media --md

# After visual confirm — write back into the learning registry:
python3 scripts/channel-audit.py 51 --visual-match match \
  --ground-truth-title "The View" --register-confirmed --register-pin 464902 --md

python3 scripts/epg_correction.py list
python3 scripts/epg_correction.py lookup 696
```

Default gateway: `https://sdgateway.duckdns.org` (override with `--gateway` or `SD_GATEWAY`).

## Auto vs human

See PROTOCOL.md. Script fills catalog/stream/EPG probe fields and attaches registry correction hints; leave paint-death, TiviMate UI number, favorites, and UX checkboxes for operators. Visual EPG match can be set via `--visual-match`; confirmed repairs must be registered (Phase 4b).
