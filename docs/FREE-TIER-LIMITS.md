# StepDaddy Gateway — Oracle Always Free Limits

**Updated:** 2026-09-01  
**Host:** `stepdaddy-ampere` @ `129.80.78.103` (us-ashburn-1)  
**Domain:** https://sdgateway.duckdns.org

---

## Oracle Always Free — what applies to this stack

| Resource | Always Free limit | This deployment |
|----------|-------------------|-----------------|
| **Ampere A1.Flex pool** | **2 OCPU + 12 GB RAM total** (tenancy-wide) | 2 OCPU, 8 GB on `stepdaddy-ampere` |
| **E2 micro** | Up to 2× VM.Standard.E2.1.Micro (1 OCPU equiv, 1 GB each) | Old `openclaw-gateway` **STOPPED** (frees slot) |
| **Block storage** | 200 GB total (boot + block volumes, home region) | ~50 GB boot on Ampere instance |
| **Outbound egress** | **10 TB/month** per tenancy (official Oracle docs) | HLS proxy only (~10 PIN users); monitor via `/health/free-tier` |
| **Object storage** | 20 GB + API limits | Not used |
| **Load balancer** | 1× flexible LB @ 10 Mbps (if created) | Not used (Caddy on instance) |

> **Note on egress:** Third-party sources claim Oracle removed egress charges globally in Feb 2026. **Official Oracle pricing/docs still list 10 TB/month free**, then per-GB rates (~$0.0085/GB in NA/EU/UK). Treat 10 TB as the planning limit; verify in OCI Cost Analysis if usage grows.

> **Note on Ampere pool:** Some guides cite “4 OCPU / 24 GB” — Oracle’s official Always Free doc is **2 OCPU / 12 GB** total for A1.Flex. This instance uses 2/2 OCPU and 8/12 GB RAM.

---

## What triggers charges

| Trigger | Risk for StepDaddy | Mitigation |
|---------|-------------------|------------|
| **Exceeding free egress** (if billed) | Low for ~10 users; high if port 3000 abused as open proxy | PIN auth, rate limits, close port 3000 publicly |
| **Non-free shapes** (x86 larger, GPU, etc.) | None if only A1.Flex + stopped micro | Budget alert; never resize above free pool |
| **Extra block storage** > 200 GB | Low | Keep single boot volume; delete old volumes |
| **Paid services** (Autonomous DB, LB bandwidth > free, etc.) | None today | Budget alert; compartment review |
| **Idle reclamation** | Oracle may reclaim idle free VMs (7d: CPU/net/mem <20% p95) | Light cron/watchdog traffic keeps instance active |
| **Pay-as-you-go trap** | Upgrading account enables paid resources; free tier still free but mistakes cost money | $1 budget alert, tag resources, review Cost Analysis monthly |

---

## Overage reference (if billed)

| Item | Typical rate (verify in console) |
|------|----------------------------------|
| Egress over 10 TB (NA/EU/UK) | ~$0.0085/GB |
| Block volume over 200 GB | ~$0.0255/GB/month |
| Extra OCPU/RAM (A1 paid) | Per OCI compute pricing for region |

**Example:** 15 TB egress month → ~5 TB over × $0.0085 ≈ **$43** (only if 10 TB cap still applies).

---

## Safeguards implemented on this VPS

| Safeguard | Status |
|-----------|--------|
| PIN auth (`PIN_AUTH_ENABLED=1`) | ✅ ~10 users, hashed `config/pins.json` |
| Uvicorn `--limit-concurrency 40` | ✅ |
| systemd `MemoryMax=1800M` / `MemoryHigh=1500M` | ✅ |
| Stream/content rate limit (30 req/s per IP) | ✅ app middleware |
| Health watchdog + snapshots | ✅ 20s / 5m timers |
| `/health/free-tier` endpoint | ✅ RAM, connections, egress counters |
| Caddy HTTPS reverse proxy | ✅ port 443 |
| OCI budget alert | ✅ $1/month tenancy budget (local CLI) |
| Port 3000 globally open | ✅ **Closed** 2026-09-01 — HTTPS-only via Caddy :443 |
| UptimeRobot external monitor | ⚠️ Manual setup — `scripts/uptimerobot-setup.sh` |
| OCI revert snapshot (port 3000) | ✅ `config/oci-security-list-revert-3000-open.json` |
| vnstat monthly tracking | Optional — install for calendar-month egress |
| Caddy native rate_limit | ❌ not in stock Caddy 2.9 — use app middleware |

---

## Endpoints

```bash
curl -s https://sdgateway.duckdns.org/health/free-tier | python3 -m json.tool
curl -s https://sdgateway.duckdns.org/health/stability | python3 -m json.tool
```

---

## Port 3000 closure (2026-09-01)

Public TCP 3000 removed at both layers:

| Layer | Before | After |
|-------|--------|-------|
| OCI security list | 0.0.0.0/0:3000 | **removed** (22, 80, 443 only) |
| firewalld | 3000/tcp public | **removed** (ssh, http, https) |

App still binds `0.0.0.0:3000`; Caddy proxies `https://sdgateway.duckdns.org` → `127.0.0.1:3000`.

**Emergency reopen (home IP only):** `scripts/oci-reopen-port-3000-home.sh`  
**Full revert JSON:** `config/oci-security-list-revert-3000-open.json`

Incident logged: `logs/incidents.log` → `port 3000 closed for free-tier protection`.

---

## Recommended next steps

1. **UptimeRobot** — `scripts/uptimerobot-setup.sh` (URL: `https://sdgateway.duckdns.org/health?lite=1`, 5 min).
2. **Install vnstat** for monthly TX totals: `sudo dnf install -y vnstat && sudo systemctl enable --now vnstat`
3. **Monthly:** OCI Console → Billing → Cost Analysis → filter egress line items.
4. **Keep E2 micro stopped** unless needed; don’t run two Ampere instances without splitting the 2 OCPU pool.

---

## OCI budget (billing alarm)

Created from Pop!_OS with `oci` CLI:

```bash
# List budgets
oci budgets budget budget list --compartment-id <tenancy-ocid> --all

# Alert email: mrmaineventshow@gmail.com
```

Any spend ≥ $1/month triggers email — catches accidental paid resources early.

---

## Realistic risk (~10 PIN users)

- **Compute:** Well within 2 OCPU / 8 GB; HLS proxy is light (no transcoding).
- **Egress:** ~3–8 Mbps per HD stream × few concurrent users ≈ tens of GB/month, not TB — **very low bill risk** unless abused via open port 3000.
- **Storage:** Single instance, well under 200 GB.
- **Biggest threat (mitigated):** Public `:3000` bypassing Caddy + PIN — **closed 2026-09-01**.
