# SENTINAL — Master Reference Document

> **Version:** 6.0 · **Date:** 2026-03-27 · **Status:** Living document — single source of truth
>
> Only one doc file exists in this repo. This is it.
> Do NOT create REPOSITORY_AUDIT.md, CURRENT_POLICY_FLOW.md, SYSTEM_BUG_REPORT.md,
> or OPENCLAW_INTEGRATION_PLAN.md — they were deleted. Everything is here.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Exact Repo Structure](#2-exact-repo-structure)
3. [Service Registry](#3-service-registry)
4. [Complete Request Lifecycle](#4-complete-request-lifecycle)
5. [API Contracts — Every Live Route](#5-api-contracts)
6. [OpenClaw Enforcement Architecture](#6-openclaw-enforcement)
7. [MongoDB Schema — All 6 Collections](#7-mongodb-schema)
8. [Canonical Field Registry](#8-canonical-field-registry)
9. [Build Status](#9-build-status)
10. [Port & URL Map + Start Commands](#10-port-map)
11. [Socket.io Events Reference](#11-socketio-events)
12. [Response Envelope Standard](#12-response-envelope)
13. [Demo Day Guide](#13-demo-day)
14. [Production Deployment — AWS EC2](#14-production-deployment)
15. [Changelog](#15-changelog)
16. [MongoDB Atlas Track](#16-mongodb-atlas-track)

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│            DEVELOPER APP  (demo-target :4000 or any Express app)     │
│   uses sentinel-middleware → POST /api/logs/ingest (async)           │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│             SERVICE 1 — GATEWAY API  (Node/Express :3000)            │
│                                                                      │
│  POST /api/logs/ingest  →  SystemLog saved to MongoDB                │
│                         →  detectionConnector → POST :8002/analyze   │
│                                                                      │
│  IF threat_detected:                                                 │
│    AttackEvent.create()     → MongoDB                                │
│    Alert.create()           → MongoDB  (high/critical only)          │
│    emit(attack:new)         → Socket.io                              │
│    emit(alert:new)          → Socket.io                              │
│    callArmorIQ() [async]    → POST :8004/respond                     │
│                                                                      │
│  POST /api/pcap/upload   →  POST :8003/process → merge results       │
│  POST /api/armoriq/trigger → direct ArmorIQ call (demo/test)        │
│  POST /api/actions/:id/approve|reject → human enforcement           │
│  POST /api/audit/ingest  ← called by ArmorIQ audit_logger           │
└──────┬────────────────────────┬──────────────────────┬──────────────┘
       │                        │                      │
       ▼                        ▼                      ▼
┌────────────────┐  ┌───────────────────────┐  ┌──────────────────────────┐
│  SERVICE 2     │  │  SERVICE 3            │  │  SERVICE 4               │
│  PCAP          │  │  DETECTION ENGINE     │  │  ARMORIQ AGENT           │
│  PROCESSOR     │  │  (Python :8002)       │  │  (Python :8004)          │
│  (Python :8003)│  │                       │  │                          │
│                │  │  POST /analyze        │  │  POST /respond           │
│  POST /process │  │  45-rule engine       │  │                          │
│  8 detectors   │  │  adversarial decoder  │  │  intent_builder.py       │
│  full pipeline │  │  HTTP-status layer    │  │  openclaw_runtime.py     │
│  10/10 tests ✅│  │  ML optional          │  │  policy_engine.py (fbck) │
└────────────────┘  └───────────────────────┘  │  executor.py             │
                                               │  audit_logger.py         │
                                               │  models.py               │
                                               │  policy.yaml             │
                                               └──────────────────────────┘
                                                          │
                               ┌──────────────────────────┴─────────────┐
                               │  ALLOWED → auto-executed                │
                               │  send_alert / log_attack                │
                               │  rate_limit_ip / flag_for_review        │
                               │  generate_report                        │
                               │                                         │
                               │  BLOCKED → action_queue (human review)  │
                               │  permanent_ban_ip                       │
                               │  shutdown_endpoint                      │
                               │  purge_all_sessions                     │
                               │  modify_firewall_rules                  │
                               └──────────────────┬──────────────────────┘
                                                  │
                                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SERVICE 5 — REACT DASHBOARD  (Vite :5173)               │
│                                                                      │
│  /dashboard    → Stats, live attack feed, service health             │
│  /attacks      → AttackEvent table + forensics drawer                │
│  /alerts       → attack_detected (red) + armoriq_action (purple)     │
│  /action-queue → Approve / Reject blocked actions                    │
│  /audit        → Full OpenClaw decision log, live via socket         │
│  /pcap         → Upload .pcap → full pipeline                        │
│  /logs         → Raw SystemLogs                                      │
│  /services     → Health ping all 4 services                          │
└──────────────────────────────────────────────────────────────────────┘
```

### OpenClaw Decision Flow

```
POST :8004/respond
         │
  intent_builder.py
  builds 5–6 ProposedAction intents per attack
         │
  openclaw_runtime.py  ← PRIMARY (reads policy.yaml)
    evaluation order (first match wins):
      RULE_001: action in blocked_actions list  → BLOCK
      RULE_002: risk_level == 'critical'        → BLOCK
      RULE_003: risk_level == 'high'            → BLOCK
      RULE_004: action in allowed_actions list  → ALLOW
      RULE_DEFAULT: no match                   → BLOCK (fail-safe)
    on crash → policy_engine.py fallback (same logic, hardcoded)
         │
  ┌──────┴──────────────────────┐
  │ ALLOW                       │ BLOCK
  │ executor.py fires:          │ ActionQueue.create() in MongoDB
  │   POST /api/alerts/armoriq  │ emit(action:pending) → Dashboard
  │   audit entry created       │ audit entry created
  │   emit(audit:new)           │ emit(audit:new)
  └─────────────────────────────┘
         │
  audit_logger.py
  POST /api/audit/ingest → AuditLog saved → emit(audit:new)
```

---

## 2. Exact Repo Structure

```
SENTINAL/
├── .env                             ← NOT committed (gitignored). See §14 for values.
├── .env.example                     template for all env vars
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md              ← this file (only doc)
├── ecosystem.config.js              PM2 process manager config (all 4 services)
├── start.sh                         convenience start script
├── stop.sh                          convenience stop script
├── status.sh                        health-check all 4 services + PM2 list
│
├── backend/                         SERVICE 1: Gateway API (Node :3000)
│   ├── server.js                    entry point
│   ├── package.json
│   ├── .env.example
│   ├── doc/
│   ├── scripts/
│   │   ├── seed.js                  seed demo data (80 logs, 50 attacks, alerts)
│   │   └── atlasVerify.js           Atlas CRUD verification — run once to confirm DB health
│   └── src/
│       ├── config/
│       │   └── database.js          MongoDB Atlas connection
│       ├── controllers/
│       │   ├── actionQueueController.js
│       │   ├── alertController.js
│       │   ├── atlasSearchController.js
│       │   ├── attackController.js
│       │   ├── auditController.js
│       │   ├── forensicsController.js
│       │   ├── healthController.js
│       │   ├── logController.js
│       │   ├── serviceStatusController.js
│       │   └── statsController.js
│       ├── middleware/
│       ├── models/
│       │   ├── ActionQueue.js
│       │   ├── Alert.js
│       │   ├── AttackEvent.js
│       │   ├── AuditLog.js
│       │   ├── ServiceStatus.js
│       │   └── SystemLog.js
│       ├── routes/
│       │   ├── actions.js
│       │   ├── alerts.js
│       │   ├── armoriq.js
│       │   ├── attacks.js
│       │   ├── audit.js
│       │   ├── forensics.js
│       │   ├── health.js
│       │   ├── logs.js
│       │   ├── pcap.js
│       │   ├── serviceStatus.js
│       │   └── stats.js
│       ├── services/
│       │   ├── attackService.js
│       │   ├── detectionConnector.js
│       │   ├── logService.js
│       │   ├── serviceHealthService.js
│       │   └── statsService.js
│       ├── sockets/
│       │   └── broadcastService.js
│       ├── tests/
│       │   ├── apis.test.js
│       │   ├── detection.test.js
│       │   ├── health.test.js
│       │   ├── logging.test.js
│       │   ├── models.test.js
│       │   ├── observability.test.js
│       │   ├── security.test.js
│       │   └── socket.test.js
│       └── utils/
│           ├── eventEmitter.js
│           └── logger.js
│
├── dashboard/                       SERVICE 5: React SPA (Vite :5173)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.production              VITE_API_URL + VITE_SOCKET_URL (EC2 IP)
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── ActionQueue.jsx
│       │   ├── AlertsPanel.jsx
│       │   ├── AppLayout.jsx
│       │   ├── ForensicsDrawer.jsx
│       │   ├── LiveAttackFeed.jsx
│       │   ├── Navbar.jsx
│       │   ├── StatsPanel.jsx
│       │   └── SystemStatus.jsx
│       ├── hooks/
│       │   ├── useApi.js
│       │   ├── useInterval.js
│       │   └── useSocket.js
│       ├── pages/
│       │   ├── ActionQueuePage.jsx
│       │   ├── Alerts.jsx
│       │   ├── Attacks.jsx
│       │   ├── AuditLog.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Docs.jsx
│       │   ├── ForensicsPage.jsx
│       │   ├── Landing.jsx
│       │   ├── Logs.jsx
│       │   ├── NotFound.jsx
│       │   ├── PcapAnalyzer.jsx
│       │   ├── Services.jsx
│       │   └── Settings.jsx
│       └── services/
│           ├── api.js               baseURL from VITE_API_URL env var (not hardcoded)
│           └── socket.js            GATEWAY_URL from VITE_SOCKET_URL env var (not hardcoded)
│
├── config/
│
├── demo-target/                     E2E harness (Express :4000)
│   ├── server.js
│   ├── attack.sh
│   └── package.json
│
├── scripts/
│   ├── validate-env.sh              pre-deploy env validator (4 sections, 16 checks)
│   ├── simulate_attack.py
│   └── simulate_attack.sh
│
└── services/
    ├── armoriq-agent/               SERVICE 4: Python/FastAPI :8004
    │   ├── main.py
    │   ├── intent_builder.py
    │   ├── openclaw_runtime.py
    │   ├── policy_engine.py
    │   ├── executor.py
    │   ├── audit_logger.py
    │   ├── models.py
    │   ├── policy.yaml
    │   ├── requirements.txt
    │   ├── .env.example
    │   ├── README.md
    │   └── tests/
    │       └── test_enforcement.py
    │
    ├── detection-engine/            SERVICE 3: Python/FastAPI :8002
    │   └── app/
    │       ├── main.py
    │       ├── rules.py
    │       ├── adversarial.py
    │       └── [classifier.py]      ML optional
    │
    ├── middleware/                  npm package: sentinel-middleware
    │   ├── package.json
    │   ├── README.md
    │   ├── src/
    │   │   ├── index.js
    │   │   ├── config.js
    │   │   ├── sender.js
    │   │   └── adapters/
    │   │       ├── express.js
    │   │       └── fastify.js
    │   └── tests/
    │       └── sentinel.test.js
    │
    └── pcap-processor/              SERVICE 2: Python/FastAPI :8003
        ├── main.py
        ├── pcap_loader.py
        ├── packet_parser.py
        ├── flow_builder.py
        ├── attack_detector.py
        ├── config.py
        ├── logger.py
        ├── requirements.txt
        ├── datasets/
        └── tests/
            ├── test_pcap_processor.py
            └── fixtures/
```

---

## 3. Service Registry

| Service | Language | Port | Status | Entry Point |
|---------|----------|------|--------|-------------|
| Gateway API | Node.js + Express | 3000 | ✅ LIVE (prod) | `backend/server.js` |
| PCAP Processor | Python + FastAPI | 8003 | ✅ LIVE (prod) | `services/pcap-processor/main.py` |
| Detection Engine | Python + FastAPI | 8002 | ✅ LIVE (prod) | `services/detection-engine/app/main.py` |
| ArmorIQ Agent | Python + FastAPI | 8004 | ✅ LIVE (prod) | `services/armoriq-agent/main.py` |
| React Dashboard | Vite + React | 5173 | ✅ LIVE (prod) | `dashboard/src/main.jsx` |
| sentinel-middleware | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| Demo Target | Node.js + Express | 4000 | ✅ WORKING | `demo-target/server.js` |
| MongoDB Atlas | Cloud (SRV) | — | ✅ LIVE (prod) | `backend/src/config/database.js` |

---

## 4. Complete Request Lifecycle

### Flow A — Live Request via Middleware

```
1.  User hits developer's app → Express handles normally
2.  res.on('finish') → sentinel-middleware captures payload async
3.  POST /api/logs/ingest → SystemLog saved to MongoDB
4.  setImmediate() → non-blocking: detectionConnector.analyze()
5.  POST :8002/analyze → Detection Engine evaluates
6.  Returns { threat_detected, threat_type, severity, confidence, ... }
7a. threat_detected = false → stop.
7b. threat_detected = true:
      AttackEvent.create()  → MongoDB
      emit(attack:new)      → Dashboard LiveAttackFeed
      IF severity high/critical:
        Alert.create(type: attack_detected)
        emit(alert:new)     → Navbar badge
      callArmorIQ() [async] → POST :8004/respond
8.  ArmorIQ evaluates each ProposedAction via openclaw_runtime:
      ALLOW → executor.py executes (send_alert, log_attack, rate_limit_ip, etc.)
      BLOCK → ActionQueue.create() in MongoDB
    Each decision → audit_logger.py → POST /api/audit/ingest
                 → AuditLog.create() → emit(audit:new) → Dashboard live
9.  Blocked actions saved as 'pending' in action_queue
    emit(action:pending) → Dashboard queue badge increments
10. Human visits /action-queue:
    APPROVE → POST /api/actions/:id/approve
              AuditLog(APPROVED, HUMAN_OVERRIDE)
    REJECT  → POST /api/actions/:id/reject
              AuditLog(REJECTED, HUMAN_OVERRIDE)
```

### Flow B — PCAP Upload

```
1.  POST /api/pcap/upload (multipart, field "pcap", field "projectId")
2.  Saved to /tmp/sentinal-uploads/<uuid>
3.  Gateway → POST :8003/process
4.  PCAP Processor: pcap_loader→packet_parser→flow_builder→attack_detector
5.  Returns local_attacks[] + engine_attacks[] (v2 schema)
6.  Gateway merges → AttackEvent.create() per attack → emit(attack:new)
7.  Response: { total_packets, parsed_packets, total_flows,
                processing_time_s, local_attacks_found,
                engine_attacks_found, attacks_saved, skipped_engine }
```

### Flow C — Direct ArmorIQ Trigger (Demo)

```
1.  POST /api/armoriq/trigger { ip, attackType, severity, confidence, status }
2.  Gateway creates SystemLog (projectId: 'armoriq-demo')
3.  attackService.reportAttack() → full pipeline same as Flow A steps 7b–10
4.  Response: { attackId, logId, ip, attackType, severity, confidence, note }
```

---

## 5. API Contracts — Every Live Route

### Gateway (`:3000`) — all responses use envelope (§12)

#### Logs
```
POST /api/logs/ingest
Body: { projectId, method, url, ip, queryParams?, body?, headers?,
        responseCode?, processingTimeMs? }

⚠️  EXACT ALLOWED FIELDS ONLY — Joi strict validation, no extra fields.
    Do NOT add: userAgent, timestamp, or any other field not listed above.
Response 201: { success: true, data: { id: ObjectId } }
```

#### Attacks
```
GET  /api/attacks/recent?limit=50
Response: { success: true, data: AttackEvent[] }

GET  /api/attacks/:id/forensics
Response data: { attack, raw_request, ip_intel, attack_chain }
```

#### Atlas Search (MongoDB Atlas Track)
```
GET /api/attacks/search?q=<term>&limit=20&page=1
GET /api/attacks/search/stats
```

#### Alerts
```
GET   /api/alerts?limit=50
PATCH /api/alerts/:id/read
POST  /api/alerts/armoriq  ← called by ArmorIQ executor only
```

#### Action Queue
```
GET  /api/actions/pending
POST /api/actions/:id/approve  Body: { approvedBy: string }
POST /api/actions/:id/reject   Body: { rejectedBy: string }
```

#### Audit Log
```
GET  /api/audit?limit=100
POST /api/audit/ingest  ← called by audit_logger.py only
```

#### Other
```
POST /api/armoriq/trigger    Body: { ip?, attackType?, severity?, confidence?, status? }
POST /api/pcap/upload        multipart: field "pcap" + field "projectId"
GET  /api/stats
GET  /api/service-status
GET  /api/logs/recent?limit=50
GET  /health
```

---

## 6. OpenClaw Enforcement Architecture

### Files in `services/armoriq-agent/`

| File | Role |
|------|------|
| `main.py` | FastAPI app. Calls `_evaluate_with_fallback()` per intent |
| `intent_builder.py` | Builds 5–6 `IntentModel` objects per attack |
| `openclaw_runtime.py` | **PRIMARY enforcer**. Loads `policy.yaml`. RULE_001→004→DEFAULT |
| `policy_engine.py` | **FALLBACK enforcer**. Hardcoded rules, used if openclaw_runtime crashes |
| `executor.py` | Fires ALLOW decisions to Gateway endpoints (HTTP 200/201 check) |
| `audit_logger.py` | POSTs every decision to `/api/audit/ingest` |
| `models.py` | Typed Pydantic models |
| `policy.yaml` | Declarative policy: allowed/blocked lists, risk_rules, default: BLOCK |

### `policy_rule_id` enum

| Rule | Fires when |
|------|------------|
| `RULE_001` | action is in `blocked_actions` list |
| `RULE_002` | `risk_level == 'critical'` |
| `RULE_003` | `risk_level == 'high'` |
| `RULE_004` | action is in `allowed_actions` list |
| `RULE_DEFAULT` | nothing matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | human approved or rejected via Dashboard |

---

## 7. MongoDB Schema — All 6 Collections

### `systemlogs`
```js
{ _id, projectId*, timestamp*, method, url, queryParams, body,
  headers:{userAgent,contentType,referer}, ip*, responseCode, processingTimeMs }
```

### `attackevents`
```js
{ _id, requestId*, timestamp*, ip*, attackType*, severity*, status*,
  detectedBy, confidence, payload, explanation, mitigationSuggestion, responseCode }
// Atlas Search index: 'attackevents_search'
```

### `alerts`
```js
{ _id, attackId*, title, message, severity,
  type: attack_detected|armoriq_action|service_down|rate_limit|anomaly,
  isRead, resolvedAt, meta }
```

### `action_queue`
```js
{ _id, attackId (String, not ObjectId)*, action*, status*,
  agentReason, blockedReason, ip, approvedBy, approvedAt, executedAt }
```

### `audit_log`
```js
{ _id, intent_id, action, status*, triggeredBy, ip*, attackId (String),
  policy_rule_id, enforcement_level, reason, meta }
// collection: 'audit_log' (singular, NOT 'audit_logs')
```

### `servicestatuses`
```js
{ _id, serviceName (unique), status, lastChecked, responseTimeMs, errorMessage, meta }
```

`*` = indexed field

---

## 8. Canonical Field Registry

### `attackType` enum
`sqli` · `xss` · `traversal` · `command_injection` · `ssrf` · `lfi_rfi` · `brute_force` · `hpp` · `xxe` · `webshell` · `recon` · `ddos` · `unknown`

### ArmorIQ Action enum + Policy

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

## 9. Build Status

### ✅ COMPLETE & VERIFIED (as of 2026-03-27 prod deploy)

| Feature | Evidence |
|---------|----------|
| Gateway API — 11 route files | All routes respond correctly |
| MongoDB — 6 models live | 125+ logs, 77+ attacks saved |
| Socket.io — 6 events | Live dashboard updates confirmed |
| Log ingest → Detection Engine pipeline | sqli/xss/traversal/command_injection classified |
| PCAP Processor — 8 detectors | 10/10 tests pass |
| ArmorIQ Agent — full OpenClaw pipeline | 7/7 pytest pass, live enforcement confirmed |
| React Dashboard — all 10 pages | All render with live data, no Network Error |
| PM2 process manager | All 5 services (incl. dashboard) managed by PM2 |
| EC2 production deployment | All 4 backend services + dashboard live on 44.201.147.239 |
| MongoDB Atlas cloud | IP allowlisted to EC2 only, Atlas Search live |
| validate-env.sh | 16/16 checks pass in production |

### 🟡 PARTIAL

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Detection Engine | 45-rule engine + adversarial decoder | `sentinel_v5.pkl` ML model |
| Gemini AI integration | `GEMINI_API_KEY` env var wired | No Gemini API key configured |
| Dashboard Charts | StatsPanel component | Recharts donut + timeline not wired to live data |

### 🔲 NOT BUILT

| Feature | Priority |
|---------|----------|
| ML model `sentinel_v5.pkl` | P0 |
| Dashboard charts (donut + timeline) | P1 |
| Threat Intelligence (AbuseIPDB / IPInfo) | P1 |
| Nginx reverse proxy + HTTPS/TLS | P1 |
| Export CSV/JSON | P2 |
| Settings page | P2 |

---

## 10. Port & URL Map + Start Commands

### Local Development

| Service | Port | Command |
|---------|------|---------|
| Gateway API | 3000 | `cd backend && npm run dev` |
| Detection Engine | 8002 | `cd services/detection-engine && source .venv/bin/activate && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `cd services/pcap-processor && uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `cd services/armoriq-agent && source .venv/bin/activate && uvicorn main:app --port 8004` |
| Dashboard | 5173 | `cd dashboard && npm run dev` |
| Demo Target | 4000 | `cd demo-target && node server.js` |

### Production (PM2 — see §14)

| Service | Port | Public URL |
|---------|------|------------|
| Gateway API | 3000 | `http://44.201.147.239:3000` |
| Detection Engine | 8002 | `http://44.201.147.239:8002` |
| PCAP Processor | 8003 | `http://44.201.147.239:8003` |
| ArmorIQ Agent | 8004 | `http://44.201.147.239:8004` |
| Dashboard | 5173 | `http://44.201.147.239:5173` |

---

## 11. Socket.io Events Reference

| Event | Emitted by | Payload |
|-------|-----------|--------|
| `attack:new` | Gateway attackService | `{ id, ip, attackType, severity, status, detectedBy, confidence, timestamp }` |
| `alert:new` | Gateway attackService | `{ id, title, severity, type, timestamp }` |
| `action:pending` | Gateway actionQueueController | `{ id, action, agentReason, blockedReason, ip, attackId }` |
| `audit:new` | Gateway auditController | `{ id, action, status, reason, policy_rule_id, triggeredBy, ip, attackId, timestamp }` |
| `service:status` | Gateway serviceHealthService | `{ serviceName, status, responseTimeMs, timestamp }` |
| `stats:update` | Gateway statsService | stats payload |

---

## 12. Response Envelope Standard

```js
{ success: true,  message: string, data: object | array }   // success
{ success: false, message: string, code: string }           // error
// code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
```

**Frontend:** `api.js` uses `unwrap = res => res.data.data`.

> ⚠️ Arrays come back as `{ success:true, data:[] }` — use `r.data.length` not `r.length`.

---

## 13. Demo Day Guide

### Health Check (production)
```bash
./status.sh
# Expected: 4x HTTP 200, all PM2 processes online
```

### Health Check (local dev)
```bash
curl http://localhost:3000/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health   # must show openclaw_loaded:true
```

### Ingest Test
```bash
curl -s -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"projectId":"demo","method":"GET",
       "url":"/search?q=<script>alert(1)</script>",
       "ip":"1.2.3.4","headers":{},"queryParams":{},"body":{}}'
# Expected: { "success": true, "data": { "id": "..." } }
```

### ArmorIQ Demo — ALLOW
```bash
curl -X POST http://localhost:8004/respond \
  -H "Content-Type: application/json" \
  -d '{"attackId":"demo-1","ip":"5.5.5.5","attackType":"sqli",
       "severity":"medium","confidence":0.9,"status":"attempt"}'
# actionsExecuted: [send_alert, log_attack, rate_limit_ip]
```

### ArmorIQ Demo — BLOCK
```bash
curl -X POST http://localhost:8004/respond \
  -H "Content-Type: application/json" \
  -d '{"attackId":"demo-2","ip":"6.6.6.6","attackType":"brute_force",
       "severity":"critical","confidence":0.97,"status":"successful"}'
# actionsQueued: [permanent_ban_ip(BLOCK), shutdown_endpoint(BLOCK)]
```

### Full E2E Attack Script
```bash
bash demo-target/attack.sh
# Watch: http://44.201.147.239:5173
```

### What to Say to Judges

> *"SENTINEL detects threats in real time, generates structured response intents,
> and enforces them through our OpenClaw runtime — reading from a declarative
> policy.yaml file. Safe actions like send_alert execute automatically.
> Dangerous actions like permanent_ban_ip are deterministically blocked
> and queued for human approval. Every decision is logged to the audit trail
> with the exact rule that fired it."*

---

## 14. Production Deployment — AWS EC2

### Infrastructure

| Item | Value |
|------|-------|
| Provider | AWS EC2 |
| Instance | Ubuntu (ubuntu user) |
| Public IP | `44.201.147.239` |
| Internal hostname | `ip-172-31-84-131` |
| Process manager | PM2 |
| MongoDB | Atlas cloud (cluster0.lenxm5v.mongodb.net) |
| Atlas IP allowlist | `44.201.147.239` only (not 0.0.0.0/0) |

### EC2 Security Group — Open Ports

| Port | Service |
|------|---------|
| 22 | SSH |
| 3000 | Gateway API |
| 5173 | Dashboard |
| 8002 | Detection Engine |
| 8003 | PCAP Processor |
| 8004 | ArmorIQ Agent |

> **Note:** Ports 8002–8004 can be closed to public once Nginx reverse proxy is set up (future P1 task).

### PM2 Process List

| PM2 id | Name | Port | Mode |
|--------|------|------|------|
| 0 | sentinal-gateway | 3000 | fork |
| 1 | sentinal-detection | 8002 | fork |
| 2 | sentinal-pcap | 8003 | fork |
| 3 | sentinal-armoriq | 8004 | fork |
| 4 | sentinal-dashboard | 5173 | fork |

### `.env` — Required Values (root `~/SENTINAL/.env`)

```bash
# ── Core ──────────────────────────────────────────────────
NODE_ENV=production
LOG_LEVEL=info
PUBLIC_URL=http://44.201.147.239

# ── Ports ─────────────────────────────────────────────────
GATEWAY_PORT=3000
DETECTION_PORT=8002
PCAP_PORT=8003
ARMORIQ_PORT=8004

# ── Internal service URLs ──────────────────────────────────
DETECTION_URL=http://localhost:8002
PCAP_URL=http://localhost:8003
ARMORIQ_URL=http://localhost:8004
GATEWAY_URL=http://localhost:3000

# ── Database ───────────────────────────────────────────────
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.lenxm5v.mongodb.net/sentinal
#          ⚠️ Must be MONGO_URI (not MONGO_URL) — validate-env.sh checks this

# ── Secrets ────────────────────────────────────────────────
JWT_SECRET=<64-char hex>   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
API_SECRET=<64-char hex>

# ── Optional ───────────────────────────────────────────────
GEMINI_API_KEY=none        # set to real key when Gemini integration is active
```

### `dashboard/.env.production`

```bash
VITE_API_URL=http://44.201.147.239:3000
VITE_SOCKET_URL=http://44.201.147.239:3000
```

> These are baked into the Vite build at compile time. After changing, run `npm run build` again.

### First-Time Deploy Steps

```bash
# 1. Clone
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd ~/SENTINAL

# 2. Create .env
cp .env.example .env
nano .env   # fill in MONGO_URI, JWT_SECRET, API_SECRET

# 3. Validate env
chmod +x scripts/validate-env.sh
./scripts/validate-env.sh --env-only
# Must show: ALL CHECKS PASSED (16/16)

# 4. Install backend deps
cd ~/SENTINAL/backend && npm install --production

# 5. Build dashboard
cd ~/SENTINAL/dashboard && npm install && npm run build

# 6. Start all services
cd ~/SENTINAL
mkdir -p logs
pm2 start ecosystem.config.js

# 7. Start dashboard
pm2 start "serve -s dist -l 5173" --name sentinal-dashboard

# 8. Save + enable auto-start on reboot
pm2 save
pm2 startup   # copy and run the printed sudo command

# 9. Verify
./status.sh
```

### Day-to-Day Commands

```bash
pm2 list                          # show all processes + status
pm2 logs sentinal-gateway         # tail gateway logs
pm2 logs --lines 50 --nostream    # last 50 lines all services
pm2 restart all                   # restart everything
pm2 restart sentinal-gateway      # restart one service
./status.sh                       # full health check
./scripts/validate-env.sh         # env + health check combined

# After code changes:
git pull origin main
cd dashboard && npm run build
pm2 restart all
pm2 save
```

### Known Issues Fixed During Deployment

| Issue | Fix |
|-------|-----|
| `validate-env.sh` had broken `cd` on line 30 | Rewrote script — now uses `$(dirname "${BASH_SOURCE[0]}")/..` pattern |
| `MONGO_URL` instead of `MONGO_URI` in `.env` | Renamed to `MONGO_URI` — Joi validator requires exact name |
| `dashboard/src/services/api.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_API_URL` with localhost fallback |
| `dashboard/src/services/socket.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_SOCKET_URL` with localhost fallback |
| `ecosystem.config.js` partially written (corrupted) | Fully rewritten with correct venv Python paths for all 4 services |
| `npm install --production` deprecation warning | Use `npm install --omit=dev` for npm 11+ |

---

## 15. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | ArmorIQ Agent + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Fix1: typed Pydantic models + dot-access. Fix2: executor safe HTTP. Fix3: audit:new socket event. Demo Target E2E |
| 2026-03-26 | 4.0 | openclaw_runtime.py + policy.yaml added. 4 redundant doc files deleted. MASTER_REFERENCE rewritten |
| 2026-03-27 | 5.0 | MongoDB Atlas Track: Atlas Search, $facet aggregation, all 6 collections CRUD-verified, atlasVerify.js |
| 2026-03-27 | 6.0 | **Production deployment on AWS EC2**: PM2 setup, validate-env.sh fixed, MONGO_URL→MONGO_URI fix, dashboard API URL env var fix (VITE_API_URL/VITE_SOCKET_URL), ecosystem.config.js rewritten, dashboard/.env.production added, MongoDB Atlas IP allowlisted to EC2. All 5 services live at 44.201.147.239. 125 logs + 77 attacks confirmed in production. |

---

## 16. MongoDB Atlas Track

### Connection — `backend/src/config/database.js`
- URI read from `process.env.MONGO_URI`
- Retry logic: 3 attempts, 3s delay
- Options: `serverSelectionTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:10`
- Graceful shutdown on `SIGINT`/`SIGTERM`

### Atlas Search Index
- **Index name:** `attackevents_search`
- **Collection:** `attackevents`
- **Fields:** `payload`, `ip`, `attackType`, `explanation`, `mitigationSuggestion`
- **Endpoint:** `GET /api/attacks/search?q=<term>`
- **Fallback:** auto-degrades to `$regex` if index not provisioned

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "payload":              { "type": "string", "analyzer": "lucene.standard" },
      "ip":                   { "type": "string", "analyzer": "lucene.keyword" },
      "attackType":           { "type": "string", "analyzer": "lucene.keyword" },
      "explanation":          { "type": "string", "analyzer": "lucene.standard" },
      "mitigationSuggestion": { "type": "string", "analyzer": "lucene.standard" }
    }
  },
  "name": "attackevents_search"
}
```

### Live Production Evidence (2026-03-27)
```
GET /health on all 4 services         → HTTP 200, all uptime confirmed
POST /api/logs/ingest (XSS payload)   → { success:true, data:{ id:"69c64d4bd30dcf7649d14622" } }
GET /api/stats                        → totalLogs:125, totalAttacks:77, criticalAlerts confirmed
Dashboard http://44.201.147.239:5173  → Live data, no Network Error, all pages render
./status.sh                           → 16 passed, 0 warnings, 0 failed
```
