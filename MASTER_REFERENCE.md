# SENTINAL — Master Reference Document

> **Version:** 2.0 · **Date:** 2026-03-26 · **Status:** Living document — update on every merge
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
9. [Build Status — v2.0](#9-build-status)
10. [Port & URL Map](#10-port-map)
11. [Socket.io Events Reference](#11-socketio-events)
12. [Response Envelope Standard](#12-response-envelope)
13. [Changelog](#13-changelog)

---

## 1. System Architecture Overview

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER'S APPLICATION                              │
│                                                                             │
│   const { sentinel } = require('sentinel-middleware');                      │
│   app.use(sentinel({ projectId: 'my-app', gatewayUrl: 'http://...:3000' })) │
└──────────────────────────────┬──────────────────────────────────────────────┘
                               │ POST /api/logs/ingest
                               │ (async, fires after response — zero latency)
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
│         └── BLOCKED actions → ActionQueue.create() → Socket.io action:pending│
└──────┬──────────────────────────┬──────────────────────────┬────────────────┘
       │                          │                          │
       ▼                          ▼                          ▼
┌──────────────┐      ┌───────────────────────┐   ┌─────────────────────────┐
│  SERVICE 2   │      │      SERVICE 3         │   │      SERVICE 4          │
│  PCAP        │      │   DETECTION ENGINE     │   │   ARMORIQ AGENT         │
│  PROCESSOR   │      │   (Python/FastAPI :8002)│   │   (Python/FastAPI :8004)│
│  (:8003)     │      │                       │   │                         │
│              │      │  POST /analyze         │   │  POST /respond          │
│  POST        │      │  Layer 1: Rules (45)   │   │                         │
│  /process    │      │  Layer 2: ML 🔲        │   │  intent_builder.py      │
│              │      │  Layer 3: Adversarial  │   │  policy_engine.py       │
│  8 detectors │      │  Layer 4: HTTP status  │   │  executor.py            │
│  used from   │      │  Layer 5: LLM explain  │   │  audit_logger.py        │
│  /pcap page  │      │                       │   │                         │
└──────────────┘      └───────────────────────┘   └─────────────────────────┘
                                                             │
                                    ┌────────────────────────┴──────────────┐
                                    │      ALLOWED actions                  │
                                    │  send_alert → POST /api/alerts/armoriq│
                                    │  log_attack → acknowledged            │
                                    │  rate_limit_ip → logged               │
                                    │  flag_for_review → logged             │
                                    │  generate_report → logged             │
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
       │
  policy_engine.py   →  evaluates each intent against risk rules
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
  audit_logger.py              Socket.io → action:pending
  EVENTS.ALERT_NEW             Dashboard ActionQueue card
                               Human: APPROVE / REJECT
                               audit_log updated
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
│       │   ├── alertController.js       ← GET /alerts, PATCH read, POST /armoriq
│       │   ├── attackController.js
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
│       │   ├── detectionConnector.js    ✅ BUILT
│       │   ├── logService.js            ✅ BUILT
│       │   ├── serviceHealthService.js  ✅ BUILT
│       │   └── statsService.js         ✅ BUILT
│       ├── sockets/
│       │   └── broadcastService.js      ✅ BUILT — EVENTS enum + Socket.io emitter
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
├── scripts/
│   └── simulate_attack.sh               ✅ BUILT — fires 2 attacks, tests full pipeline
│
└── services/
    ├── armoriq-agent/               ← SERVICE 4: Python/FastAPI :8004
    │   ├── main.py                  ✅ BUILT — FastAPI app, POST /respond
    │   ├── intent_builder.py        ✅ BUILT — 6 intents per attack
    │   ├── policy_engine.py         ✅ BUILT — ALLOW/BLOCK per policy rules
    │   ├── executor.py              ✅ BUILT — executes ALLOWED actions
    │   ├── audit_logger.py          ✅ BUILT — writes to /api/audit
    │   ├── models.py                ✅ BUILT
    │   └── requirements.txt
    │
    ├── detection-engine/            ← SERVICE 3: Python/FastAPI :8002
    │   └── app/                     🟡 PARTIAL — rules only, no ML model yet
    │
    ├── middleware/                  ← npm package: sentinel-middleware
    │   ├── package.json             ✅ BUILT — v1.0.0, publishable
    │   ├── README.md
    │   ├── src/
    │   │   ├── index.js             ✅ BUILT
    │   │   ├── config.js            ✅ BUILT — scrub, IP extract, validation
    │   │   ├── sender.js            ✅ BUILT — axios + retry queue + unref()
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
| **Detection Engine** | Python + FastAPI | 8002 | 🟡 PARTIAL | `services/detection-engine/app/` |
| **ArmorIQ Agent** | Python + FastAPI | 8004 | ✅ WORKING | `services/armoriq-agent/main.py` |
| **React Dashboard** | Vite + React | 5173 | ✅ WORKING | `dashboard/src/main.jsx` |
| **sentinel-middleware** | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| **MongoDB** | Atlas cloud | 27017 | ✅ WORKING | configured in `.env` |

### Start Commands

```bash
# Terminal 1 — Gateway
cd backend && npm start

# Terminal 2 — Detection Engine
cd services/detection-engine && uvicorn app.main:app --port 8002

# Terminal 3 — PCAP Processor
cd services/pcap-processor && uvicorn main:app --port 8003

# Terminal 4 — ArmorIQ Agent
cd services/armoriq-agent && uvicorn main:app --port 8004

# Terminal 5 — Dashboard
cd dashboard && npm run dev

# Test full pipeline
bash scripts/simulate_attack.sh
```

---

## 4. Complete Request Lifecycle

### Flow A — Live Request via Middleware (Normal Operation)

```
1.  User hits developer's app  →  Express/Fastify handles request normally
2.  res.on('finish') fires     →  sentinel-middleware captures payload
3.  POST /api/logs/ingest      →  Gateway validates (Joi) + saves SystemLog
4.  setImmediate(() =>)        →  non-blocking detection pipeline starts
5.  detectionConnector         →  POST :8002/analyze
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
8.  ArmorIQ evaluates 6 intents:
    ALLOWED → executor.py fires:
      send_alert  →  POST /api/alerts/armoriq
                  →  Alert.create() type: 'armoriq_action'
                  →  emitter.emit(alert:new)
      log_attack / rate_limit_ip / flag_for_review → audit_log entry
    BLOCKED → for each blocked action:
      ActionQueue.create()     →  status: 'pending'
      emitter.emit(action:pending) →  Dashboard queue badge increments
      AuditLog entry           →  status: 'BLOCKED'
9.  Human visits /action-queue:
    APPROVE → POST /api/actions/:id/approve
              AuditLog entry status: 'APPROVED'
    REJECT  → POST /api/actions/:id/reject
              AuditLog entry status: 'REJECTED'
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
4.  Same as Flow A steps 8–9 above
    Response: { attackId, logId, ip, attackType, severity, confidence }
```

---

## 5. API Contracts — Every Route

### Gateway API (`:3000`)

All responses use the standard envelope (§12). `data` field holds the payload.

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
Response data: AttackEvent[]

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
GET   /api/alerts?limit=50          →  Alert[] (populated attackId)
PATCH /api/alerts/:id/read          →  { id, read: true }
POST  /api/alerts/armoriq           →  called by ArmorIQ executor only
  Body: { attackId, ip, attackType, severity, message, source }
  Response 201: { id: ObjectId }
```

#### ArmorIQ Actions
```
GET  /api/actions/pending           →  ActionQueue[] where status='pending'
POST /api/actions/:id/approve       →  { id, status: 'approved', approvedBy, approvedAt }
POST /api/actions/:id/reject        →  { id, status: 'rejected', rejectedBy, rejectedAt }
```

#### Audit Log
```
GET  /api/audit?limit=100           →  AuditLog[] sorted by createdAt desc
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
Response 201: { attackId, logId, ip, attackType, severity, confidence, note }
```

#### PCAP Upload
```
POST /api/pcap/upload
Body: multipart/form-data
  Field "pcap":      File (.pcap or .pcapng, max 500MB)
  Field "projectId": string (optional, default: 'pcap-upload')
Response data (v2 schema):
{
  total_packets, parsed_packets, total_flows, processing_time_s,
  local_attacks_found, engine_attacks_found, attacks_saved, skipped_engine
}
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
GET /api/health  →  { status: 'ok', uptime: number }
GET /api/attacks/:id/forensics  →  see above
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

GET /health  →  { status: 'ok' }
```

### PCAP Processor (`:8003`)
```
POST /process
Body: { filepath: string, projectId: string }
Response (v2 schema):
{
  filepath, total_packets, parsed_packets, total_flows,
  http_requests_sent, processing_time_s,
  local_attacks: [{ attack_type, severity, src_ip, dst_ip, description, evidence }],
  engine_attacks: [{ threat_detected, threat_type, severity, confidence, ip, url, responseCode }],
  skipped_engine: number
}

GET /health  →  { status: 'ok' }
```

### Detection Engine (`:8002`)
```
POST /analyze
Body: { logId, projectId, method, url, ip, queryParams, body, headers, responseCode }
Response (attack):
{
  threat_detected: true,
  threat_type:     string,  // human label — see §8 for mapping
  severity:        string,  // 'low'|'medium'|'high'|'critical'
  status:          string,  // 'attempt'|'successful'|'blocked'
  detectedBy:      string,  // 'rule'|'ml'|'both'
  confidence:      number,
  payload:         string,
  explanation: { headline, what_happened, damage, fix } | null,
  mitigationSuggestion: string
}
Response (clean): { threat_detected: false }

GET /health  →  { status: 'ok', model_loaded: boolean }
```

---

## 6. User Flows

### Flow 1 — Dashboard
```
/dashboard
  ├── StatsPanel         polls GET /api/stats every 30s
  │     totalRequests | totalAttacks | criticalAlerts | servicesOnline
  ├── ServiceStatusBar   polls GET /api/service-status every 15s
  │     ● gateway ● detection-engine ● pcap-processor ● armoriq-agent
  ├── LiveAttackFeed     socket.on('attack:new') — new row slides in
  │     filter: attackType | severity | status
  │     click row → /attacks/:id or inline forensics drawer
  ├── AttackDonutChart   from attacksByType in /api/stats  🔲 P1
  └── TimelineLineChart  from recentTimeline              🔲 P1
```

### Flow 2 — Alerts Page
```
/alerts
  GET /api/alerts?limit=200
  Filters: severity (critical/high/medium/low) | type (armoriq_action/attack_detected) | read/unread
  Table columns: Time | Severity chip | Title | Type badge | View Attack → | Read status | Mark Read
  Row styling: armoriq_action rows = purple background
               attack_detected rows = default dark
               read rows = 50% opacity
  Mark All Read button: PATCH /api/alerts/:id/read for all unread
  Live: socket.on('alert:new') prepends row
  Navbar badge: red pill showing unread count, live via socket
```

### Flow 3 — Action Queue
```
/action-queue
  GET /api/actions/pending
  Each card shows:
    Risk badge (CRITICAL RISK / HIGH RISK) | action name | attackType | severity
    Target IP | agentReason | blockedReason | View Attack → link | Queued timestamp
  Approve:
    Click ✅ Approve → confirm modal → POST /api/actions/:id/approve
    AuditLog entry: status APPROVED, triggeredBy: 'human'
    Card fades out with slide-right animation
  Reject:
    Click ❌ Reject → confirm modal → POST /api/actions/:id/reject
    AuditLog entry: status REJECTED, triggeredBy: 'human'
    Card fades out
  Live: socket.on('action:pending') prepends new card
  Navbar badge: orange pill showing pending count, live via socket
```

### Flow 4 — Audit Log
```
/audit
  GET /api/audit?limit=200
  Auto-refresh every 10 seconds
  Stat bar (clickable filters): ALLOWED:N | BLOCKED:N | APPROVED:N | REJECTED:N
  Action filter dropdown: all 8 action types
  Clear filters button
  Shows entry count + "auto-refreshes every 10s" caption
  Table: Timestamp | Action | Status badge | Policy Rule | IP | Triggered By | Reason
  Triggered By 'human' shown in blue bold
```

### Flow 5 — PCAP Analyzer
```
/pcap
  Drag-drop or select .pcap / .pcapng file
  Click Analyze → POST /api/pcap/upload
  Shows 5 stat cards:
    total_packets | local_attacks_found | engine_attacks_found
    attacks_saved | skipped_engine
  + processing_time_s + total_flows
  IF attacks found → red banner with count
  IF 0 attacks     → green "No threats detected"
  Attacks appear live in Dashboard feed via attack:new socket
```

### Flow 6 — Forensics
```
Click any attack row → /attacks/:id  (or ForensicsDrawer inline)
  GET /api/attacks/:id/forensics
  Shows:
    Attack summary: id | attackType | severity | confidence | status | detectedBy
    Raw HTTP request: method | url | ip | headers | body | queryParams | responseCode
    IP Intel: total_requests_24h | total_attacks_ever | first/last attack | types seen
    Attack chain: timeline { time, method, url, code } | pattern_label
```

### Flow 7 — Services Health
```
/services
  GET /api/service-status
  Per service: name | status (online/offline) | responseTimeMs | lastChecked
  Services: gateway (3000) | detection-engine (8002) | pcap-processor (8003) | armoriq-agent (8004)
```

---

## 7. MongoDB Schema — All 6 Collections

### `systemlogs`
```js
{
  _id:             ObjectId,
  projectId:       String,      // source app identifier
  timestamp:       Date,
  method:          String,      // GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD
  url:             String,
  queryParams:     Object,
  body:            Object,
  headers: {
    userAgent:     String,
    contentType:   String,
    referer:       String
  },
  ip:              String,
  responseCode:    Number | null,
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
  confidence:           Number,     // 0.0–1.0
  payload:              String,
  explanation:          String,     // JSON stringified
  mitigationSuggestion: String,
  responseCode:         Number | null
}
```

### `alerts`
```js
{
  _id:       ObjectId,
  attackId:  ObjectId,           // ref → attackevents._id  (required)
  title:     String,
  message:   String,
  severity:  String,             // low|medium|high|critical
  type:      String,             // attack_detected|armoriq_action|service_down|rate_limit|anomaly
  isRead:    Boolean,            // default: false
  resolvedAt: Date | null,
  meta:      Object,
  createdAt: Date
}
```

### `action_queue`
```js
{
  _id:           ObjectId,
  attackId:      ObjectId,       // ref → attackevents._id
  action:        String,         // permanent_ban_ip|shutdown_endpoint|
                                 // purge_all_sessions|modify_firewall_rules
  status:        String,         // pending|approved|rejected
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
  _id:           ObjectId,
  action:        String,         // one of the 8 ArmorIQ actions
  status:        String,         // ALLOWED|BLOCKED|APPROVED|REJECTED
  triggeredBy:   String,         // 'agent'|'human'
  ip:            String,
  attackId:      ObjectId | null,
  policy_rule_id: String,
  reason:        String,
  createdAt:     Date
}
```

### `servicestatuses`
```js
{
  _id:            ObjectId,
  serviceName:    String,
  status:         String,        // online|offline
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
| `service_down` | Future: service health alerts |
| `rate_limit` | Future: rate limiting alerts |
| `anomaly` | Future: anomaly detection |

### ActionQueue `action` enum

| Value | Risk Level | Auto or Blocked |
|-------|-----------|----------------|
| `send_alert` | Low | Auto (ALLOWED) |
| `log_attack` | Low | Auto (ALLOWED) |
| `rate_limit_ip` | Low | Auto (ALLOWED) |
| `flag_for_review` | Low | Auto (ALLOWED) |
| `generate_report` | Low | Auto (ALLOWED) |
| `permanent_ban_ip` | High | BLOCKED → human |
| `shutdown_endpoint` | Critical | BLOCKED → human |
| `purge_all_sessions` | Medium | BLOCKED → human |
| `modify_firewall_rules` | Critical | BLOCKED → human |

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
| `Typosquatting` | `unknown` |

### PCAP `attack_type` → `attackType` mapping

| PCAP value | Gateway `attackType` |
|-----------|---------------------|
| `PORT_SCAN` | `recon` |
| `SYN_FLOOD` | `ddos` |
| `DDOS` | `ddos` |
| `ICMP_FLOOD` | `ddos` |
| `DNS_AMPLIFICATION` | `ddos` |
| `SQL_INJECTION` | `sqli` |
| `XSS` | `xss` |
| `BRUTE_FORCE` | `brute_force` |

> PCAP severities are uppercase internally (`LOW/HIGH/CRITICAL`). Gateway `pcap.js` normalises to lowercase before saving.

---

## 9. Build Status — v2.0

### ✅ COMPLETE

| Feature | File(s) |
|---------|---------|
| Gateway API — all routes | `backend/src/routes/` (11 route files) |
| MongoDB — 6 models | `backend/src/models/` |
| Socket.io — all events | `backend/src/sockets/broadcastService.js` |
| Log ingest → Detection Engine | `logService.js` + `detectionConnector.js` |
| Attack persistence + alert auto-create | `attackService.js` |
| Forensics endpoint (3-query aggregation) | `forensicsController.js` |
| Stats + Service Health | `statsService.js` + `serviceHealthService.js` |
| PCAP route v2 | `backend/src/routes/pcap.js` |
| PCAP Processor (8 detectors, 10/10 tests) | `services/pcap-processor/` |
| ArmorIQ Agent — full pipeline | `services/armoriq-agent/` |
| Action Queue — model + routes + UI | `ActionQueue.js` + `routes/actions.js` + `ActionQueue.jsx` |
| Audit Log — model + route + UI | `AuditLog.js` + `routes/audit.js` + `AuditLog.jsx` |
| Alert type enum fix (`armoriq_action`) | `backend/src/models/Alert.js` |
| ArmorIQ Trigger route (demo) | `backend/src/routes/armoriq.js` |
| React Dashboard — all pages | `dashboard/src/pages/` |
| Navbar live badges (alerts + queue) | `Navbar.jsx` |
| Alerts page — full Tailwind redesign | `Alerts.jsx` |
| AuditLog — filters + stat bar + auto-refresh | `AuditLog.jsx` |
| ActionQueue — confirm modal + fade + attack link | `ActionQueue.jsx` |
| sentinel-middleware npm package | `services/middleware/` |
| simulate_attack.sh test script | `scripts/simulate_attack.sh` |

### 🟡 PARTIAL

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Detection Engine | FastAPI scaffold, 45-rule engine, Layer 3 adversarial decoder | `sentinel_v5.pkl` ML model, `explainer.py` (needs OPENAI_API_KEY) |
| Dashboard Charts | StatsPanel component exists | Recharts donut (`attacksByType`) + timeline not wired to live `/api/stats` data |

### 🔲 NOT BUILT

| Feature | Priority | Notes |
|---------|----------|-------|
| ML model `sentinel_v5.pkl` | P0 | Needs `adversarial_loop.py` training script + Random Forest classifier |
| Dashboard Charts (donut + timeline) | P1 | Wire existing StatsPanel to `/api/stats` |
| Threat Intelligence | P1 | `GET /api/intel/:ip`, AbuseIPDB + IPInfo, `ip_intelligence` MongoDB model, 24h TTL cache |
| Export CSV/JSON | P2 | Button in AttackTable |
| IP History Timeline | P2 | Component in ForensicsDrawer |
| Settings page | P2 | ProjectId + API key management |

---

## 10. Port & URL Map

| Service | Port | Base URL | Start Command |
|---------|------|----------|---------------|
| Gateway API | 3000 | `http://localhost:3000` | `cd backend && npm start` |
| Detection Engine | 8002 | `http://localhost:8002` | `cd services/detection-engine && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `http://localhost:8003` | `cd services/pcap-processor && uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `http://localhost:8004` | `cd services/armoriq-agent && uvicorn main:app --port 8004` |
| React Dashboard | 5173 | `http://localhost:5173` | `cd dashboard && npm run dev` |
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

### sentinel-middleware Environment Variables

```env
SENTINAL_PROJECT_ID=my-app
SENTINAL_GATEWAY_URL=http://localhost:3000
SENTINAL_API_KEY=          # optional
SENTINAL_SAMPLE_RATE=1.0   # 0.0–1.0
SENTINAL_DEBUG=false
```

---

## 11. Socket.io Events Reference

### `attack:new` — emitted after every AttackEvent created
```js
{
  id:         string,   // AttackEvent._id
  ip:         string,
  attackType: string,   // see §8 enum
  severity:   string,   // low|medium|high|critical
  status:     string,   // attempt|successful|blocked
  detectedBy: string,   // rule|ml|both
  confidence: number,   // 0.0–1.0
  timestamp:  ISODate
}
```

### `alert:new` — emitted after every Alert created (both types)
```js
{
  id:        string,    // Alert._id
  title:     string,
  severity:  string,
  type:      string,    // attack_detected | armoriq_action
  timestamp: ISODate
}
```

### `action:pending` — emitted after ArmorIQ queues a BLOCKED action
```js
{
  id:            string,   // ActionQueue._id
  action:        string,
  agentReason:   string,
  blockedReason: string,
  ip:            string,
  attackId:      string
}
```

---

## 12. Response Envelope Standard

```js
// Success
{ success: true,  message: string, data: object | array }

// Error
{ success: false, message: string, code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR' }
```

`api.js` in dashboard uses `unwrap = res => res.data.data` to strip the envelope.
Always access payload as `data.xyz` — never `res.data.xyz` directly from frontend.

---

## 13. Changelog

| Date | Version | Change | File(s) |
|------|---------|--------|---------|
| 2026-03-26 | 1.0 | Initial doc created | `MASTER_REFERENCE.md` |
| 2026-03-26 | 1.0 | PCAP Processor built — 8 detectors | `services/pcap-processor/` |
| 2026-03-26 | 1.0 | PCAP route fixed — port 8003, v2 schema | `backend/src/routes/pcap.js` |
| 2026-03-26 | 1.0 | Service health fixed — ports corrected | `serviceHealthService.js` |
| 2026-03-26 | 1.0 | PcapAnalyzer.jsx fixed — v2 schema | `dashboard/src/pages/PcapAnalyzer.jsx` |
| 2026-03-26 | 2.0 | ArmorIQ Agent built — full pipeline | `services/armoriq-agent/` |
| 2026-03-26 | 2.0 | ActionQueue model + routes + UI | `ActionQueue.js`, `routes/actions.js`, `ActionQueue.jsx` |
| 2026-03-26 | 2.0 | AuditLog model + routes + UI | `AuditLog.js`, `routes/audit.js`, `AuditLog.jsx` |
| 2026-03-26 | 2.0 | Alert type enum fix (`armoriq_action`) | `backend/src/models/Alert.js` |
| 2026-03-26 | 2.0 | ArmorIQ trigger route (demo) | `backend/src/routes/armoriq.js` |
| 2026-03-26 | 2.0 | UI Polish — Navbar badges, Alerts redesign, AuditLog filters | `Navbar.jsx`, `Alerts.jsx`, `AuditLog.jsx`, `ActionQueue.jsx` |
| 2026-03-26 | 2.0 | sentinel-middleware npm package — 16/16 tests | `services/middleware/` |
| 2026-03-26 | 2.0 | Master Reference rewritten — v2.0 | `MASTER_REFERENCE.md` |
