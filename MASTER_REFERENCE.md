# SENTINAL — Master Reference Document

> **Version:** 5.0 · **Date:** 2026-03-27 · **Status:** Living document — single source of truth
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
14. [Changelog](#14-changelog)
15. [MongoDB Atlas Track](#15-mongodb-atlas-track)

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
│  full pipeline │  │  HTTP-status layer    │  │  openclaw_runtime.py ←NEW│
│  10/10 tests ✅│  │  ML optional          │  │  policy_engine.py (fbck) │
└────────────────┘  └───────────────────────┘  │  executor.py             │
                                               │  audit_logger.py         │
                                               │  models.py               │
                                               │  policy.yaml ←NEW        │
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
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md              ← this file (only doc)
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
│       │   ├── actionQueueController.js  GET pending + approve + reject
│       │   ├── alertController.js        GET list + PATCH read + POST armoriq
│       │   ├── atlasSearchController.js  GET /search (Atlas $search) + GET /search/stats ($facet)
│       │   ├── attackController.js       GET recent + GET forensics
│       │   ├── auditController.js        POST ingest + GET list + emit audit:new
│       │   ├── forensicsController.js    3-query aggregation + IP history
│       │   ├── healthController.js
│       │   ├── logController.js          GET recent
│       │   ├── serviceStatusController.js
│       │   └── statsController.js
│       ├── middleware/
│       ├── models/
│       │   ├── ActionQueue.js       pending|approved|rejected + timestamps
│       │   ├── Alert.js             type enum: attack_detected|armoriq_action|...
│       │   ├── AttackEvent.js       full attack record
│       │   ├── AuditLog.js          ALLOWED|BLOCKED|APPROVED|REJECTED + rule
│       │   ├── ServiceStatus.js     online|offline + response time
│       │   └── SystemLog.js         raw HTTP log from middleware
│       ├── routes/
│       │   ├── actions.js           GET /pending, POST /:id/approve, POST /:id/reject
│       │   ├── alerts.js            GET /, PATCH /:id/read, POST /armoriq
│       │   ├── armoriq.js           POST /trigger (demo/test route)
│       │   ├── attacks.js           GET /recent, GET /:id/forensics, GET /search
│       │   ├── audit.js             POST /ingest, GET /
│       │   ├── forensics.js         GET /:id
│       │   ├── health.js            GET /
│       │   ├── logs.js              POST /ingest, GET /recent
│       │   ├── pcap.js              POST /upload (multipart, v2 schema)
│       │   ├── serviceStatus.js     GET /
│       │   └── stats.js             GET /
│       ├── services/
│       │   ├── attackService.js     reportAttack() → save + alert + callArmorIQ()
│       │   ├── detectionConnector.js POST :8002/analyze, circuit breaker 30s
│       │   ├── logService.js        ingest → detect → report
│       │   ├── serviceHealthService.js ping all 4 services
│       │   └── statsService.js      aggregate stats
│       ├── sockets/
│       │   └── broadcastService.js  EVENTS: attack:new|alert:new|service:status
│       │                            stats:update|action:pending|audit:new
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
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── ActionQueue.jsx      confirm modal, fade-out, attack link
│       │   ├── AlertsPanel.jsx
│       │   ├── AppLayout.jsx
│       │   ├── ForensicsDrawer.jsx
│       │   ├── LiveAttackFeed.jsx   socket.on(attack:new)
│       │   ├── Navbar.jsx           live badge counters (alerts + queue)
│       │   ├── StatsPanel.jsx
│       │   └── SystemStatus.jsx
│       ├── hooks/
│       │   ├── useApi.js
│       │   ├── useInterval.js
│       │   └── useSocket.js
│       ├── pages/
│       │   ├── ActionQueuePage.jsx  approve/reject pending blocked actions
│       │   ├── Alerts.jsx           type filter + mark-all-read
│       │   ├── Attacks.jsx          table + severity/type filters
│       │   ├── AuditLog.jsx         stat bar + filters + socket:audit:new live
│       │   ├── Dashboard.jsx        main overview
│       │   ├── Docs.jsx
│       │   ├── ForensicsPage.jsx    IP intel + chain timeline
│       │   ├── Landing.jsx
│       │   ├── Logs.jsx
│       │   ├── NotFound.jsx
│       │   ├── PcapAnalyzer.jsx     v2 schema, 5 stat cards
│       │   ├── Services.jsx         health ping all services
│       │   └── Settings.jsx
│       └── services/
│           ├── api.js               all API calls + unwrap helper
│           └── socket.js            Socket.io client
│
├── demo-target/                     E2E harness (Express :4000)
│   ├── server.js                    real Express app + sentinel-middleware
│   ├── attack.sh                    7 automated attack scenarios
│   └── package.json
│
├── scripts/
│   └── simulate_attack.sh
│
└── services/
    ├── armoriq-agent/               SERVICE 4: Python/FastAPI :8004
    │   ├── main.py                  FastAPI app: POST /respond + GET /health
    │   │                            _evaluate_with_fallback() wrapper
    │   ├── intent_builder.py        builds 5–6 ProposedAction intents per attack
    │   ├── openclaw_runtime.py      PRIMARY enforcer — loads policy.yaml
    │   │                            RULE_001→004 + RULE_DEFAULT, fail-safe BLOCK
    │   │                            raises RuntimeError on crash (triggers fallback)
    │   ├── policy_engine.py         FALLBACK enforcer — hardcoded rules
    │   │                            used only if openclaw_runtime crashes
    │   ├── executor.py              HTTP 200/201 check (no raise_for_status)
    │   │                            sends to Gateway endpoints
    │   ├── audit_logger.py          POST /api/audit/ingest per decision
    │   ├── models.py                ProposedAction (Pydantic typed), IntentModel,
    │   │                            DecisionModel, RespondRequest, RespondResponse
    │   ├── policy.yaml              declarative policy: allowed/blocked lists,
    │   │                            risk_rules, default_decision: BLOCK
    │   ├── requirements.txt         fastapi, uvicorn, httpx, pydantic, pyyaml,
    │   │                            python-dotenv, pytest, pytest-asyncio
    │   ├── .env.example
    │   ├── README.md
    │   └── tests/
    │       └── test_enforcement.py  7/7 tests pass ✅
    │
    ├── detection-engine/            SERVICE 3: Python/FastAPI :8002
    │   └── app/
    │       ├── main.py              FastAPI: POST /analyze + GET /health
    │       ├── rules.py             45 regex patterns, 11 attack types
    │       ├── adversarial.py       URL/double/HTML/unicode decode
    │       └── [classifier.py]      ML optional — needs sentinel_v5.pkl
    │
    ├── middleware/                  npm package: sentinel-middleware
    │   ├── package.json             v1.0.0
    │   ├── README.md
    │   ├── src/
    │   │   ├── index.js
    │   │   ├── config.js            scrub sensitive fields, IP extract
    │   │   ├── sender.js            axios + retry queue + unref()
    │   │   └── adapters/
    │   │       ├── express.js
    │   │       └── fastify.js
    │   └── tests/
    │       └── sentinel.test.js     16/16 Jest tests pass ✅
    │
    └── pcap-processor/              SERVICE 2: Python/FastAPI :8003
        ├── main.py                  FastAPI: POST /process + GET /health
        ├── pcap_loader.py
        ├── packet_parser.py         PacketMeta objects
        ├── flow_builder.py          5-tuple flows
        ├── attack_detector.py       8 detectors (see §8)
        ├── config.py
        ├── flow_builder.py
        ├── logger.py
        ├── requirements.txt
        ├── datasets/
        └── tests/
            ├── test_pcap_processor.py  10/10 pass ✅
            └── fixtures/               9 .pcap files
```

---

## 3. Service Registry

| Service | Language | Port | Status | Entry Point |
|---------|----------|------|--------|-------------|
| Gateway API | Node.js + Express | 3000 | ✅ WORKING | `backend/server.js` |
| PCAP Processor | Python + FastAPI | 8003 | ✅ WORKING | `services/pcap-processor/main.py` |
| Detection Engine | Python + FastAPI | 8002 | 🟡 PARTIAL | `services/detection-engine/app/main.py` |
| ArmorIQ Agent | Python + FastAPI | 8004 | ✅ WORKING | `services/armoriq-agent/main.py` |
| React Dashboard | Vite + React | 5173 | ✅ WORKING | `dashboard/src/main.jsx` |
| sentinel-middleware | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| Demo Target | Node.js + Express | 4000 | ✅ WORKING | `demo-target/server.js` |
| MongoDB Atlas | Cloud (SRV) | — | ✅ WORKING | `backend/src/config/database.js` |

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
Response: {
  success:   true,
  query:     string,
  page:      number,
  limit:     number,
  count:     number,
  latencyMs: number,
  source:    'atlas_search' | 'regex_fallback',
  results:   AttackEvent[]  // each includes score: number (Lucene relevance)
}
// source='atlas_search' confirms real Atlas $search is active
// Falls back to $regex automatically if search index not yet provisioned

GET /api/attacks/search/stats
Response: {
  success: true,
  stats: {
    byAttackType:      [{ _id, count, avgConfidence }]  // sorted by count desc
    bySeverity:        [{ _id, count }]
    byDetectionMethod: [{ _id, count }]
    recentTrend:       [{ _id: { hour, type }, count }] // last 24h
    totalCount:        [{ total }]
  }
}
// Single $facet aggregation — 4 breakdowns in one Atlas round-trip
```

#### Alerts
```
GET   /api/alerts?limit=50
PATCH /api/alerts/:id/read
POST  /api/alerts/armoriq  ← called by ArmorIQ executor only
  Body: { attackId, ip, attackType, severity, message, source }
  Response 201: { success: true, data: { id } }
```

#### Action Queue (OpenClaw blocked actions)
```
GET  /api/actions/pending
  Response: { success: true, data: ActionQueue[] }

POST /api/actions/:id/approve
  Body: { approvedBy: string }
  Response: { success: true, data: { _id, action, status:'approved', ... } }

POST /api/actions/:id/reject
  Body: { rejectedBy: string }
  Response: { success: true, data: { _id, action, status:'rejected', ... } }
```

#### Audit Log (OpenClaw decision log)
```
GET  /api/audit?limit=100
  Response: { success: true, data: AuditLog[] }  sorted createdAt desc

POST /api/audit/ingest  ← called by audit_logger.py only
  Body: { intent_id?, action, status, reason?, policy_rule_id?,
          enforcement_level?, triggeredBy?, ip?, attackId?, meta? }
  Response 201: { success: true, data: { id } }
  Side effect: emit(audit:new) via Socket.io
```

#### ArmorIQ Trigger (Demo / Testing)
```
POST /api/armoriq/trigger
Body: { ip?, attackType?, severity?, confidence?, status? }
Response 201: { success: true, data: { attackId, logId, ip, attackType,
                                       severity, confidence, note } }
```

#### PCAP Upload
```
POST /api/pcap/upload
Body: multipart/form-data  field:"pcap" (File) + field:"projectId" (string)
Response data: { total_packets, parsed_packets, total_flows,
                 processing_time_s, local_attacks_found,
                 engine_attacks_found, attacks_saved, skipped_engine }
```

#### Stats / Services / Logs
```
GET /api/stats
  Response data: { totalRequests, totalAttacks, criticalAlerts, servicesOnline,
                   attacksByType: {[type]:number}, recentTimeline: {time,count}[] }

GET /api/service-status
  Response data: { service, status, responseTimeMs, error? }[]

GET /api/logs/recent?limit=50
  Response data: SystemLog[]
```

### ArmorIQ Agent (`:8004`)
```
POST /respond
Body: { attackId, ip, attackType, severity, status, confidence }
Response: {
  attackId:         string,
  actionsExecuted:  string[],
  actionsQueued:    { action, decision, reason, agentReason, blockedReason }[],
  auditEntries:     number
}

GET /health
Response: { status:'ok', service:'armoriq-agent', version:'2.0.0',
            enforcement:'ArmorClaw-v1', openclaw_loaded:bool,
            policy_source:'policy.yaml' }
```

### PCAP Processor (`:8003`)
```
POST /process
Body: { filepath: string, projectId: string }
Response: { filepath, total_packets, parsed_packets, total_flows,
            http_requests_sent, processing_time_s,
            local_attacks: [{ attack_type, severity, src_ip, dst_ip,
                              description, evidence }],
            engine_attacks: [{ threat_detected, threat_type, severity,
                               confidence, ip, url, responseCode }],
            skipped_engine: number }

GET /health  →  { status: 'ok', service: 'pcap-processor', version: '2.0.0' }
```

### Detection Engine (`:8002`)
```
POST /analyze
Body: { logId, projectId, method, url, ip, queryParams,
        body, headers, responseCode }
Response (threat): { threat_detected:true, threat_type, severity, status,
                     detectedBy, confidence, payload,
                     explanation:{headline,what_happened,damage,fix}|null,
                     mitigationSuggestion }
Response (clean): { threat_detected: false }

GET /health  →  { status:'ok', service:'detection-engine', version:'1.0.0' }
```

---

## 6. OpenClaw Enforcement Architecture

### Files in `services/armoriq-agent/`

| File | Role |
|------|------|
| `main.py` | FastAPI app. Calls `_evaluate_with_fallback()` per intent. Tries openclaw_runtime first; catches RuntimeError → falls back to policy_engine |
| `intent_builder.py` | Takes `RespondRequest` → builds list of `IntentModel` objects. 5–6 intents per attack depending on severity |
| `openclaw_runtime.py` | **PRIMARY enforcer**. Loads `policy.yaml` via `@lru_cache`. Evaluates RULE_001→004→DEFAULT. Returns `DecisionModel`. Raises `RuntimeError` on policy load failure |
| `policy_engine.py` | **FALLBACK enforcer**. Same rule logic but hardcoded in Python. Used only when `openclaw_runtime` raises |
| `executor.py` | Receives ALLOW decisions. Calls Gateway endpoints. Uses HTTP 200/201 check (not `raise_for_status`). Does NOT execute BLOCK decisions |
| `audit_logger.py` | Called after every decision. POSTs to `/api/audit/ingest`. Dot-access on `DecisionModel` |
| `models.py` | `RespondRequest`, `ProposedAction` (typed Pydantic), `IntentModel`, `DecisionModel`, `RespondResponse` |
| `policy.yaml` | External declarative policy file. Defines `allowed_actions`, `blocked_actions`, `risk_rules`, `default_decision`, `enforcement_level` |

### policy.yaml Structure
```yaml
version: "1.0"
enforcement_level: "ArmorClaw-v1"

allowed_actions:
  - name: send_alert
  - name: log_attack
  - name: rate_limit_ip
  - name: flag_for_review
  - name: generate_report

blocked_actions:
  - name: permanent_ban_ip
    reason: "Irreversible — requires human authorization"
  - name: shutdown_endpoint
    reason: "Critical impact — requires human authorization"
  - name: purge_all_sessions
    reason: "Irreversible — requires human authorization"
  - name: modify_firewall_rules
    reason: "Critical infrastructure — requires human authorization"

risk_rules:
  - rule_id: RULE_002
    risk_level: critical
    decision: BLOCK
    reason: "Critical risk level — auto-block regardless of action"
  - rule_id: RULE_003
    risk_level: high
    decision: BLOCK
    reason: "High risk level — escalated for human review"

default_decision: BLOCK
default_reason: "No matching policy rule — fail-safe deny"
default_rule_id: RULE_DEFAULT
```

### `policy_rule_id` enum

| Rule | Fires when |
|------|------------|
| `RULE_001` | action is in `blocked_actions` list |
| `RULE_002` | `risk_level == 'critical'` |
| `RULE_003` | `risk_level == 'high'` |
| `RULE_004` | action is in `allowed_actions` list |
| `RULE_DEFAULT` | nothing matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | human approved or rejected via Dashboard |

### Enforcement Verification (live test result)
```
POST /respond {severity:critical, attackType:sqli}

send_alert       → RULE_004 → ALLOW  → EXECUTED ✅
log_attack       → RULE_004 → ALLOW  → EXECUTED ✅
rate_limit_ip    → RULE_004 → ALLOW  → EXECUTED ✅
flag_for_review  → RULE_004 → ALLOW  → EXECUTED ✅
permanent_ban_ip → RULE_001 → BLOCK  → QUEUED   🔒
shutdown_endpoint→ RULE_001 → BLOCK  → QUEUED   🔒

auditEntries: 6 — all logged to MongoDB ✅
```

---

## 7. MongoDB Schema — All 6 Collections

### `systemlogs`
```js
{
  _id: ObjectId,
  projectId: String,          // required, indexed
  timestamp: Date,            // default: now, indexed
  method: String,             // GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD
  url: String,
  queryParams: Object,
  body: Object,
  headers: { userAgent: String, contentType: String, referer: String },
  ip: String,                 // required, indexed
  responseCode: Number|null,
  processingTimeMs: Number,
  createdAt: Date, updatedAt: Date
}
// collection: 'systemlogs'
```

### `attackevents`
```js
{
  _id: ObjectId,
  requestId: ObjectId,        // → systemlogs, required, indexed
  timestamp: Date,            // default: now, indexed
  ip: String,                 // required, indexed
  attackType: String,         // enum — see §8, indexed
  severity: String,           // low|medium|high|critical, indexed
  status: String,             // attempt|successful|blocked, indexed
  detectedBy: String,         // rule|ml|both
  confidence: Number,         // 0.0–1.0, default: 1.0
  payload: String,
  explanation: String,
  mitigationSuggestion: String,
  responseCode: Number|null,
  createdAt: Date, updatedAt: Date
}
// collection: 'attackevents'
// Atlas Search index: 'attackevents_search' on fields: payload, ip, attackType, explanation, mitigationSuggestion
```

### `alerts`
```js
{
  _id: ObjectId,
  attackId: ObjectId,         // → attackevents, required, indexed
  title: String,
  message: String,
  severity: String,           // low|medium|high|critical
  type: String,               // attack_detected|armoriq_action|service_down|rate_limit|anomaly
  isRead: Boolean,            // default: false
  resolvedAt: Date|null,
  meta: Object,
  createdAt: Date, updatedAt: Date
}
// collection: 'alerts'
```

### `action_queue`
```js
{
  _id: ObjectId,
  attackId: String,           // plain String (not ObjectId) — supports mock IDs, indexed
  action: String,             // permanent_ban_ip|shutdown_endpoint|purge_all_sessions|modify_firewall_rules
  status: String,             // pending|approved|rejected|executed, indexed
  agentReason: String,
  blockedReason: String,
  ip: String,
  approvedBy: String|null,
  approvedAt: Date|null,
  executedAt: Date|null,
  createdAt: Date, updatedAt: Date
}
// collection: 'action_queue'
// NOTE: attackId stored as plain String intentionally — avoids ObjectId cast errors for mock/test IDs
```

### `audit_log`
```js
{
  _id: ObjectId,
  intent_id: String|null,     // UUID from IntentModel
  action: String,             // one of 9 ArmorIQ actions
  status: String,             // ALLOWED|BLOCKED|APPROVED|REJECTED, indexed
  triggeredBy: String,        // 'agent'|'human'
  ip: String,                 // indexed
  attackId: String|null,      // plain String — supports mock IDs
  policy_rule_id: String,     // RULE_001–004|RULE_DEFAULT|HUMAN_OVERRIDE
  enforcement_level: String,  // 'ArmorClaw-v1'
  reason: String,
  meta: Object,               // { actionQueueId?, attackType? }
  createdAt: Date, updatedAt: Date
}
// collection: 'audit_log'   ← singular, NOT 'audit_logs'
// NOTE: attackId stored as plain String intentionally
```

### `servicestatuses`
```js
{
  _id: ObjectId,
  serviceName: String,        // gateway|detection-engine|pcap-processor|armoriq-agent (unique)
  status: String,             // online|offline|degraded|unknown
  lastChecked: Date,
  responseTimeMs: Number,
  errorMessage: String,
  meta: Object,
  createdAt: Date, updatedAt: Date
}
// collection: 'servicestatuses'
```

---

## 8. Canonical Field Registry

### `attackType` enum

| Value | Source |
|-------|--------|
| `sqli` | Detection Engine + PCAP |
| `xss` | Detection Engine + PCAP |
| `traversal` | Detection Engine |
| `command_injection` | Detection Engine |
| `ssrf` | Detection Engine |
| `lfi_rfi` | Detection Engine |
| `brute_force` | Detection Engine + PCAP |
| `hpp` | Detection Engine |
| `xxe` | Detection Engine |
| `webshell` | Detection Engine |
| `recon` | PCAP only (PORT_SCAN) |
| `ddos` | PCAP only (SYN_FLOOD/DDOS/ICMP/DNS_AMP) |
| `unknown` | fallback |

### PCAP `attack_type` → Gateway `attackType` mapping

| PCAP value | Gateway value |
|------------|---------------|
| `PORT_SCAN` | `recon` |
| `SYN_FLOOD` | `ddos` |
| `DDOS` | `ddos` |
| `ICMP_FLOOD` | `ddos` |
| `DNS_AMPLIFICATION` | `ddos` |
| `SQL_INJECTION` | `sqli` |
| `XSS` | `xss` |
| `BRUTE_FORCE` | `brute_force` |

### Detection Engine `threat_type` → Gateway `attackType`

| Detection label | Gateway value |
|-----------------|---------------|
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

### ✅ COMPLETE & VERIFIED

| Feature | Evidence |
|---------|----------|
| Gateway API — 11 route files | All routes respond correctly |
| MongoDB — 6 models live | 75+ attacks saved |
| Socket.io — 6 events incl. audit:new | Live dashboard updates confirmed |
| Log ingest → Detection Engine pipeline | sqli/xss/traversal/command_injection classified |
| Attack persistence + alert auto-create | 75 attacks, 31 alerts confirmed in UI |
| PCAP Processor — 8 detectors | 10/10 tests pass, 10,120 pkt/s |
| ArmorIQ Agent — full OpenClaw pipeline | 7/7 pytest pass, live enforcement confirmed |
| openclaw_runtime.py — policy.yaml driven | `openclaw_loaded:true` in /health |
| policy_engine.py — fallback ready | Tested via RuntimeError injection |
| executor.py — safe HTTP check | 200/201 check, no raise_for_status |
| audit_logger.py — per-decision logging | 6 entries per critical attack |
| Action Queue — approve/reject E2E | shutdown_endpoint APPROVED, ban REJECTED tested |
| Audit Log — all 4 statuses live | ALLOWED/BLOCKED/APPROVED/REJECTED all confirmed |
| ArmorIQ trigger route | E2E tested: 6 intents, ALLOW×4 + BLOCK×2 |
| React Dashboard — all 10 pages | All render, no 404s |
| Navbar live badges | Alerts:31, ActionQueue:5 confirmed |
| AuditLog page — filters + stat bar | ✅ |
| sentinel-middleware npm package | 16/16 Jest tests pass |
| Demo Target + attack.sh | 7/7 E2E scenarios confirmed |
| All 4 services health check | gateway:3000 + 8002 + 8003 + 8004 all online |
| MongoDB Atlas — cloud connection | SRV URI + retry logic + env guard + graceful shutdown |
| Atlas Search — `attackevents_search` index | `source:'atlas_search'` confirmed live, Lucene scores returned |
| Atlas Aggregation `$facet` pipeline | `/api/attacks/search/stats` — 4 breakdowns, 1 round-trip |
| All 6 collections verified via CRUD script | `atlasVerify.js` passed in 2872ms, all collections confirmed |
| Auto index creation on startup | 8 indexes on `attackevents`, all collections covered |

### 🟡 PARTIAL

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Detection Engine | 45-rule engine + adversarial decoder | `sentinel_v5.pkl` ML model; LLM explainer (needs OPENAI_API_KEY) |
| Dashboard Charts | StatsPanel component | Recharts donut + timeline not wired to live data |

### 🔲 NOT BUILT

| Feature | Priority |
|---------|----------|
| ML model `sentinel_v5.pkl` | P0 |
| Dashboard charts (donut + timeline) | P1 |
| Threat Intelligence (AbuseIPDB / IPInfo) | P1 |
| Export CSV/JSON | P2 |
| Settings page | P2 |

---

## 10. Port & URL Map + Start Commands

| Service | Port | Start Command |
|---------|------|---------------|
| Gateway API | 3000 | `cd backend && npm run dev` |
| Detection Engine | 8002 | `cd services/detection-engine && source venv/bin/activate && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `cd services/pcap-processor && uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `cd services/armoriq-agent && source venv/bin/activate && uvicorn main:app --port 8004 --reload` |
| Dashboard | 5173 | `cd dashboard && npm run dev` |
| Demo Target | 4000 | `cd demo-target && node server.js` |
| MongoDB | — | Atlas cloud — configure `MONGO_URI` in `.env` |

### `backend/.env`
```
NODE_ENV=development
PORT=3000
MONGO_URI=<Atlas SRV URI>
DETECTION_ENGINE_URL=http://localhost:8002
PCAP_SERVICE_URL=http://localhost:8003
ARMORIQ_URL=http://localhost:8004
ATLAS_SEARCH_INDEX=attackevents_search
```

### `services/armoriq-agent/.env`
```
GATEWAY_URL=http://localhost:3000
ARMORIQ_PORT=8004
```

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
// All Gateway API responses:
{ success: true,  message: string, data: object | array }   // success
{ success: false, message: string, code: string }           // error
// code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
```

**Frontend:** `api.js` uses `unwrap = res => res.data.data`.
Always access payload as `response.data.data`, never `response.data` directly.

> ⚠️ Arrays come back as `{ success:true, data:[] }` — not bare arrays.
> Use `r.data.length` not `r.length`. This is a common mistake.

---

## 13. Demo Day Guide

### Start Everything
```bash
# T1 — Gateway
cd backend && npm run dev

# T2 — Detection Engine
cd services/detection-engine && source venv/bin/activate
uvicorn app.main:app --port 8002

# T3 — PCAP Processor
cd services/pcap-processor
uvicorn main:app --port 8003

# T4 — ArmorIQ Agent
cd services/armoriq-agent && source venv/bin/activate
uvicorn main:app --port 8004 --reload

# T5 — Demo Target
cd demo-target && node server.js

# T6 — Dashboard
cd dashboard && npm run dev
# Open: http://localhost:5173
```

### Health Check All Services
```bash
curl http://localhost:3000/api/service-status
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health   # must show openclaw_loaded:true
```

### Judge Demo — ALLOW
```bash
curl -X POST http://localhost:8004/respond \
  -H "Content-Type: application/json" \
  -d '{"attackId":"demo-1","ip":"5.5.5.5","attackType":"sqli",
       "severity":"medium","confidence":0.9,"status":"attempt"}'
# Expected: actionsExecuted:[send_alert, log_attack, rate_limit_ip]
```

### Judge Demo — BLOCK
```bash
curl -X POST http://localhost:8004/respond \
  -H "Content-Type: application/json" \
  -d '{"attackId":"demo-2","ip":"6.6.6.6","attackType":"brute_force",
       "severity":"critical","confidence":0.97,"status":"successful"}'
