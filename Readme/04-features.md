# 04 — Feature Breakdown & Build Status

> Source: `MASTER_REFERENCE.md` §6, §8, §9 · Last verified: 2026-04-01

---

## PolicyGuard Enforcement Architecture

| File | Role |
|------|------|
| `main.py` | FastAPI app — `_evaluate_with_fallback()` per intent |
| `intent_builder.py` | Builds 5–6 `IntentModel` objects per attack |
| `runtime.py` | **PRIMARY** — loads `policy.yaml`, RULE_001→004→DEFAULT |
| `policy_engine.py` | **FALLBACK** — hardcoded rules, used if runtime crashes |
| `executor.py` | Fires ALLOW decisions (HTTP 200/201 check, no raise_for_status) |
| `audit_logger.py` | POSTs every decision to `/api/audit/ingest` |
| `policy.yaml` | Declarative: allowed_actions, blocked_actions, risk_rules, default:BLOCK |

### Policy Rule ID Enum

| Rule | Fires when |
|------|------------|
| `RULE_001` | action in `blocked_actions` |
| `RULE_002` | `risk_level == 'critical'` |
| `RULE_003` | `risk_level == 'high'` |
| `RULE_004` | action in `allowed_actions` |
| `RULE_DEFAULT` | nothing matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | human approved/rejected via Dashboard |

### Action Policy Table

| Action | Policy | Rule |
|--------|--------|------|
| `send_alert` | ALLOW | RULE_004 |
| `log_attack` | ALLOW | RULE_004 |
| `rate_limit_ip` | ALLOW | RULE_004 |
| `flag_for_review` | ALLOW | RULE_004 |
| `generate_report` | ALLOW | RULE_004 |
| `permanent_ban_ip` | BLOCK | RULE_001 |
| `shutdown_endpoint` | BLOCK | RULE_001 |
| `purge_all_sessions` | BLOCK | RULE_001 |
| `modify_firewall_rules` | BLOCK | RULE_001 |

---

## Canonical Field Registry

### `attackType` Enum

```
sqli · xss · traversal · command_injection · ssrf · lfi_rfi
brute_force · hpp · xxe · webshell · recon · ddos · unknown
```

---

## Geo-IP Threat Intelligence

Added 2026-04-01. Enriches every `AttackEvent` with geographic + threat metadata.

### Architecture

| Layer | File | Role |
|-------|------|------|
| Data field | `AttackEvent` model | Stores `geoIntel` sub-document on every attack |
| Backend API | `backend/src/routes/geoIntel.js` | 3 REST endpoints — heatmap, stats, IP lookup |
| Gateway mount | `backend/server.js` | `app.use('/api/geo', require('./src/routes/geoIntel'))` |
| Frontend page | `dashboard/src/pages/GeoThreatMap.jsx` | Leaflet world map + KPI cards + top countries table |
| Route | `dashboard/src/App.jsx` | `/geo` mounted inside `AppLayout` |
| Backfill script | `backend/scripts/backfill-geo.js` | One-time enrichment of pre-existing records |

### `geoIntel` Sub-Document Schema

```js
{
  country:                string,   // e.g. "India"
  country_code:           string,   // ISO 3166-1 alpha-2, e.g. "IN"
  region:                 string,
  city:                   string,
  latitude:               number,
  longitude:              number,
  isp:                    string,
  org:                    string,
  asn:                    string,
  is_proxy:               boolean,
  is_hosting:             boolean,
  is_tor:                 boolean,
  is_whitelisted:         boolean,
  abuse_confidence_score: number,   // 0–100
  total_reports:          number,
  last_reported_at:       Date|null,
}
```

### Data Source
- **ip-api.com** (free, no key required) — geo + ISP + proxy/hosting flags
- Batch API: `POST http://ip-api.com/batch` — up to 100 IPs per call, 45 req/min free tier
- Optional: **AbuseIPDB** (requires `ABUSEIPDB_API_KEY`) — abuse score, TOR flag

### Backfill Script
```bash
# Run once from backend/ to enrich all pre-existing AttackEvents
cd backend
node scripts/backfill-geo.js

# Dry run (no DB writes)
DRY_RUN=true node scripts/backfill-geo.js
```

---

## Build Status (2026-04-01)

### ✅ Complete & Verified

| Feature | Evidence |
|---------|----------|
| Gateway API — 12 route files | All routes respond correctly |
| MongoDB — 6 models | 198+ attacks in production |
| Socket.io — 6 events | Live dashboard confirmed |
| Detection pipeline | sqli/xss/traversal/command_injection classified |
| PCAP Processor | 10/10 tests pass |
| Nexus + Autonomous Response | 7/7 pytest pass, live enforcement confirmed |
| React Dashboard — 15 pages | Live data, all pages functional |
| SimulateAttack page `/simulate` | One-click attack simulator, live socket feed |
| Postman Collection | 40+ requests, 8 folders, automated test scripts |
| PM2 — 5 services | All online, saved, auto-restart enabled |
| AWS EC2 deployment | All services live — deploy.sh confirmed working |
| MongoDB Atlas | IP allowlisted to EC2, Atlas Search live |
| deploy.sh | Full auto-deploy in ~10–12 min on fresh Ubuntu instance |
| **Geo-IP Threat Intelligence** | `/geo` page live — 198 records backfilled, world map rendering |

### 🟡 Partial

| Feature | What's Missing |
|---------|----------------|
| Detection Engine ML | `sentinel_v5.pkl` model not committed (integration in progress) |
| Gemini integration | Real `GEMINI_API_KEY` needed |
| Dashboard Charts | Recharts donut + timeline not wired |
| Geo-IP live enrichment | New attacks not yet auto-enriched at write time (backfill covers history) |

### 🔲 Not Built

| Feature | Priority |
|---------|----------|
| `sentinel_v5.pkl` ML model | P0 |
| Dashboard charts (Recharts) | P1 |
| Auto geo-enrich on AttackEvent write | P1 |
| Nginx + HTTPS | P1 |
| CSV export | P2 |
