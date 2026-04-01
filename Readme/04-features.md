# 04 — Feature Breakdown & Build Status

> Source: `MASTER_REFERENCE.md` §6, §8, §9 · Last verified: 2026-03-28

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

## Build Status (2026-03-28)

### ✅ Complete & Verified

| Feature | Evidence |
|---------|----------|
| Gateway API — 11 route files | All routes respond correctly |
| MongoDB — 6 models | 125+ logs, 78+ attacks in production |
| Socket.io — 6 events | Live dashboard confirmed |
| Detection pipeline | sqli/xss/traversal/command_injection classified |
| PCAP Processor | 10/10 tests pass |
| Nexus + Autonomous Response | 7/7 pytest pass, live enforcement confirmed |
| React Dashboard — 14 pages | Live data, all pages functional |
| SimulateAttack page `/simulate` | One-click attack simulator, live socket feed |
| Postman Collection | 40+ requests, 8 folders, automated test scripts |
| PM2 — 5 services | All online, saved, auto-restart enabled |
| AWS EC2 deployment | All services live — deploy.sh confirmed working |
| MongoDB Atlas | IP allowlisted to EC2, Atlas Search live |
| deploy.sh | Full auto-deploy in ~10–12 min on fresh Ubuntu instance |

### 🟡 Partial

| Feature | What's Missing |
|---------|----------------|
| Detection Engine ML | `sentinel_v5.pkl` model not committed (integration in progress) |
| Gemini integration | Real `GEMINI_API_KEY` needed |
| Dashboard Charts | Recharts donut + timeline not wired |

### 🔲 Not Built

| Feature | Priority |
|---------|----------|
| `sentinel_v5.pkl` ML model | P0 |
| Dashboard charts (Recharts) | P1 |
| Threat Intelligence feed | P1 |
| Nginx + HTTPS | P1 |
| CSV export | P2 |