# Expected: actionsQueued:[permanent_ban_ip(BLOCK), shutdown_endpoint(BLOCK)]
```

### Full E2E Attack Script
```bash
bash demo-target/attack.sh
# Then watch: http://localhost:5173
# LiveAttackFeed | ActionQueue badge | AuditLog | Alerts
```

### What to Say to Judges

> *"SENTINEL detects threats in real time, generates structured response intents,
> and enforces them through our OpenClaw runtime — reading from a declarative
> policy.yaml file. Safe actions like send_alert execute automatically.
> Dangerous actions like permanent_ban_ip are deterministically blocked
> and queued for human approval. Every decision is logged to the audit trail
> with the exact rule that fired it."*

Point to the ArmorIQ terminal — judges can see `[OPENCLAW] permanent_ban_ip → BLOCK (RULE_001)` printed live.

---

## 14. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | ArmorIQ Agent + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Fix1: typed Pydantic models + dot-access. Fix2: executor safe HTTP. Fix3: audit:new socket event. Demo Target E2E |
| 2026-03-26 | 4.0 | **openclaw_runtime.py** + **policy.yaml** added. 4 redundant doc files deleted. MASTER_REFERENCE rewritten to exact current repo state |
| 2026-03-27 | 5.0 | **MongoDB Atlas Track**: Atlas connection hardened (retry + env guard + graceful shutdown), Atlas Search index `attackevents_search` live, `/api/attacks/search` + `/search/stats` endpoints added, all 6 collections CRUD-verified, auto index creation on startup, `atlasSearchController.js` + `atlasVerify.js` added, schema corrected (`audit_log` singular, `attackId` as plain String in `action_queue` + `audit_log`) |

---

## 15. MongoDB Atlas Track

### Connection — `backend/src/config/database.js`
- URI read from `process.env.MONGO_URI` — fails fast with clear error if missing
- Retry logic: 3 attempts, 3s delay between each
- Options: `serverSelectionTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:10`, `retryWrites:true`, `w:'majority'`
- Logs: `[DATABASE] Connected to MongoDB Atlas — host: cluster0.lenxm5v.mongodb.net`
- Graceful shutdown: `SIGINT`/`SIGTERM` → `mongoose.connection.close()`
- Auto-reconnect: `mongoose.connection.on('disconnected')` → retry in 5s

### Atlas Search Index
- **Index name:** `attackevents_search`
- **Collection:** `attackevents`
- **Fields indexed:** `payload` (standard), `ip` (keyword), `attackType` (keyword), `explanation` (standard), `mitigationSuggestion` (standard)
- **Fuzzy matching:** `maxEdits: 1`
- **Endpoint:** `GET /api/attacks/search?q=<term>`
- **Controller:** `backend/src/controllers/atlasSearchController.js`
- **Fallback:** auto-degrades to `$regex` if index not provisioned — system never crashes

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

### Index Registry — All Collections

| Collection | Index | Type |
|---|---|---|
| `attackevents` | `ip` | Single |
| `attackevents` | `timestamp` desc | Single |
| `attackevents` | `severity` | Single |
| `attackevents` | `attackType` | Single |
| `attackevents` | `status` | Single |
| `attackevents` | `severity + timestamp` | Compound |
| `attackevents` | `ip + timestamp` | Compound |
| `attackevents` | `attackevents_search` | **Atlas Search** |
| `systemlogs` | `ip`, `timestamp` | Single |
| `audit_log` | `status`, `ip`, `createdAt` | Single |
| `action_queue` | `attackId`, `status` | Single |
| `alerts` | `severity`, `createdAt` | Single |
| `servicestatuses` | `serviceName` | Unique |

### CRUD Verification Script
```bash
node backend/scripts/atlasVerify.js
# Connects to Atlas, runs INSERT+READ+DELETE on all 6 collections, prints PASS/FAIL
# Result: ✅ All CRUD verifications passed in 2872ms
```

### Live Test Evidence (2026-03-27)
```
GET /api/attacks/search?q=sqli         → count:16, latencyMs:253, source:'atlas_search'
GET /api/attacks/search?q=xss          → count:15, latencyMs:85,  source:'atlas_search'
GET /api/attacks/search?q=union+select → count:2,  latencyMs:70,  source:'atlas_search'
GET /api/attacks/search/stats          → 76 total attacks, $facet in single round-trip
```
