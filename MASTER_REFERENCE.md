# SENTINAL — Master Reference Document

> **Version:** 9.0 · **Date:** 2026-03-27 · **Status:** Living document — single source of truth
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
14. [Production Deployment — AWS EC2 (Full Guide)](#14-production-deployment)
15. [AWS Academy — Every Session Checklist](#15-aws-academy)
16. [Changelog](#16-changelog)
17. [MongoDB Atlas Track](#17-mongodb-atlas-track)

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
│  POST /process │  │  POST /analyze        │  │  POST /respond           │
│  8 detectors   │  │  45-rule engine       │  │  intent_builder.py       │
│  full pipeline │  │  adversarial decoder  │  │  openclaw_runtime.py     │
│  10/10 tests ✅│  │  ML optional          │  │  policy_engine.py (fbck) │
└────────────────┘  └───────────────────────┘  │  executor.py             │
                                               │  audit_logger.py         │
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
│  /dashboard /attacks /alerts /action-queue /audit /pcap /logs        │
│  /services /simulate → all 14 pages, Socket.io live updates          │
└──────────────────────────────────────────────────────────────────────┘
```

### OpenClaw Decision Flow

```
POST :8004/respond
         │
  intent_builder.py  →  builds 5–6 ProposedAction intents per attack
         │
  openclaw_runtime.py  ← PRIMARY (reads policy.yaml)
    RULE_001: action in blocked_actions  → BLOCK
    RULE_002: risk_level == 'critical'   → BLOCK
    RULE_003: risk_level == 'high'       → BLOCK
    RULE_004: action in allowed_actions  → ALLOW
    RULE_DEFAULT: no match              → BLOCK (fail-safe)
    on crash → policy_engine.py fallback
         │
  ┌──────┴──────────────────────┐
  │ ALLOW                       │ BLOCK
  │ executor.py fires           │ ActionQueue.create() → MongoDB
  │ emit(audit:new)             │ emit(action:pending) + emit(audit:new)
  └─────────────────────────────┘
         │
  audit_logger.py → POST /api/audit/ingest → AuditLog saved
```

---

## 2. Exact Repo Structure

```
SENTINAL/
├── .env                             ← NOT committed (gitignored). See §14 for values.
├── .env.example                     template for all env vars
├── .env.backup/                     directory (gitignored)
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md              ← this file (only doc)
├── SPONSOR_TRACK_REPORT.md          ArmorIQ/sponsor track submission doc
├── SENTINAL_Postman_Collection.json ← complete Postman v2.1 collection (40+ requests)
├── ecosystem.config.js              PM2 config — uses absolute .venv Python paths
├── deploy.sh                        ← ONE-COMMAND full deploy for AWS Academy
├── start.sh                         start all PM2 services
├── stop.sh                          stop all PM2 services
├── status.sh                        check all service health
│
├── backend/                         SERVICE 1: Gateway API (Node :3000)
│   ├── server.js
│   ├── package.json
│   ├── scripts/
│   │   ├── seed.js
│   │   └── atlasVerify.js
│   └── src/
│       ├── config/database.js
│       ├── controllers/             (10 controllers)
│       │   ├── attackController.js
│       │   ├── alertController.js
│       │   ├── actionQueueController.js
│       │   ├── auditController.js
│       │   ├── armoriqController.js
│       │   ├── logController.js
│       │   ├── pcapController.js
│       │   ├── statsController.js
│       │   ├── serviceStatusController.js
│       │   └── forensicsController.js
│       ├── models/                  (6 models)
│       │   ├── SystemLog.js
│       │   ├── AttackEvent.js
│       │   ├── Alert.js
│       │   ├── ActionQueue.js
│       │   ├── AuditLog.js
│       │   └── ServiceStatus.js
│       ├── routes/                  (11 route files)
│       │   ├── health.js            GET /health
│       │   ├── logs.js              POST /api/logs/ingest · GET /api/logs/recent
│       │   ├── attacks.js           GET recent · search · search/stats · :id/forensics
│       │   ├── alerts.js            GET /api/alerts · PATCH :id/read
│       │   ├── actions.js           GET pending · POST :id/approve · POST :id/reject
│       │   ├── audit.js             GET /api/audit · POST /api/audit/ingest
│       │   ├── armoriq.js           POST /api/armoriq/trigger
│       │   ├── pcap.js              POST /api/pcap/upload · GET jobs · GET :id
│       │   ├── stats.js             GET /api/stats
│       │   ├── serviceStatus.js     GET /api/service-status
│       │   └── forensics.js         GET /api/attacks/:id/forensics
│       ├── services/                (5 services)
│       │   ├── attackService.js     creates AttackEvent + Alert + emits sockets
│       │   ├── detectionConnector.js POST :8002/analyze
│       │   ├── armoriqConnector.js  POST :8004/respond
│       │   ├── serviceHealthService.js polls all 4 services
│       │   └── statsService.js      aggregate stats + emit stats:update
│       ├── sockets/broadcastService.js  Socket.io emit helpers
│       ├── tests/                   (8 test files)
│       └── utils/
│
├── dashboard/                       SERVICE 5: React SPA (Vite :5173)
│   ├── .env.production              VITE_API_URL + VITE_SOCKET_URL (set by deploy.sh)
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                  Router — 14 routes total
│       ├── main.jsx
│       ├── components/              (8 components)
│       │   ├── AppLayout.jsx        Navbar + Outlet wrapper
│       │   ├── Navbar.jsx           Nav links + live badge counters (alerts, queue)
│       │   ├── ActionQueue.jsx      Pending actions table + approve/reject buttons
│       │   ├── AlertsPanel.jsx      Live alert feed
│       │   ├── LiveAttackFeed.jsx   Real-time attack event list
│       │   ├── StatsPanel.jsx       Summary stat cards
│       │   ├── SystemStatus.jsx     Service health indicators
│       │   └── ForensicsDrawer.jsx  Slide-in forensics detail panel
│       ├── hooks/
│       │   ├── useSocket.js         Socket.io event subscription hook
│       │   └── [other hooks]
│       ├── pages/                   (14 pages)
│       │   ├── Landing.jsx          /  → entry/splash page
│       │   ├── Dashboard.jsx        /dashboard → StatsPanel + LiveAttackFeed + SystemStatus
│       │   ├── Attacks.jsx          /attacks → full attack events table
│       │   ├── ForensicsPage.jsx    /attacks/:id → forensics detail page
│       │   ├── Alerts.jsx           /alerts → alerts management
│       │   ├── Logs.jsx             /logs → system logs viewer
│       │   ├── PcapAnalyzer.jsx     /pcap → PCAP upload + results
│       │   ├── ActionQueuePage.jsx  /action-queue → blocked action approvals
│       │   ├── AuditLog.jsx         /audit → full audit trail
│       │   ├── Services.jsx         /services → all 4 service health pings
│       │   ├── Settings.jsx         /settings → configuration panel
│       │   ├── Docs.jsx             /docs → documentation viewer
│       │   ├── SimulateAttack.jsx   /simulate → one-click attack simulator (demo tool)
│       │   └── NotFound.jsx         /* → 404
│       └── services/
│           ├── api.js               all API calls — reads VITE_API_URL (not hardcoded)
│           └── socket.js            Socket.io client — reads VITE_SOCKET_URL (not hardcoded)
│
├── config/
│
├── demo-target/                     E2E harness — vulnerable Express app (:4000)
│   ├── server.js                    routes: / /users /login /search /file
│   │                                uses sentinel-middleware → Gateway :3000
│   ├── attack.sh                    shell script to fire all attack types
│   └── package.json
│
├── scripts/
│   ├── validate-env.sh              pre-deploy validator (16 checks)
│   ├── simulate_attack.py
│   └── simulate_attack.sh
│
└── services/
    ├── armoriq-agent/               SERVICE 4: Python/FastAPI :8004
    │   ├── main.py                  FastAPI app — POST /respond  GET /health
    │   ├── intent_builder.py        builds 5–6 IntentModel objects per attack
    │   ├── openclaw_runtime.py      PRIMARY — loads policy.yaml, RULE_001→DEFAULT
    │   ├── policy_engine.py         FALLBACK — hardcoded rules
    │   ├── executor.py              fires ALLOW decisions via HTTP
    │   ├── audit_logger.py          POSTs every decision to /api/audit/ingest
    │   ├── models.py                Pydantic models
    │   ├── policy.yaml              declarative: allowed_actions, blocked_actions
    │   ├── requirements.txt
    │   └── tests/test_enforcement.py  (7/7 pass)
    │
    ├── detection-engine/            SERVICE 3: Python/FastAPI :8002
    │   └── app/
    │       ├── main.py              FastAPI app — POST /analyze  GET /health
    │       ├── rules.py             45-rule detection engine
    │       ├── adversarial.py       encoding/obfuscation decoder
    │       └── [classifier.py]      ML model loader (optional — sentinel_v5.pkl)
    │
    ├── middleware/                  npm package: sentinel-middleware
    │   └── src/
    │       ├── index.js
    │       ├── config.js
    │       ├── sender.js
    │       └── adapters/
    │           └── express.js       sentinel() Express middleware factory
    │
    └── pcap-processor/              SERVICE 2: Python/FastAPI :8003
        ├── main.py                  FastAPI app — POST /process  GET /health
        ├── pcap_loader.py
        ├── packet_parser.py
        ├── flow_builder.py
        ├── attack_detector.py       8 attack detectors
        └── tests/                   (10/10 pass)
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
1.  User hits app → sentinel-middleware captures res.on('finish') async
2.  POST /api/logs/ingest → SystemLog saved to MongoDB
3.  setImmediate() → detectionConnector → POST :8002/analyze
4.  threat_detected = false → stop.
    threat_detected = true:
      AttackEvent.create() → emit(attack:new)
      IF high/critical: Alert.create() → emit(alert:new)
      callArmorIQ() [async] → POST :8004/respond
5.  ArmorIQ: openclaw_runtime evaluates each intent
      ALLOW → executor.py fires → audit entry
      BLOCK → ActionQueue.create() → emit(action:pending) → audit entry
6.  Human: /action-queue → APPROVE/REJECT → AuditLog(HUMAN_OVERRIDE)
```

### Flow B — PCAP Upload
```
POST /api/pcap/upload → POST :8003/process
→ pcap_loader → packet_parser → flow_builder → attack_detector
→ AttackEvent.create() per attack → emit(attack:new)
```

### Flow C — Direct ArmorIQ Trigger (Demo / Simulate Page)
```
POST /api/armoriq/trigger → reportAttack() → full pipeline (Flow A steps 4–6)
```

### Flow D — SimulateAttack Dashboard Page
```
Browser: /simulate page → click attack button
→ fetch POST /api/logs/ingest  (SQLi / XSS / Traversal / Command Injection)
  OR fetch POST /api/armoriq/trigger  (Brute Force Critical)
→ Dashboard Socket.io: attack:new / action:pending events received live
→ /simulate right panel updates with real detections in real time
```

---

## 5. API Contracts — Every Live Route

### Gateway (`:3000`) — all responses use envelope (§12)

```
POST /api/logs/ingest
Body: { projectId, method, url, ip, queryParams?, body?, headers?,
        responseCode?, processingTimeMs? }
⚠️  EXACT FIELDS ONLY — Joi strict mode. No userAgent, no extra fields.
Response 201: { success:true, data:{ id:ObjectId } }

GET  /api/attacks/recent?limit=50
GET  /api/attacks/:id/forensics
GET  /api/attacks/search?q=<term>&limit=20&page=1
GET  /api/attacks/search/stats

GET   /api/alerts?limit=50
PATCH /api/alerts/:id/read
POST  /api/alerts/armoriq        ← ArmorIQ executor only

GET  /api/actions/pending
POST /api/actions/:id/approve   Body: { approvedBy: string }
POST /api/actions/:id/reject    Body: { rejectedBy: string }

GET  /api/audit?limit=100
POST /api/audit/ingest          ← audit_logger.py only

POST /api/armoriq/trigger       Body: { ip?, attackType?, severity?, confidence?, status? }
POST /api/pcap/upload           multipart: field "pcap" + field "projectId"
GET  /api/stats
GET  /api/service-status
GET  /api/logs/recent?limit=50
GET  /health
```

### Detection Engine (`:8002`)
```
POST /analyze   Body: { logId, projectId, method, url, ip, queryParams, body, headers, responseCode }
GET  /health
```

### ArmorIQ Agent (`:8004`)
```
POST /respond   Body: { attackId, ip, attackType, severity, status, confidence }
GET  /health    → { openclaw_loaded:bool, enforcement:'ArmorClaw-v1' }
```

### PCAP Processor (`:8003`)
```
POST /process   Body: { filepath:string, projectId:string }
GET  /health
```

### Demo Target (`:4000`)
```
GET  /                              health check
GET  /users                         returns demo user list
POST /login                         Body: { username, password } — intentionally vulnerable
GET  /search?q=<query>              reflects query — XSS/command injection target
GET  /file?name=<filename>          path traversal target
```
> All demo-target routes pass through `sentinel-middleware` → Gateway automatically.

---

## 6. OpenClaw Enforcement Architecture

| File | Role |
|------|------|
| `main.py` | FastAPI app — `_evaluate_with_fallback()` per intent |
| `intent_builder.py` | Builds 5–6 `IntentModel` objects per attack |
| `openclaw_runtime.py` | **PRIMARY** — loads `policy.yaml`, RULE_001→004→DEFAULT |
| `policy_engine.py` | **FALLBACK** — hardcoded rules, used if openclaw_runtime crashes |
| `executor.py` | Fires ALLOW decisions (HTTP 200/201 check, no raise_for_status) |
| `audit_logger.py` | POSTs every decision to `/api/audit/ingest` |
| `policy.yaml` | Declarative: allowed_actions, blocked_actions, risk_rules, default:BLOCK |

### `policy_rule_id` enum
| Rule | Fires when |
|------|------------|
| `RULE_001` | action in `blocked_actions` |
| `RULE_002` | `risk_level == 'critical'` |
| `RULE_003` | `risk_level == 'high'` |
| `RULE_004` | action in `allowed_actions` |
| `RULE_DEFAULT` | nothing matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | human approved/rejected via Dashboard |

---

## 7. MongoDB Schema — All 6 Collections

```
systemlogs:     { projectId*, timestamp*, method, url, queryParams, body, headers, ip*, responseCode, processingTimeMs }
attackevents:   { requestId*, timestamp*, ip*, attackType*, severity*, status*, detectedBy, confidence, payload, explanation, mitigationSuggestion }
alerts:         { attackId*, title, message, severity, type, isRead, resolvedAt, meta }
action_queue:   { attackId(String)*, action*, status*, agentReason, blockedReason, ip, approvedBy, approvedAt }
audit_log:      { intent_id, action, status*, triggeredBy, ip*, attackId(String), policy_rule_id, enforcement_level, reason, meta }
servicestatuses:{ serviceName(unique), status, lastChecked, responseTimeMs, errorMessage }
```
`*` = indexed  |  `audit_log` = singular (NOT `audit_logs`)  |  `attackId` = plain String in action_queue + audit_log

---

## 8. Canonical Field Registry

### `attackType` enum
`sqli` · `xss` · `traversal` · `command_injection` · `ssrf` · `lfi_rfi` · `brute_force` · `hpp` · `xxe` · `webshell` · `recon` · `ddos` · `unknown`

### ArmorIQ Action enum + Policy
| Action | Policy | Rule |
|--------|--------|------|
| `send_alert` / `log_attack` / `rate_limit_ip` / `flag_for_review` / `generate_report` | ALLOW | RULE_004 |
| `permanent_ban_ip` / `shutdown_endpoint` / `purge_all_sessions` / `modify_firewall_rules` | BLOCK | RULE_001 |

---

## 9. Build Status

### ✅ COMPLETE & VERIFIED (2026-03-27 production)
| Feature | Evidence |
|---------|----------|
| Gateway API — 11 route files | All routes respond correctly |
| MongoDB — 6 models | 125+ logs, 78+ attacks in production |
| Socket.io — 6 events | Live dashboard confirmed |
| Detection pipeline | sqli/xss/traversal/command_injection classified |
| PCAP Processor | 10/10 tests pass |
| ArmorIQ + OpenClaw | 7/7 pytest pass, live enforcement confirmed |
| React Dashboard — 14 pages | Live data, all pages functional |
| SimulateAttack page `/simulate` | One-click attack simulator, live socket feed |
| Postman Collection | 40+ requests, 8 folders, automated test scripts |
| PM2 — 5 services | All online, saved, auto-restart enabled |
| AWS EC2 deployment | All services live — deploy.sh confirmed working |
| MongoDB Atlas | IP allowlisted to EC2, Atlas Search live |
| deploy.sh | Full auto-deploy in ~12 min on fresh Ubuntu instance |

### 🟡 PARTIAL
| Feature | What's Missing |
|---------|----------------|
| Detection Engine | `sentinel_v5.pkl` ML model |
| Gemini integration | Real `GEMINI_API_KEY` |
| Dashboard Charts | Recharts donut + timeline not wired |

### 🔲 NOT BUILT
`sentinel_v5.pkl` (P0) · Dashboard charts (P1) · Threat Intelligence (P1) · Nginx + HTTPS (P1) · CSV export (P2)

---

## 10. Port & URL Map + Start Commands

### Local Development
| Service | Port | Command |
|---------|------|---------|
| Gateway | 3000 | `cd backend && npm run dev` |
| Detection Engine | 8002 | `cd services/detection-engine && source .venv/bin/activate && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `cd services/pcap-processor && source .venv/bin/activate && uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `cd services/armoriq-agent && source .venv/bin/activate && uvicorn main:app --port 8004` |
| Dashboard | 5173 | `cd dashboard && npm run dev` |
| Demo Target | 4000 | `cd demo-target && node server.js` |

### Production (dynamic — changes each AWS Academy session)
| Service | Port | URL Pattern |
|---------|------|-------------|
| Gateway | 3000 | `http://<CURRENT_IP>:3000` |
| Detection Engine | 8002 | `http://<CURRENT_IP>:8002` |
| PCAP Processor | 8003 | `http://<CURRENT_IP>:8003` |
| ArmorIQ Agent | 8004 | `http://<CURRENT_IP>:8004` |
| Dashboard | 5173 | `http://<CURRENT_IP>:5173` |

> ⚠️ IP changes every AWS Academy session. `deploy.sh` auto-detects and sets it.

---

## 11. Socket.io Events Reference

| Event | Emitted by | Payload |
|-------|-----------|--------|
| `attack:new` | attackService | `{ id, ip, attackType, severity, status, detectedBy, confidence, timestamp }` |
| `alert:new` | attackService | `{ id, title, severity, type, timestamp }` |
| `action:pending` | actionQueueController | `{ id, action, agentReason, blockedReason, ip, attackId }` |
| `audit:new` | auditController | `{ id, action, status, reason, policy_rule_id, triggeredBy, ip, attackId, timestamp }` |
| `service:status` | serviceHealthService | `{ serviceName, status, responseTimeMs, timestamp }` |
| `stats:update` | statsService | stats payload |

> `SimulateAttack.jsx` subscribes to `attack:new` and `action:pending` directly — live detections appear in the right panel of `/simulate` as soon as the backend processes them.

---

## 12. Response Envelope Standard

```js
{ success: true,  message: string, data: object | array }  // success
{ success: false, message: string, code: string }          // error
// code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
```
`api.js` unwraps with `res => res.data.data`. Arrays come as `{ data:[] }` — use `r.data.length` not `r.length`.

---

## 13. Demo Day Guide

### Health Check
```bash
# On EC2 (local)
curl http://localhost:3000/health
curl http://localhost:8004/health   # must show openclaw_loaded:true

# From browser / local machine
curl http://<EC2_IP>:3000/health
```

### Option A — Browser Attack Simulator (No Terminal Needed)
1. Open `http://<EC2_IP>:5173/simulate`
2. Click any attack button — fires real payload to Gateway
3. Switch tab to `/attacks` — new entry appears live
4. Click **🚨 LAUNCH FULL ATTACK WAVE** — all 5 attacks fire with 1.2s stagger
5. Right panel on `/simulate` shows live detections via Socket.io

**Attack buttons available:**
| Button | Payload | Target Route |
|--------|---------|--------------|
| 💉 SQL Injection | `admin' OR '1'='1' --` in body | POST /api/logs/ingest |
| ⚡ XSS Attack | `<script>alert(document.cookie)</script>` in URL | POST /api/logs/ingest |
| 📁 Path Traversal | `/../../../etc/passwd` in query | POST /api/logs/ingest |
| 💻 Command Injection | `hello; cat /etc/shadow` | POST /api/logs/ingest |
| 🔨 Brute Force (CRITICAL) | severity:critical → triggers BLOCK | POST /api/armoriq/trigger |

### Option B — Postman (SENTINAL_Postman_Collection.json)
Import from repo root or via:
```
https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/SENTINAL_Postman_Collection.json
```
Run **Folder 08 — End-to-End Demo Sequence** in order for full judge demo.

### Option C — Shell Script (demo-target)
```bash
bash demo-target/attack.sh
# Watch dashboard: http://<EC2_IP>:5173
```

### Option D — Direct curl
```bash
# SQLi
curl -s -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"projectId":"demo","method":"POST","url":"/login","ip":"1.2.3.4",
       "headers":{},"queryParams":{},"body":{"username":"admin'"'"' OR '"'"'1'"'"'='"'"'1'"'"' --","password":"x"}}'

# ArmorIQ ALLOW (medium)
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-1","ip":"5.5.5.5","attackType":"sqli","severity":"medium","confidence":0.9,"status":"attempt"}'
# actionsExecuted: [send_alert, log_attack, rate_limit_ip]

# ArmorIQ BLOCK (critical)
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-2","ip":"6.6.6.6","attackType":"brute_force","severity":"critical","confidence":0.97,"status":"successful"}'
# actionsQueued: [permanent_ban_ip(BLOCK), shutdown_endpoint(BLOCK)]
```

### Judge Pitch
> *"SENTINEL detects threats in real time and enforces responses through OpenClaw —
> reading from policy.yaml. Safe actions like send_alert execute automatically.
> Dangerous actions like permanent_ban_ip are blocked and queued for human approval.
> Every decision is logged with the exact policy rule that fired it."*

---

## 14. Production Deployment — AWS EC2 (Full Guide)

This is the complete step-by-step guide to deploy SENTINAL on a **fresh AWS EC2 Ubuntu instance**.

---

### PART A — AWS Console: Launch EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com) → **EC2** → **Launch Instance**
2. **Name:** `sentinal-server`
3. **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
4. **Instance type:** `t3.micro` (AWS Academy default)
5. **Key pair:** Select existing `sentinal-key` (or create new → download `.pem`)
6. **Security Group** — Add these inbound rules:

| Port | Source | Purpose |
|------|--------|---------| 
| 22 | 0.0.0.0/0 | SSH |
| 3000 | 0.0.0.0/0 | Gateway API |
| 5173 | 0.0.0.0/0 | Dashboard |
| 8002 | 0.0.0.0/0 | Detection Engine |
| 8003 | 0.0.0.0/0 | PCAP Processor |
| 8004 | 0.0.0.0/0 | ArmorIQ Agent |

7. **Storage:** 20 GB gp3
8. Click **Launch Instance** → wait 2 min → copy **Public IPv4**

---

### PART B — Connect to Instance

**Option 1 — EC2 Instance Connect (recommended for AWS Academy)**
1. AWS Console → your instance → **Connect** button
2. Tab: **EC2 Instance Connect** → Username: `ubuntu` → **Connect**
3. Browser terminal opens instantly — no `.pem` needed

**Option 2 — SSH from Linux/Mac**
```bash
chmod 400 ~/.ssh/sentinal-key.pem
ssh -i ~/.ssh/sentinal-key.pem ubuntu@<EC2_PUBLIC_IP>
```

**Option 3 — SSH from Windows (PowerShell)**
```powershell
ssh -i C:\Users\YourName\.ssh\sentinal-key.pem ubuntu@<EC2_PUBLIC_IP>
```

> If SSH times out: check Security Group has port 22 open to `0.0.0.0/0`

---

### PART C — One-Command Deploy (deploy.sh)

Once inside the terminal (EC2 Instance Connect or SSH), run:

```bash
curl -s https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/deploy.sh | bash
```

**What deploy.sh does automatically:**
1. Detects EC2 public IP via `checkip.amazonaws.com`
2. `apt install` — Node.js 20, Python3, venv, pip, build tools, libpcap, PM2, serve
3. `git clone` repo (or `git pull` if exists)
4. Creates Python `.venv` + `pip install -r requirements.txt` for all 3 services
5. `npm install` for backend + dashboard
6. Creates `.env` — auto-sets `PUBLIC_URL`, `JWT_SECRET`, `API_SECRET` — **prompts for MONGO_URI**
7. Writes `dashboard/.env.production` with current IP
8. `npm run build` dashboard
9. Rewrites `ecosystem.config.js` with absolute `.venv` Python paths
10. `pm2 start` all 5 services
11. Health checks all 4 backend services
12. Prints Atlas IP allowlist reminder

**Total time: ~10–12 minutes**

---

### PART D — After deploy.sh: Update MongoDB Atlas

1. Open [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**
2. Delete any old IP entries
3. **Add IP Address** → enter the IP printed by deploy.sh → **Confirm**
4. Wait 30 seconds → test: `curl http://localhost:3000/health`

---

### PART E — Verify

```bash
pm2 list
# All 5 services should show: online

curl http://localhost:3000/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health
# All should return HTTP 200

# Open dashboard in browser:
# http://<EC2_IP>:5173

# Open attack simulator:
# http://<EC2_IP>:5173/simulate
```

---

### Day-to-Day Operations

```bash
pm2 list                          # show all processes
pm2 logs sentinal-gateway         # tail gateway logs
pm2 logs --lines 50 --nostream    # last 50 lines all services
pm2 restart sentinal-gateway      # restart one service
pm2 restart all                   # restart everything

# After code changes:
git pull origin main
cd ~/SENTINAL/dashboard && npm run build
pm2 restart all && pm2 save
```

---

### Known Issues Fixed

| Issue | Fix |
|-------|-----|
| `validate-env.sh` broken `cd` on line 30 | Rewrote with correct `$(dirname "${BASH_SOURCE[0]}")/..` |
| `.env` had `MONGO_URL` instead of `MONGO_URI` | Renamed — Joi validator requires `MONGO_URI` |
| `api.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_API_URL` |
| `socket.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_SOCKET_URL` |
| `ecosystem.config.js` corrupted | deploy.sh rewrites it with absolute `.venv` paths |
| Dashboard `Network Error` in prod | Fixed by `dashboard/.env.production` with EC2 IP |
| Gateway HTTP 000 after deploy | MONGO_URI was stale in `.env` — must paste correct Atlas URI |
| EC2 Instance Connect failing | Reboot or Stop+Start the instance |
| SSH connection timeout | Security Group port 22 source was set to `My IP` — change to `0.0.0.0/0` |

---

## 15. AWS Academy — Every Session Checklist

> AWS Academy labs auto-terminate after ~4 hours. Every session = fresh Ubuntu instance + new IP.
> MongoDB Atlas data **persists** (cloud). EC2 data does **not**.

### What Changes Each Session

| Item | Persists? | Action needed |
|------|-----------|---------------|
| EC2 instance | ❌ Gone | Launch new instance |
| Public IP | ❌ Changes | Get new IP from console |
| All installed software | ❌ Gone | `deploy.sh` reinstalls everything |
| `.env` file | ❌ Gone | `deploy.sh` recreates (prompts MONGO_URI) |
| MongoDB Atlas data | ✅ Persists | Just update IP allowlist |
| GitHub repo code | ✅ Persists | `deploy.sh` clones latest |
| `.pem` key | ✅ Persists (if same key pair used) | Reuse existing `sentinal-key` |

### Every New Session — 4 Steps

**Step 1 — Launch new EC2 instance**
- AWS Console → EC2 → Launch Instance
- Ubuntu 22.04, t3.micro, key pair: `sentinal-key` (existing)
- Security Group: all 6 ports open (22, 3000, 5173, 8002, 8003, 8004)

**Step 2 — Connect via EC2 Instance Connect**
- Instance → **Connect** → **EC2 Instance Connect** → **Connect**
- (SSH from Linux: `ssh -i ~/.ssh/sentinal-key.pem ubuntu@<NEW_IP>`)

**Step 3 — Run deploy script**
```bash
curl -s https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/deploy.sh | bash
```
- When prompted: paste your `MONGO_URI` from MongoDB Atlas

**Step 4 — Update MongoDB Atlas IP**
- Atlas → Network Access → delete old IP → add new IP shown by deploy.sh

✅ Done. Dashboard live at `http://<NEW_IP>:5173`

### Getting Your MONGO_URI

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click your cluster → **Connect** → **Drivers**
3. Copy the string:
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/sentinal
```
4. Replace `<password>` with your actual Atlas password
5. Keep this string saved somewhere safe — you'll need it every session

### Troubleshooting This Session

| Problem | Fix |
|---------|-----|
| EC2 Instance Connect fails | Reboot instance → try again |
| SSH times out | Security Group → Port 22 → change source to `0.0.0.0/0` |
| Gateway HTTP 000 after deploy | Wrong/empty MONGO_URI → `nano ~/SENTINAL/.env` → fix → `pm2 restart sentinal-gateway` |
| Services stopped | `pm2 resurrect` or `pm2 start ecosystem.config.js` |
| Dashboard shows Network Error | `nano ~/SENTINAL/dashboard/.env.production` → update IP → `npm run build` → `pm2 restart sentinal-dashboard` |
| Atlas connection refused | IP allowlist not updated → Atlas → Network Access → add current IP |

---

## 16. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | ArmorIQ Agent + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Pydantic models fix, executor safe HTTP, audit:new socket, Demo Target E2E |
| 2026-03-26 | 4.0 | openclaw_runtime.py + policy.yaml. 4 redundant docs deleted |
| 2026-03-27 | 5.0 | MongoDB Atlas Track: Atlas Search, $facet, all 6 collections verified |
| 2026-03-27 | 6.0 | Production deploy: PM2, env fixes, VITE_API_URL fix, Atlas IP allowlist |
| 2026-03-27 | 7.0 | Full AWS EC2 deploy guide Parts A–M: .pem, EC2 launch, apt install, venvs, PM2 |
| 2026-03-27 | 8.0 | AWS Academy strategy: `deploy.sh` one-command deploy, §15 per-session checklist, IP change workflow, MONGO_URI prompt, Atlas IP update reminder, troubleshooting table, ecosystem.config.js absolute venv paths in deploy.sh |
| 2026-03-27 | 9.0 | SimulateAttack page `/simulate` (14th page), Postman collection `SENTINAL_Postman_Collection.json` (40+ requests, 8 folders), updated folder structure with all 14 pages + demo-target routes, §13 demo options A–D, §4 Flow D for simulate page, socket subscription notes |

---

## 17. MongoDB Atlas Track

### Connection — `backend/src/config/database.js`
- URI from `process.env.MONGO_URI` — fails fast if missing
- Retry: 3 attempts × 3s delay
- Options: `serverSelectionTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:10`
- Graceful shutdown: `SIGINT`/`SIGTERM` → `mongoose.connection.close()`

### Atlas Search Index
- **Name:** `attackevents_search` on collection `attackevents`
- **Fields:** `payload` (standard), `ip` (keyword), `attackType` (keyword), `explanation` (standard), `mitigationSuggestion` (standard)
- **Endpoint:** `GET /api/attacks/search?q=<term>` — auto-falls back to `$regex` if index not provisioned

```json
{
  "mappings": { "dynamic": false, "fields": {
    "payload":              { "type": "string", "analyzer": "lucene.standard" },
    "ip":                   { "type": "string", "analyzer": "lucene.keyword" },
    "attackType":           { "type": "string", "analyzer": "lucene.keyword" },
    "explanation":          { "type": "string", "analyzer": "lucene.standard" },
    "mitigationSuggestion": { "type": "string", "analyzer": "lucene.standard" }
  }},
  "name": "attackevents_search"
}
```

### Live Production Evidence (2026-03-27)
```
Server: AWS EC2 — 98.82.8.144
All 5 services: online via PM2
Health checks: gateway ✓  detection ✓  pcap ✓  armoriq ✓
MongoDB Atlas: IP allowlisted, connection confirmed
Dashboard: http://98.82.8.144:5173 — 14 pages live, all data rendering
Attack Simulator: http://98.82.8.144:5173/simulate — live socket feed confirmed
Postman Collection: SENTINAL_Postman_Collection.json — 40+ requests, 8 folders
```
