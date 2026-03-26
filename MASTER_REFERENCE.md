# SENTINAL — Master Reference Document

> **Version:** 3.0 · **Date:** 2026-03-26 · **Status:** Living document — update on every merge
>
> This document is the single source of truth for the SENTINAL project.
> It supersedes all previous versions. Use this for every new feature, bug fix, and
> integration decision. Do NOT invent field names — use the exact names listed in §6.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Repo Structure (Deep Scan)](#2-repo-structure)
3. [Service Registry](#3-service-registry)
4. [Complete Request Lifecycle](#4-complete-request-lifecycle)
5. [API Contracts — Every Route](#5-api-contracts)
6. [User Flows](#6-user-flows)
7. [MongoDB Schema — All 6 Collections](#7-mongodb-schema)
8. [Canonical Field Registry](#8-canonical-field-registry)
9. [Build Status — v3.0](#9-build-status)
10. [Port & URL Map](#10-port-map)
11. [Socket.io Events Reference](#11-socketio-events)
12. [Response Envelope Standard](#12-response-envelope)
13. [Demo Target & E2E Test Guide](#13-demo-target)
14. [Changelog](#14-changelog)

---

## 1. System Architecture Overview

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEVELOPER'S APPLICATION (or demo-target)                │
│                                                                             │
│   const { sentinel } = require('sentinel-middleware');                      │
│   app.use(sentinel({ projectId: 'my-app', gatewayUrl: 'http://...:3000' })) │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ POST /api/logs/ingest
                               │ (async fire-and-forget — zero latency to user)
                               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SERVICE 1 — GATEWAY API  (Node/Express :3000)             │
│                                                                             │
│  routes/logs.js      → validates (Joi) → SystemLog (MongoDB)               │
│  services/logService → setImmediate → detectionConnector.analyze()          │
│  services/attackService.reportAttack()                                      │
│    ├── AttackEvent.create()     → MongoDB                                   │
│    ├── Alert.create()           → MongoDB  (high/critical only)             │
│    ├── emitter.emit(attack:new) → Socket.io → Dashboard                     │
│    ├── emitter.emit(alert:new)  → Socket.io → Dashboard                     │
│    └── callArmorIQ()            → POST :8004/respond  (fire-and-forget)     │
│         ├── ALLOWED actions → executor.py → POST /api/alerts/armoriq        │
│         │                  → audit_logger → POST /api/audit/ingest          │
│         │                  → emitter.emit(audit:new) → Socket.io            │
│         └── BLOCKED actions → ActionQueue.create() → Socket.io action:pending│
│                             → audit_logger → POST /api/audit/ingest         │
│                             → emitter.emit(audit:new) → Socket.io           │
└──────┬──────────────────────────┬──────────────────────────┬────────────────┘
       │                          │                          │
       ▼                          ▼                          ▼
┌──────────────┐      ┌───────────────────────┐   ┌─────────────────────────┐
│  SERVICE 2   │      │      SERVICE 3         │   │      SERVICE 4          │
│  PCAP        │      │   DETECTION ENGINE     │   │   ARMORIQ AGENT         │
│  PROCESSOR   │      │   (Python/FastAPI :8002)│   │   (Python/FastAPI :8004)│
│  (:8003)     │      │                       │   │                         │
│              │      │  POST /analyze         │   │  POST /respond          │
│  POST        │      │  45-rule engine        │   │                         │
│  /process    │      │  + adversarial decoder │   │  intent_builder.py      │
│              │      │  + HTTP-status layer   │   │  policy_engine.py       │
│  8 detectors │      │  (ML model optional)   │   │  executor.py            │
│  used from   │      │                       │   │  audit_logger.py        │
│  /pcap page  │      │                       │   │  models.py (typed)      │
└──────────────┘      └───────────────────────┘   └─────────────────────────┘
                                                             │
                                    ┌────────────────────────┴──────────────┐
                                    │      ALLOWED (auto-executed)          │
                                    │  send_alert → POST /api/alerts/armoriq│
                                    │  log_attack → audit_log entry         │
                                    │  rate_limit_ip → audit_log entry      │
                                    │  flag_for_review → audit_log entry    │
                                    │  generate_report → audit_log entry    │
                                    │                                       │
                                    │      BLOCKED (require human review)   │
                                    │  permanent_ban_ip → action_queue      │
                                    │  shutdown_endpoint → action_queue     │
                                    │  purge_all_sessions → action_queue    │
                                    │  modify_firewall_rules → action_queue │
                                    └───────────────────┬───────────────────┘
                                                        │
                                                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SERVICE 5 — REACT DASHBOARD  (Vite/React :5173)             │
│                                                                             │
│  /dashboard    → Stats, live attack feed, service health, charts            │
│  /attacks      → AttackEvent table + forensics drawer                       │
│  /alerts  🔴   → Styled table: armoriq_action (purple) + attack_detected    │
│  /action-queue 🟠 → Confirm modal → Approve / Reject blocked actions        │
│  /audit        → Full policy decision log, filters, stat bar, auto-refresh  │
│  /pcap         → Upload .pcap → PCAP Processor → Detection Engine           │
│  /logs         → Raw SystemLogs                                             │
│  /services     → Health ping all 5 services                                 │
│  /settings     → Config (P2)                                                │
│  /docs         → Documentation                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### npm Middleware Flow

```
Developer installs sentinel-middleware in their Express/Fastify app
        │
        │  Every HTTP request → res.on('finish') fires async
        │  Fields captured: method, url, ip, queryParams, body (scrubbed),
        │                   headers (userAgent/contentType/referer),
        │                   responseCode, processingTimeMs, projectId
        │  Sensitive fields auto-redacted: password, token, secret, cvv, ssn
        │  Retry queue: up to 500 entries, retried every 10s if Gateway down
        │  Timer unref()'d so Node/Jest exits cleanly
        ▼
  POST /api/logs/ingest  →  SENTINAL Gateway
```

### ArmorIQ Decision Flow

```
Attack detected
       │
       ▼
 POST :8004/respond
       │
  intent_builder.py  →  builds 6 intents from attack context
  (ProposedAction typed Pydantic model — dot-access only)
       │
  policy_engine.py   →  evaluates each intent against POLICY_RULES[]
  Rule order (first match wins):
    RULE_001: action in BLOCKED_ACTIONS   → BLOCK
    RULE_002: risk_level == 'critical'    → BLOCK
    RULE_003: risk_level == 'high'        → BLOCK
    RULE_004: action in ALLOWED_ACTIONS   → ALLOW
    DEFAULT:  no match                   → BLOCK (fail-safe)
       │
  ┌────┴────────────────────────────┐
  │  ALLOW                          │  BLOCK
  │  send_alert ✅                  │  permanent_ban_ip 🔒
  │  log_attack ✅                  │  shutdown_endpoint 🔒
  │  rate_limit_ip ✅               │  purge_all_sessions 🔒
  │  flag_for_review ✅             │  modify_firewall_rules 🔒
  │  generate_report ✅             │
  └─────────────────────────────────┘
       │                            │
  executor.py                  action_queue (MongoDB)
  (HTTP 200/201 = success,      Socket.io → action:pending
   else warning + return False)  Dashboard ActionQueue card
  audit_logger.py              Human: APPROVE / REJECT
  emitter(audit:new)           audit_log updated
  EVENTS.AUDIT_NEW             emitter(audit:new)
                               EVENTS.AUDIT_NEW
```

---

## 2. Repo Structure

```
SENTINAL/
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md          ← this file
│
├── backend/                     ← SERVICE 1: Gateway API (Node/Express :3000)
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── config/
│       │   └── database.js
│       ├── controllers/
│       │   ├── actionQueueController.js ← GET pending, POST approve/reject
│       │   ├── alertController.js       ← GET /alerts, PATCH read, POST /armoriq
│       │   ├── attackController.js      ← GET recent, GET forensics
│       │   ├── auditController.js       ← POST ingest, GET list
│       │   │                              emits EVENTS.AUDIT_NEW after create ✅
│       │   ├── forensicsController.js
│       │   ├── healthController.js
│       │   ├── logController.js
│       │   ├── serviceStatusController.js
│       │   └── statsController.js
│       ├── middleware/
│       ├── models/
│       │   ├── ActionQueue.js           ✅ BUILT
│       │   ├── Alert.js                 ✅ BUILT (type enum includes armoriq_action)
│       │   ├── AttackEvent.js           ✅ BUILT
│       │   ├── AuditLog.js              ✅ BUILT
│       │   ├── ServiceStatus.js         ✅ BUILT
│       │   └── SystemLog.js             ✅ BUILT
│       ├── routes/
│       │   ├── actions.js               ✅ BUILT — pending, approve, reject
│       │   ├── alerts.js                ✅ BUILT — GET, PATCH read, POST /armoriq
│       │   ├── armoriq.js               ✅ BUILT — POST /trigger (demo/test)
│       │   ├── attacks.js               ✅ BUILT
│       │   ├── audit.js                 ✅ BUILT
│       │   ├── forensics.js             ✅ BUILT
│       │   ├── health.js                ✅ BUILT
│       │   ├── logs.js                  ✅ BUILT
│       │   ├── pcap.js                  ✅ BUILT (v2 schema)
│       │   ├── serviceStatus.js         ✅ BUILT
│       │   └── stats.js                 ✅ BUILT
│       ├── services/
│       │   ├── attackService.js         ✅ BUILT — reportAttack + callArmorIQ
│       │   ├── detectionConnector.js    ✅ BUILT — circuit breaker, default :8002
│       │   ├── logService.js            ✅ BUILT
│       │   ├── serviceHealthService.js  ✅ BUILT
│       │   └── statsService.js         ✅ BUILT
│       ├── sockets/
│       │   └── broadcastService.js      ✅ BUILT
│       │       EVENTS: attack:new | alert:new | service:status |
│       │               stats:update | action:pending | audit:new ✅
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
├── dashboard/                   ← SERVICE 5: React SPA (Vite :5173)
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── ActionQueue.jsx          ✅ BUILT — confirm modal, fade-out, attack link
│       │   ├── AlertsPanel.jsx          ✅ BUILT
│       │   ├── AppLayout.jsx
│       │   ├── ForensicsDrawer.jsx      ✅ BUILT
│       │   ├── LiveAttackFeed.jsx       ✅ BUILT
│       │   ├── Navbar.jsx               ✅ BUILT — live badge counters
│       │   ├── StatsPanel.jsx           ✅ BUILT
│       │   └── SystemStatus.jsx         ✅ BUILT
│       ├── hooks/
│       │   ├── useApi.js
│       │   ├── useInterval.js
│       │   └── useSocket.js
│       ├── pages/
│       │   ├── ActionQueuePage.jsx      ✅ BUILT
│       │   ├── Alerts.jsx               ✅ BUILT — Tailwind, type filter, mark-all-read
│       │   ├── Attacks.jsx              ✅ BUILT
│       │   ├── AuditLog.jsx             ✅ BUILT — stat bar, filters, auto-refresh 10s
│       │   ├── Dashboard.jsx            ✅ BUILT
│       │   ├── Docs.jsx
│       │   ├── ForensicsPage.jsx        ✅ BUILT
│       │   ├── Landing.jsx
│       │   ├── Logs.jsx                 ✅ BUILT
│       │   ├── NotFound.jsx
│       │   ├── PcapAnalyzer.jsx         ✅ BUILT (v2 schema)
│       │   ├── Services.jsx             ✅ BUILT
│       │   └── Settings.jsx
│       └── services/
│           ├── api.js                   ✅ BUILT — all API + ArmorIQ calls
│           └── socket.js                ✅ BUILT
│
├── demo-target/                 ← E2E test harness (Express :4000)
│   ├── server.js                ✅ BUILT — real Express app + sentinel-middleware
│   ├── attack.sh                ✅ BUILT — 7 automated attack scenarios
│   └── package.json
│
├── scripts/
│   └── simulate_attack.sh               ✅ BUILT — fires 2 attacks, tests full pipeline
│
└── services/
    ├── armoriq-agent/               ← SERVICE 4: Python/FastAPI :8004
    │   ├── main.py                  ✅ BUILT — FastAPI app, POST /respond + GET /health
    │   ├── intent_builder.py        ✅ BUILT — builds 6 ProposedAction intents
    │   ├── policy_engine.py         ✅ BUILT — 4 POLICY_RULES, dot-access on ProposedAction
    │   ├── executor.py              ✅ BUILT — HTTP 200/201 check (no raise_for_status)
    │   ├── audit_logger.py          ✅ BUILT — POST /api/audit/ingest, dot-access
    │   ├── models.py                ✅ BUILT — ProposedAction typed, IntentModel updated
    │   └── requirements.txt
    │
    ├── detection-engine/            ← SERVICE 3: Python/FastAPI :8002
    │   └── app/                     🟡 PARTIAL — 45-rule engine works, ML optional
    │
    ├── middleware/                  ← npm package: sentinel-middleware
    │   ├── package.json             ✅ BUILT — v1.0.0, publishable
    │   ├── README.md
    │   ├── src/
    │   │   ├── index.js             ✅ BUILT
    │   │   ├── config.js            ✅ BUILT — scrub, IP extract, validation
    │   │   ├── sender.js            ✅ BUILT — axios + retry queue + unref() ✅
    │   │   └── adapters/
    │   │       ├── express.js       ✅ BUILT
    │   │       └── fastify.js       ✅ BUILT
    │   └── tests/
    │       └── sentinel.test.js     ✅ 16/16 PASS
    │
    └── pcap-processor/              ← SERVICE 2: Python/FastAPI :8003
        └── [8 detectors, 10/10 tests pass] ✅ BUILT
```

---

## 3. Service Registry

| Service | Language | Port | Status | Entry Point |
|---------|----------|------|--------|-------------|
| **Gateway API** | Node.js + Express | 3000 | ✅ WORKING | `backend/server.js` |
| **PCAP Processor** | Python + FastAPI | 8003 | ✅ WORKING | `services/pcap-processor/main.py` |
| **Detection Engine** | Python + FastAPI | 8002 | 🟡 PARTIAL | `services/detection-engine/app/main.py` |
| **ArmorIQ Agent** | Python + FastAPI | 8004 | ✅ WORKING | `services/armoriq-agent/main.py` |
| **React Dashboard** | Vite + React | 5173 | ✅ WORKING | `dashboard/src/main.jsx` |
| **sentinel-middleware** | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| **Demo Target** | Node.js + Express | 4000 | ✅ WORKING | `demo-target/server.js` |
| **MongoDB** | Atlas cloud | 27017 | ✅ WORKING | configured in `.env` |

### Start Commands (Demo Day)

```bash
# Terminal 1 — MongoDB (if local)
mongod

# Terminal 2 — Gateway
cd backend && npm run dev

# Terminal 3 — Detection Engine
cd services/detection-engine
source venv/bin/activate
uvicorn app.main:app --port 8002

# Terminal 4 — ArmorIQ Agent
cd services/armoriq-agent
uvicorn main:app --port 8004 --reload

# Terminal 5 — Demo Target
cd demo-target && node server.js

# Terminal 6 — Dashboard
cd dashboard && npm run dev
# Open: http://localhost:5173

# Fire attacks (demo presentation)
bash demo-target/attack.sh
```

---

## 4. Complete Request Lifecycle

### Flow A — Live Request via Middleware (Normal Operation)

```
1.  User hits developer's app  →  Express/Fastify handles request normally
2.  res.on('finish') fires     →  sentinel-middleware captures payload
3.  POST /api/logs/ingest      →  Gateway validates (Joi) + saves SystemLog
4.  setImmediate(() =>)        →  non-blocking detection pipeline starts
5.  detectionConnector         →  POST :8002/analyze (circuit breaker: 30s reset)
6.  Detection Engine returns   →  { threat_detected, threat_type, severity,
                                     confidence, explanation, ... }
7a. IF threat_detected = false →  stop. No further action.
7b. IF threat_detected = true:
    AttackEvent.create()       →  saved to MongoDB
    emitter.emit(attack:new)   →  Dashboard LiveAttackFeed updates
    IF severity high/critical:
      Alert.create()           →  type: 'attack_detected'
      emitter.emit(alert:new)  →  Navbar badge increments
    callArmorIQ() [async]      →  POST :8004/respond
8.  ArmorIQ evaluates 6 intents (each a ProposedAction):
    ALLOWED → executor.py fires:
      send_alert  →  POST /api/alerts/armoriq → Alert.create(armoriq_action)
                  →  emitter.emit(alert:new)
      log_attack / rate_limit_ip / flag_for_review / generate_report
                  →  acknowledged + audit_logger called
    Each intent → audit_logger.py → POST /api/audit/ingest
                → AuditLog.create() → emitter.emit(EVENTS.AUDIT_NEW)
                → Socket.io broadcasts audit:new → Dashboard AuditLog live
    BLOCKED → for each blocked action:
      ActionQueue.create()     →  status: 'pending'
      emitter.emit(action:pending) →  Dashboard queue badge increments
      audit_logger.py          →  AuditLog entry status: 'BLOCKED'
9.  Human visits /action-queue:
    APPROVE → POST /api/actions/:id/approve
              AuditLog entry: status 'APPROVED', policy_rule_id 'HUMAN_OVERRIDE'
    REJECT  → POST /api/actions/:id/reject
              AuditLog entry: status 'REJECTED', policy_rule_id 'HUMAN_OVERRIDE'
    Both emit emitter(audit:new) → Dashboard AuditLog updates live
```

### Flow B — PCAP Upload (Offline Analysis)

```
1.  Analyst uploads .pcap at /pcap page
2.  POST /api/pcap/upload (multipart) →  saved to /tmp/sentinal-uploads/<uuid>
3.  Gateway → POST :8003/process (filepath + projectId)
4.  PCAP Processor pipeline:
    pcap_loader → packet_parser → flow_builder → attack_detector
    Returns: local_attacks[] + engine_attacks[] (v2 schema)
5.  Gateway merges both lists → AttackEvent.create() per attack
6.  Each attack → emitter.emit(attack:new) → Dashboard feed
7.  Response to UI:
    { total_packets, parsed_packets, total_flows, processing_time_s,
      local_attacks_found, engine_attacks_found, attacks_saved, skipped_engine }
```

### Flow C — Direct ArmorIQ Trigger (Demo / Testing)

```
1.  POST /api/armoriq/trigger { ip, attackType, severity, confidence, status }
2.  Gateway creates SystemLog (projectId: 'armoriq-demo')
3.  attackService.reportAttack() → AttackEvent + Alert + callArmorIQ()
4.  Same as Flow A steps 8–9
    Response: { attackId, logId, ip, attackType, severity, confidence, note }
```

### Flow D — Demo Target (E2E Attack Simulation)

```
1.  Attacker/tester sends attack payload to demo-target :4000
    e.g. GET /search?q='+UNION+SELECT -- or POST /login with XSS body
2.  Demo target responds normally (intentionally vulnerable)
3.  sentinel-middleware fires res.on('finish') async
4.  POST :3000/api/logs/ingest  →  full pipeline as Flow A above
5.  Attack appears in Dashboard within ~2–4 seconds
    attack:new → LiveAttackFeed
    action:pending → ActionQueue badge
    audit:new → AuditLog panel
```

---

## 5. API Contracts — Every Route

### Gateway API (`:3000`)

All responses use the standard envelope (§12). `data` field holds the payload.

> ⚠️ `GET /api/health` returns `{ success: false, code: 'NOT_FOUND' }` — this route
> is not registered. Use `GET /api/service-status` to check gateway liveness or
> add a `/health` route manually if needed.

#### Logs
```
POST /api/logs/ingest
Body: {
  projectId:        string   (required)
  method:           string   GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD
  url:              string   (required)
  ip:               string   (required)
  queryParams:      object   (default: {})
  body:             object   (default: {})
  headers:          object   (default: {})
  responseCode:     number   100–599 | null
  processingTimeMs: number   (default: 0)
}
Response 201: { success: true, data: { id: ObjectId } }
```

#### Attacks
```
GET  /api/attacks/recent?limit=50
Response: { success: true, data: AttackEvent[] }

GET  /api/attacks/:id/forensics
Response data: {
  attack:      AttackEventShape,
  raw_request: SystemLogShape | null,
  ip_intel: {
    ip, total_requests_24h, total_attacks_ever,
    first_attack, last_attack, attack_types_seen
  },
  attack_chain: {
    timeline:      { time, method, url, code }[],
    pattern_label: string,
    all_attacks:   AttackEvent[]
  }
}
```

#### Alerts
```
GET   /api/alerts?limit=50          →  { success: true, data: Alert[] }
PATCH /api/alerts/:id/read          →  { success: true, data: { id, read: true } }
POST  /api/alerts/armoriq           →  called by ArmorIQ executor only
  Body: { attackId, ip, attackType, severity, message, source }
  Response 201: { success: true, data: { id: ObjectId } }
```

#### ArmorIQ Actions
```
GET  /api/actions/pending
  Response: { success: true, data: ActionQueue[] }

POST /api/actions/:id/approve
  Body: { approvedBy: string }
  Response: { success: true, message: 'Action approved',
              data: { _id, action, status: 'approved', approvedBy, approvedAt, ... } }

POST /api/actions/:id/reject
  Body: { rejectedBy: string }
  Response: { success: true, message: 'Action rejected',
              data: { _id, action, status: 'rejected', rejectedBy, rejectedAt, ... } }
```

#### Audit Log
```
GET  /api/audit?limit=100
  Response: { success: true, data: AuditLog[] }  (sorted createdAt desc)

POST /api/audit/ingest  (called by ArmorIQ audit_logger.py — not for direct use)
  Body: {
    intent_id?:         string
    action:             string  (required)
    status:             string  ALLOWED|BLOCKED|APPROVED|REJECTED (required)
    reason?:            string
    policy_rule_id?:    string
    enforcement_level?: string
    triggeredBy?:       string  (default: 'agent')
    ip?:                string
    attackId?:          string
    meta?:              object
  }
  Response 201: { success: true, data: { id: ObjectId } }
  Side effect: emits EVENTS.AUDIT_NEW via Socket.io
```

#### ArmorIQ Trigger (Demo)
```
POST /api/armoriq/trigger
Body: {
  ip:         string  (default: '10.0.0.1')
  attackType: string  sqli|xss|traversal|command_injection|ssrf|lfi_rfi|
                      brute_force|hpp|xxe|webshell|unknown
  severity:   string  low|medium|high|critical (default: 'critical')
  confidence: number  0.0–1.0 (default: 0.97)
  status:     string  attempt|successful|blocked (default: 'successful')
}
Response 201: { success: true, data: { attackId, logId, ip, attackType, severity, confidence, note } }
```

#### PCAP Upload
```
POST /api/pcap/upload
Body: multipart/form-data
  Field "pcap":      File (.pcap or .pcapng, max 500MB)
  Field "projectId": string (optional, default: 'pcap-upload')
Response data (v2 schema):
  { total_packets, parsed_packets, total_flows, processing_time_s,
    local_attacks_found, engine_attacks_found, attacks_saved, skipped_engine }
```

#### Stats
```
GET /api/stats
Response data: {
  totalRequests, totalAttacks, criticalAlerts, servicesOnline,
  attacksByType: { [attackType]: number },
  recentTimeline: { time: ISODate, count: number }[]
}
```

#### Other
```
GET /api/service-status  →  { service, status, responseTimeMs, error? }[]
GET /api/logs/recent?limit=50  →  SystemLog[]
```

### ArmorIQ Agent (`:8004`)
```
POST /respond
Body: { attackId, ip, attackType, severity, status, confidence }
Response: {
  actionsExecuted: string[],
  actionsQueued: [
    { action, agentReason, blockedReason }
  ]
}

GET /health  →  { status: 'ok', service: 'armoriq-agent', version, enforcement }
```

### PCAP Processor (`:8003`)
```
POST /process
Body: { filepath: string, projectId: string }
Response (v2 schema): { filepath, total_packets, parsed_packets, total_flows,
  http_requests_sent, processing_time_s,
  local_attacks: [{ attack_type, severity, src_ip, dst_ip, description, evidence }],
  engine_attacks: [{ threat_detected, threat_type, severity, confidence, ip, url, responseCode }],
  skipped_engine: number }

GET /health  →  { status: 'ok' }
```

### Detection Engine (`:8002`)
```
POST /analyze
Body: { logId, projectId, method, url, ip, queryParams, body, headers, responseCode }
Response (attack):
  { threat_detected: true, threat_type, severity, status, detectedBy,
    confidence, payload, explanation: { headline, what_happened, damage, fix } | null,
    mitigationSuggestion }
Response (clean): { threat_detected: false }

GET /health  →  { status: 'ok', model_loaded: boolean }
```

---

## 6. User Flows

### Flow 1 — Dashboard
```
/dashboard
  ├── StatsPanel         polls GET /api/stats every 30s
  ├── ServiceStatusBar   polls GET /api/service-status every 15s
  ├── LiveAttackFeed     socket.on('attack:new') — new row slides in
  └── Charts             attacksByType + recentTimeline (P1)
```

### Flow 2 — Alerts Page
```
/alerts
  GET /api/alerts?limit=200
  Filters: severity | type (armoriq_action/attack_detected) | read/unread
  Row styling: armoriq_action = purple; read = 50% opacity
  Live: socket.on('alert:new') prepends row; Navbar badge increments
  Mark All Read: PATCH /api/alerts/:id/read for all unread
```

### Flow 3 — Action Queue
```
/action-queue
  GET /api/actions/pending
  Card: risk badge | action | attackType | severity | IP | reasons | View Attack link
  Approve → POST /api/actions/:id/approve → AuditLog APPROVED + card fades out
  Reject  → POST /api/actions/:id/reject  → AuditLog REJECTED + card fades out
  Live: socket.on('action:pending') prepends card; Navbar badge increments
```

### Flow 4 — Audit Log
```
/audit
  GET /api/audit?limit=200  (auto-refresh every 10s)
  Live: socket.on('audit:new') prepends row in real time ✅
  Stat bar (clickable filters): ALLOWED:N | BLOCKED:N | APPROVED:N | REJECTED:N
  Action filter dropdown: all 8 action types
  Table: Timestamp | Action | Status badge | Policy Rule | IP | Triggered By | Reason
  Triggered By 'human' shown in blue bold
```

### Flow 5 — PCAP Analyzer
```
/pcap  — drag-drop .pcap → POST /api/pcap/upload → 5 stat cards + attack feed
```

### Flow 6 — Forensics
```
/attacks/:id → GET /api/attacks/:id/forensics
  Shows: attack summary | raw HTTP request | IP intel | attack chain timeline
```

### Flow 7 — Services Health
```
/services → GET /api/service-status
  Services monitored: gateway (3000) | detection-engine (8002) |
                      pcap-processor (8003) | armoriq-agent (8004)
```

---

## 7. MongoDB Schema — All 6 Collections

### `systemlogs`
```js
{
  _id:              ObjectId,
  projectId:        String,
  timestamp:        Date,
  method:           String,
  url:              String,
  queryParams:      Object,
  body:             Object,
  headers:          { userAgent, contentType, referer },
  ip:               String,
  responseCode:     Number | null,
  processingTimeMs: Number
}
```

### `attackevents`
```js
{
  _id:                  ObjectId,
  requestId:            ObjectId,   // ref → systemlogs._id
  timestamp:            Date,
  ip:                   String,
  attackType:           String,     // see §8 enum
  severity:             String,     // low|medium|high|critical
  status:               String,     // attempt|successful|blocked
  detectedBy:           String,     // rule|ml|both
  confidence:           Number,
  payload:              String,
  explanation:          String,     // JSON stringified
  mitigationSuggestion: String,
  responseCode:         Number | null
}
```

### `alerts`
```js
{
  _id:        ObjectId,
  attackId:   ObjectId,             // ref → attackevents._id (required)
  title:      String,
  message:    String,
  severity:   String,               // low|medium|high|critical
  type:       String,               // attack_detected|armoriq_action|service_down|rate_limit|anomaly
  isRead:     Boolean,              // default: false
  resolvedAt: Date | null,
  meta:       Object,
  createdAt:  Date
}
```

### `action_queue`
```js
{
  _id:           ObjectId,
  attackId:      ObjectId,          // ref → attackevents._id
  action:        String,            // permanent_ban_ip|shutdown_endpoint|
                                    //   purge_all_sessions|modify_firewall_rules
  status:        String,            // pending|approved|rejected
  agentReason:   String,
  blockedReason: String,
  ip:            String,
  approvedBy:    String | null,
  approvedAt:    Date | null,
  rejectedBy:    String | null,
  rejectedAt:    Date | null,
  createdAt:     Date
}
```

### `audit_logs`
```js
{
  _id:               ObjectId,
  intent_id:         String | null,   // UUID from ArmorIQ IntentModel
  action:            String,          // one of the 9 ArmorIQ actions
  status:            String,          // ALLOWED|BLOCKED|APPROVED|REJECTED
  triggeredBy:       String,          // 'agent'|'human'
  ip:                String,
  attackId:          String | null,   // stored as string (ObjectId ref)
  policy_rule_id:    String,          // RULE_001..RULE_004|RULE_DEFAULT|HUMAN_OVERRIDE
  enforcement_level: String,          // default: 'ArmorIQ-Policy-v1'
  reason:            String,
  meta:              Object,          // e.g. { actionQueueId, attackType }
  createdAt:         Date
}
```

### `servicestatuses`
```js
{
  _id:            ObjectId,
  serviceName:    String,
  status:         String,            // online|offline
  lastChecked:    Date,
  responseTimeMs: Number,
  errorMessage:   String
}
```

> ⚠️ `ip_intelligence` collection is **not yet built** — planned P1.

---

## 8. Canonical Field Registry

### `attackType` enum

| Value | Meaning | Source |
|-------|---------|--------|
| `sqli` | SQL Injection | Detection Engine + PCAP |
| `xss` | Cross-Site Scripting | Detection Engine + PCAP |
| `traversal` | Path Traversal | Detection Engine |
| `command_injection` | Command Injection | Detection Engine |
| `ssrf` | SSRF | Detection Engine |
| `lfi_rfi` | LFI / RFI | Detection Engine |
| `brute_force` | Brute Force | Detection Engine + PCAP |
| `hpp` | HTTP Parameter Pollution | Detection Engine |
| `xxe` | XXE | Detection Engine |
| `webshell` | Webshell | Detection Engine |
| `recon` | Port Scan / Recon | PCAP only |
| `ddos` | DoS / DDoS / ICMP / DNS Amp | PCAP only |
| `unknown` | Unclassified | fallback |

### Alert `type` enum

| Value | When created |
|-------|-------------|
| `attack_detected` | Gateway `attackService.reportAttack()` for high/critical |
| `armoriq_action` | ArmorIQ executor `send_alert` action |
| `service_down` | Future |
| `rate_limit` | Future |
| `anomaly` | Future |

### ArmorIQ Action enum & Policy

| Action | Risk | Policy | Rule |
|--------|------|--------|------|
| `send_alert` | Low | ALLOW | RULE_004 |
| `log_attack` | Low | ALLOW | RULE_004 |
| `rate_limit_ip` | Low | ALLOW | RULE_004 |
| `flag_for_review` | Low | ALLOW | RULE_004 |
| `generate_report` | Low | ALLOW | RULE_004 |
| `permanent_ban_ip` | High | BLOCK | RULE_001 |
| `shutdown_endpoint` | Critical | BLOCK | RULE_001 |
| `purge_all_sessions` | Medium | BLOCK | RULE_001 |
| `modify_firewall_rules` | Critical | BLOCK | RULE_001 |

### `policy_rule_id` enum

| Value | Meaning |
|-------|--------|
| `RULE_001` | Action is in BLOCKED_ACTIONS set |
| `RULE_002` | risk_level == 'critical' |
| `RULE_003` | risk_level == 'high' |
| `RULE_004` | Action is in ALLOWED_ACTIONS set |
| `RULE_DEFAULT` | No rule matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | Human approved or rejected via Dashboard |

### Detection Engine `threat_type` → `attackType` mapping

| Detection Engine label | Gateway `attackType` |
|------------------------|---------------------|
| `SQL Injection` | `sqli` |
| `XSS` | `xss` |
| `Path Traversal` | `traversal` |
| `Command Injection` | `command_injection` |
| `SSRF` | `ssrf` |
| `LFI/RFI` | `lfi_rfi` |
| `Brute Force` | `brute_force` |
| `HTTP Parameter Pollution` | `hpp` |
| `XXE` | `xxe` |
| `Webshell` | `webshell` |

---

## 9. Build Status — v3.0

### ✅ COMPLETE & TESTED

| Feature | File(s) | Test Evidence |
|---------|---------|---------------|
| Gateway API — all routes | `backend/src/routes/` (11 files) | E2E verified |
| MongoDB — 6 models | `backend/src/models/` | 20+ attack events saved |
| Socket.io — 6 events incl. audit:new | `broadcastService.js` | Live dashboard updates confirmed |
| Log ingest → Detection Engine | `logService.js` + `detectionConnector.js` | sqli, xss, traversal, command_injection classified |
| Attack persistence + alert auto-create | `attackService.js` | Attacks saved: 20 confirmed |
| Forensics endpoint | `forensicsController.js` | ✅ |
| Stats + Service Health | `statsService.js` | ✅ |
| PCAP route v2 | `backend/src/routes/pcap.js` | ✅ |
| PCAP Processor (8 detectors, 10/10) | `services/pcap-processor/` | ✅ |
| ArmorIQ Agent — full pipeline | `services/armoriq-agent/` | 6 intents/attack verified |
| ProposedAction typed Pydantic model | `models.py` | ✅ Fix 1 applied |
| policy_engine.py dot-access | `policy_engine.py` | ✅ Fix 1 applied |
| executor.py safe HTTP check | `executor.py` | ✅ Fix 2: 200/201 check, no raise_for_status |
| audit_logger.py dot-access | `audit_logger.py` | ✅ Fix 1 applied |
| AUDIT_NEW socket event | `broadcastService.js` + `auditController.js` | ✅ Fix 3 applied |
| Action Queue — model + routes + UI | `ActionQueue.js` + `routes/actions.js` | approve/reject E2E tested |
| Audit Log — model + route + UI | `AuditLog.js` + `routes/audit.js` | ALLOWED/BLOCKED/APPROVED/REJECTED all confirmed |
| Alert type enum fix (armoriq_action) | `Alert.js` | ✅ |
| ArmorIQ trigger route | `routes/armoriq.js` | E2E tested — critical attack: 6 intents |
| Human override (approve/reject) | `actionQueueController.js` | shutdown_endpoint APPROVED, permanent_ban_ip REJECTED ✅ |
| React Dashboard — all pages | `dashboard/src/pages/` | ✅ |
| Navbar live badges | `Navbar.jsx` | ✅ |
| AuditLog filters + stat bar | `AuditLog.jsx` | ✅ |
| sentinel-middleware npm package | `services/middleware/` | 16/16 Jest tests pass |
| Demo Target server | `demo-target/server.js` | Attacks received and processed ✅ |
| E2E attack script | `demo-target/attack.sh` | 7/7 scenarios pass |
| ArmorIQ resilience (Gateway survives agent down) | `attackService.js` fire-and-forget | Attacks saved: 20 with ArmorIQ killed ✅ |

### 🟡 PARTIAL

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Detection Engine | FastAPI, 45-rule engine, adversarial decoder | `sentinel_v5.pkl` ML model; `explainer.py` (needs OPENAI_API_KEY) |
| Dashboard Charts | StatsPanel component | Recharts donut + timeline not wired to live `/api/stats` |

### 🔲 NOT BUILT

| Feature | Priority |
|---------|----------|
| ML model `sentinel_v5.pkl` | P0 |
| Dashboard Charts (donut + timeline) | P1 |
| Threat Intelligence (`GET /api/intel/:ip`, AbuseIPDB) | P1 |
| Export CSV/JSON | P2 |
| Settings page | P2 |

---

## 10. Port & URL Map

| Service | Port | Base URL | Start Command |
|---------|------|----------|---------------|
| Gateway API | 3000 | `http://localhost:3000` | `cd backend && npm run dev` |
| Detection Engine | 8002 | `http://localhost:8002` | `uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `http://localhost:8003` | `uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `http://localhost:8004` | `uvicorn main:app --port 8004` |
| React Dashboard | 5173 | `http://localhost:5173` | `cd dashboard && npm run dev` |
| Demo Target | 4000 | `http://localhost:4000` | `cd demo-target && node server.js` |
| MongoDB | 27017 | Atlas cloud | configured in `.env` |

### Environment Variables (`backend/.env`)
```env
NODE_ENV=development
PORT=3000
MONGO_URI=<your Atlas URI>
DETECTION_ENGINE_URL=http://localhost:8002
PCAP_SERVICE_URL=http://localhost:8003
ARMORIQ_URL=http://localhost:8004
```

### sentinel-middleware Options
```js
sentinel({
  projectId:   'my-app',                    // required
  gatewayUrl:  'http://localhost:3000',      // required
  apiKey:      '',                           // optional — sent as X-Sentinel-Key
  sampleRate:  1.0,                          // 0.0–1.0
  debug:       false,                        // console log each ingest
  timeout:     3000,                         // ms
  maxBodySize: 4096,                         // bytes
  ignoreRoutes: ['/health', '/favicon.ico'], // skip these paths
  ignoreIPs:   [],                           // skip these IPs
  onError:     (err) => {}                   // custom error handler
})
```

---

## 11. Socket.io Events Reference

### `attack:new`
```js
{ id, ip, attackType, severity, status, detectedBy, confidence, timestamp }
```

### `alert:new`
```js
{ id, title, severity, type, timestamp }  // type: attack_detected|armoriq_action
```

### `action:pending`
```js
{ id, action, agentReason, blockedReason, ip, attackId }
```

### `audit:new`  ← added Fix 3
```js
{
  id:             string,   // AuditLog._id
  action:         string,
  status:         string,   // ALLOWED|BLOCKED|APPROVED|REJECTED
  reason:         string,
  policy_rule_id: string,
  triggeredBy:    string,
  ip:             string,
  attackId:       string | null,
  timestamp:      ISODate
}
```

### `service:status`
```js
{ serviceName, status, responseTimeMs, timestamp }
```

---

## 12. Response Envelope Standard

```js
// Success
{ success: true,  message: string, data: object | array }

// Error
{ success: false, message: string, code: 'NOT_FOUND'|'SERVER_ERROR'|'VALIDATION_ERROR' }
```

**Frontend usage:** `api.js` uses `unwrap = res => res.data.data`.
Always access payload as `response.data.data` — never `response.data` directly.

> ⚠️ **Common mistake:** `GET /api/attacks/recent` returns `{ success, data: [] }` —
> NOT a bare array. Use `r.data.length` not `r.length`.

---

## 13. Demo Target & E2E Test Guide

### What Is `demo-target`?

A real Express.js application at `demo-target/server.js` that uses `sentinel-middleware`
from the local package at `services/middleware/src/adapters/express.js`.
It provides intentionally vulnerable routes for demo and testing:

| Route | Attack Surface |
|-------|---------------|
| `GET /search?q=` | SQL injection, XSS via query param |
| `POST /login` body | XSS, brute force |
| `GET /file?name=` | Path traversal |
| `GET /users` | Normal (baseline) |
| `GET /` | Health check |

### E2E Test Scenario Results (2026-03-26)

All tests run against live stack: Gateway :3000 + Detection Engine :8002 +
ArmorIQ :8004 + Demo Target :4000.

| # | Attack | Via | Result | Audit Entries |
|---|--------|-----|--------|---------------|
| 1 | SQL Injection `1' OR '1'='1` | demo-target /search | ✅ Detected, pipeline fired | ALLOWED × 3 |
| 2 | XSS `<script>alert(1)</script>` | demo-target /login | ✅ Detected, send_alert executed | ALLOWED × 3 |
| 3 | Path Traversal `../../etc/passwd` | demo-target /file | ✅ Detected, permanent_ban_ip queued | BLOCKED pending |
| 4 | Critical trigger (command_injection) | POST /api/armoriq/trigger | ✅ 6 intents: ALLOW×4, BLOCK×2 | 6 entries |
| 5 | Human Approve | Dashboard ActionQueue | ✅ shutdown_endpoint APPROVED | HUMAN_OVERRIDE |
| 6 | Human Reject | Dashboard ActionQueue | ✅ permanent_ban_ip REJECTED | HUMAN_OVERRIDE |
| 7 | ArmorIQ killed mid-test | demo-target /search | ✅ Gateway survived, Attacks saved: 20 | — |

### Verify Pipeline Health
```bash
# All services alive
curl http://localhost:3000/api/service-status
curl http://localhost:8002/health
curl http://localhost:8004/health
curl http://localhost:4000/

# Recent audit log (use .data not bare array)
curl -s http://localhost:3000/api/audit?limit=5 | \
  node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  r.data.forEach(e=>console.log(e.action.padEnd(22),e.status,e.policy_rule_id))"

# Pending blocked actions
curl -s http://localhost:3000/api/actions/pending | \
  node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  console.log(r.data.map(a=>a.action+' '+a.status))"

# Attacks saved count
curl -s http://localhost:3000/api/attacks/recent | \
  node -e "const r=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); \
  console.log('Attacks saved:', r.data.length)"
```

### Demo Day Attack Command
```bash
bash demo-target/attack.sh
# Then open: http://localhost:5173
# Watch: LiveAttackFeed | ActionQueue badge | AuditLog | Alerts
```

---

## 14. Changelog

| Date | Version | Change | File(s) |
|------|---------|--------|---------|
| 2026-03-26 | 1.0 | Initial doc | `MASTER_REFERENCE.md` |
| 2026-03-26 | 1.0 | PCAP Processor built — 8 detectors | `services/pcap-processor/` |
| 2026-03-26 | 1.0 | PCAP route fixed — port 8003, v2 schema | `backend/src/routes/pcap.js` |
| 2026-03-26 | 1.0 | Service health fixed — ports corrected | `serviceHealthService.js` |
| 2026-03-26 | 2.0 | ArmorIQ Agent built — full pipeline | `services/armoriq-agent/` |
| 2026-03-26 | 2.0 | ActionQueue model + routes + UI | `ActionQueue.js`, `routes/actions.js` |
| 2026-03-26 | 2.0 | AuditLog model + route + UI | `AuditLog.js`, `routes/audit.js` |
| 2026-03-26 | 2.0 | Alert type enum fix (armoriq_action) | `Alert.js` |
| 2026-03-26 | 2.0 | ArmorIQ trigger route | `routes/armoriq.js` |
| 2026-03-26 | 2.0 | UI Polish — Navbar badges, Alerts, AuditLog | `Navbar.jsx`, `Alerts.jsx`, `AuditLog.jsx` |
| 2026-03-26 | 2.0 | sentinel-middleware — 16/16 Jest tests | `services/middleware/` |
| 2026-03-26 | 3.0 | **Fix 1** — ProposedAction typed Pydantic; dot-access in policy_engine, intent_builder, audit_logger, main | `models.py`, `policy_engine.py`, `intent_builder.py`, `audit_logger.py`, `main.py` |
| 2026-03-26 | 3.0 | **Fix 2** — executor.py: safe HTTP 200/201 check, no raise_for_status | `executor.py` |
| 2026-03-26 | 3.0 | **Fix 3** — AUDIT_NEW socket event; emitter in auditController after create | `broadcastService.js`, `auditController.js` |
| 2026-03-26 | 3.0 | Demo Target server + attack.sh — 7 E2E scenarios | `demo-target/` |
| 2026-03-26 | 3.0 | MASTER_REFERENCE rewritten — v3.0, accurate to live repo | `MASTER_REFERENCE.md` |
