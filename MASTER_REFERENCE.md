# SENTINEL — Master Reference Document

> **Version:** 1.0 · **Date:** 2026-03-26 · **Status:** Living document — update on every merge
>
> This document is the single source of truth for the SENTINEL project.
> It supersedes all previous planning PDFs. Use this for every new feature, bug fix, and
> integration decision. Do NOT invent field names — use the exact names listed in §6.

---

## Table of Contents

1. [Current Repo Structure (Deep Scan)](#1-current-repo-structure)
2. [Service Registry — What Exists & What Is Working](#2-service-registry)
3. [API Contracts — Every Route, Field, and Response Shape](#3-api-contracts)
4. [User Flows — What Users See & Do Per Feature](#4-user-flows)
5. [MongoDB Schema — Canonical Field Names](#5-mongodb-schema)
6. [Canonical Field Registry (Use These Exactly)](#6-canonical-field-registry)
7. [What Is Built vs What Remains](#7-build-status)
8. [Port & URL Map](#8-port-map)
9. [Socket.io Events Reference](#9-socketio-events)
10. [Response Envelope Standard](#10-response-envelope)

---

## 1. Current Repo Structure

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
│   ├── .gitignore
│   ├── doc/
│   ├── scripts/
│   └── src/
│       ├── config/
│       │   └── database.js
│       ├── controllers/
│       │   ├── alertController.js
│       │   ├── attackController.js
│       │   ├── forensicsController.js
│       │   ├── healthController.js
│       │   ├── logController.js
│       │   ├── serviceStatusController.js
│       │   └── statsController.js
│       ├── middleware/
│       ├── models/
│       │   ├── AttackEvent.js
│       │   ├── ServiceStatus.js
│       │   └── SystemLog.js
│       ├── routes/
│       │   ├── alerts.js
│       │   ├── attacks.js
│       │   ├── forensics.js
│       │   ├── health.js
│       │   ├── logs.js
│       │   ├── pcap.js            ← PCAP upload handler (fixed v2)
│       │   ├── serviceStatus.js
│       │   └── stats.js
│       ├── services/
│       │   ├── attackService.js
│       │   ├── detectionConnector.js
│       │   ├── logService.js
│       │   ├── serviceHealthService.js
│       │   └── statsService.js
│       ├── sockets/
│       ├── tests/
│       ├── utils/
│       │   ├── eventEmitter.js
│       │   └── logger.js
│       └── validators/
│
├── dashboard/                   ← SERVICE 4: React SPA (Vite :5173)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       │   ├── Alerts.jsx
│       │   ├── Attacks.jsx
│       │   ├── Dashboard.jsx
│       │   ├── Docs.jsx
│       │   ├── ForensicsPage.jsx
│       │   ├── Landing.jsx
│       │   ├── Logs.jsx
│       │   ├── NotFound.jsx
│       │   ├── PcapAnalyzer.jsx   ← Fixed v2 schema
│       │   ├── Services.jsx
│       │   └── Settings.jsx
│       ├── services/
│       │   ├── api.js             ← Axios client + unwrap helper
│       │   └── socket.js          ← Socket.io client
│       ├── styles/
│       └── utils/
│
└── services/
    ├── detection-engine/          ← SERVICE 3: Python/FastAPI :8002
    │   └── [see §2 for file list]
    └── pcap-processor/            ← SERVICE 2: Python/FastAPI :8003
        ├── .env.example
        ├── README.md
        ├── TEST_RESULTS.md
        ├── attack_detector.py
        ├── config.py
        ├── flow_builder.py
        ├── logger.py
        ├── main.py
        ├── packet_parser.py
        ├── pcap_loader.py
        ├── requirements.txt
        ├── datasets/
        └── tests/
            ├── test_pcap_processor.py
            └── fixtures/
                ├── normal_traffic.pcap
                ├── port_scan.pcap
                ├── syn_flood.pcap
                ├── ddos.pcap
                ├── icmp_flood.pcap
                ├── dns_amplification.pcap
                ├── sqli_http.pcap
                ├── xss_http.pcap
                └── malformed.pcap
```

---

## 2. Service Registry

| Service | Language | Port | Status | Entry Point | Notes |
|---------|----------|------|--------|-------------|-------|
| **Gateway API** | Node.js + Express | 3000 | ✅ WORKING | `backend/server.js` | MongoDB connected, Socket.io live |
| **PCAP Processor** | Python + FastAPI | 8003 | ✅ WORKING | `services/pcap-processor/main.py` | 10/10 tests pass, 10,120 pkt/s |
| **Detection Engine** | Python + FastAPI | 8002 | 🟡 PARTIAL | `services/detection-engine/` | Rules + ML skeleton — needs ML model |
| **React Dashboard** | Vite + React | 5173 | ✅ WORKING | `dashboard/src/main.jsx` | All pages render, PCAP fix applied |
| **ArmorIQ Agent** | Python + LangChain | 8004 | 🔲 NOT BUILT | — | Planned port 8004 (was 8003, conflict fixed) |
| **Data Layer** | MongoDB | 27017 | ✅ WORKING | Atlas cluster | 3 collections active |

### PCAP Processor — What It Does Now

**Pipeline:** `pcap_loader → packet_parser → flow_builder → attack_detector`

| Stage | File | Output |
|-------|------|--------|
| Load | `pcap_loader.py` | Raw Scapy packets |
| Parse | `packet_parser.py` | `PacketMeta` objects (ip, tcp, udp, flags, payload) |
| Build Flows | `flow_builder.py` | Grouped 5-tuple flows |
| Detect | `attack_detector.py` | `AttackSignal` list |

**Detectors in `attack_detector.py`:**
- `PORT_SCAN` — unique dst_ports > 15 from same src in window
- `SYN_FLOOD` — SYN-only ratio > 0.8 AND total_packets > 100
- `DDOS` — unique src_ips > 10 AND pps > 100
- `ICMP_FLOOD` — ICMP packets > 50 in flow
- `DNS_AMPLIFICATION` — DNS response/request ratio > 5.0
- `SQL_INJECTION` — URL decode + regex match on HTTP payload
- `XSS` — URL decode + regex match on HTTP payload
- `BRUTE_FORCE` — same src, same dst_port, > 10 unique attempts

### Detection Engine — What It Does Now

**5-Layer Pipeline (as designed):**
- Layer 1: Rule engine — 45 regex patterns, 11 attack types
- Layer 2: ML Classifier — Random Forest (needs `sentinel_v5.pkl`)
- Layer 3: Adversarial decoder — URL/double/HTML/unicode decode
- Layer 4: Success determination from `responseCode`
- Layer 5: LLM Explainer — GPT-4o mini, async, high/critical only

---

## 3. API Contracts

### Gateway API (`:3000`)

All responses use the standard envelope (see §10). `data` field holds the payload.

#### Logs

```
POST /api/logs/ingest
Body: {
  projectId: string,
  method:    string,          // 'GET' | 'POST' | 'PUT' | 'DELETE'
  url:       string,
  ip:        string,
  queryParams: object,
  body:      object,
  headers: {
    userAgent:   string,
    contentType: string,
    referer:     string
  },
  responseCode: number        // HTTP status code
}
Response 200: { success: true, message: '...', data: { id: ObjectId } }
```

#### Attacks

```
GET /api/attacks/recent?limit=50
Response data: AttackEvent[]

GET /api/attacks/:id/forensics
Response data: {
  attack: AttackEventShape,
  raw_request: SystemLogShape | null,
  ip_intel: {
    ip:                  string,
    total_requests_24h:  number,
    total_attacks_ever:  number,
    first_attack:        ISODate | null,
    last_attack:         ISODate | null,
    attack_types_seen:   string[]
  },
  attack_chain: {
    timeline:      { time, method, url, code }[],
    pattern_label: string,     // 'APT-style automated scanner' | etc.
    all_attacks:   AttackEvent[]
  }
}
```

#### PCAP Upload

```
POST /api/pcap/upload
Body: multipart/form-data
  Field "pcap": File (.pcap or .pcapng, max 500MB)
  Field "projectId": string (optional, default: 'pcap-upload')

Response data (v2 schema — use ONLY these field names):
{
  total_packets:        number,   // packets in the file
  parsed_packets:       number,   // successfully parsed
  total_flows:          number,   // flows built by flow_builder
  processing_time_s:    number,   // wall-clock seconds
  local_attacks_found:  number,   // from attack_detector (network layer)
  engine_attacks_found: number,   // from Detection Engine (HTTP layer)
  attacks_saved:        number,   // persisted to MongoDB
  skipped_engine:       number    // HTTP flows not sent to engine
}
```

#### Stats

```
GET /api/stats
Response data: {
  totalRequests:   number,
  totalAttacks:    number,
  criticalAlerts:  number,
  servicesOnline:  number,
  attacksByType:   { [attackType: string]: number },
  recentTimeline:  { time: ISODate, count: number }[]
}
```

#### Service Status

```
GET /api/service-status
Response data: {
  service: string,
  status:  'online' | 'offline',
  responseTimeMs: number,
  error?: string
}[]
```

#### Alerts

```
GET /api/alerts?limit=50
Response data: Alert[]

PATCH /api/alerts/:id/read
Response data: { id: string, read: true }
```

#### Logs

```
GET /api/logs/recent?limit=50
Response data: SystemLog[]
```

#### Health

```
GET /api/health
Response data: { status: 'ok', uptime: number }
```

---

### PCAP Processor (`:8003`)

```
POST /process
Body (JSON): {
  filepath:  string,   // absolute path to .pcap file on disk
  projectId: string
}
Response (v2 schema):
{
  filepath:           string,
  total_packets:      number,
  parsed_packets:     number,
  total_flows:        number,
  http_requests_sent: number,
  local_attacks: [
    {
      attack_type:  string,   // 'PORT_SCAN' | 'SYN_FLOOD' | 'DDOS' | 'ICMP_FLOOD'
                              // 'DNS_AMPLIFICATION' | 'SQL_INJECTION' | 'XSS' | 'BRUTE_FORCE'
      severity:     string,   // 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
      src_ip:       string,
      dst_ip:       string,
      description:  string,
      evidence:     object
    }
  ],
  engine_attacks: [
    {
      threat_detected: boolean,
      threat_type:     string,
      severity:        string,
      confidence:      number,
      explanation:     object | null,
      ip:              string,
      url:             string,
      responseCode:    number | null
    }
  ],
  skipped_engine:    number,
  processing_time_s: number
}

GET /health
Response: { status: 'ok' }
```

---

### Detection Engine (`:8002`)

```
POST /analyze
Body (JSON): {
  logId:       string,
  projectId:   string,
  method:      string,
  url:         string,
  ip:          string,
  queryParams: object,
  body:        object,
  headers:     object,
  responseCode: number
}
Response (attack found):
{
  threat_detected:      boolean,    // true
  threat_type:          string,     // 'SQL Injection' | 'XSS' | etc. (human label)
  severity:             string,     // 'low' | 'medium' | 'high' | 'critical'
  status:               string,     // 'attempt' | 'successful' | 'blocked'
  detectedBy:           string,     // 'rule' | 'ml' | 'both'
  confidence:           number,     // 0.0 – 1.0
  payload:              string,
  explanation: {
    headline:       string,
    what_happened:  string,
    damage:         string,
    fix:            string
  } | null,
  mitigationSuggestion: string
}
Response (clean): { threat_detected: false }

GET /health
Response: { status: 'ok', model_loaded: boolean }
```

> ⚠️ NOTE: Detection Engine uses `threat_detected` (not `isAttack` from old docs).
> Gateway's `logService.js` and `pcap.js` both already use `threat_detected`.

---

### ArmorIQ Agent (`:8004`) — PLANNED

```
POST /respond
Body: {
  attackId:   string,
  ip:         string,
  attackType: string,
  severity:   string,
  status:     string,
  confidence: number
}
Response:
{
  actionsExecuted: string[],
  actionsQueued: [
    {
      action:        string,
      agentReason:   string,
      blockedReason: string
    }
  ]
}

GET /health
Response: { status: 'ok' }
```

---

## 4. User Flows

### Flow 1 — Dashboard (Analyst / Developer)

```
User opens http://localhost:5173
  ↓
[Dashboard page] — Landing.jsx or Dashboard.jsx
  ├── StatsRow polls GET /api/stats every 30s
  │     shows: totalRequests, totalAttacks, criticalAlerts, servicesOnline
  ├── ServiceStatusBar polls GET /api/service-status every 15s
  │     shows: ● gateway ● detection-engine ● pcap-processor ● armoriq-agent
  ├── LiveAttackFeed subscribes socket.on('attack:new')
  │     new row slides in at top within 1 second of attack
  │     filter by: attackType | severity | status
  │     click row → opens /attacks/:id or inline forensics drawer
  ├── AttackDonutChart updated from attacksByType in /api/stats
  └── TimelineLineChart shows attacks per minute from recentTimeline
```

### Flow 2 — PCAP Analyzer (Security Analyst)

```
User navigates to http://localhost:5173/pcap
  ↓
[PcapAnalyzer.jsx]
  1. Drag-drop or click to select .pcap / .pcapng file
  2. Click [Analyze]
  3. POST /api/pcap/upload → multipart with field "pcap" + "projectId"
  4. Backend saves to /tmp/sentinal-uploads/<uuid>
  5. Backend POSTs filepath to http://localhost:8003/process
  6. PCAP Processor returns v2 response
  7. Backend merges local_attacks + engine_attacks → saves to MongoDB
  8. Backend emits attack:new per attack via Socket.io
  9. Frontend shows 5 stat cards:
       total_packets | local_attacks_found | engine_attacks_found
       attacks_saved | skipped_engine
  10. Processing time + total_flows shown below cards
  11. If totalAttacksFound > 0 → red alert banner with count
      If 0 → green "No threats detected"
  12. Attacks simultaneously appear in LiveAttackFeed on Dashboard
```

### Flow 3 — Forensics Drawer (Analyst)

```
User clicks any attack row in [Attacks.jsx] or [Dashboard.jsx]
  ↓
GET /api/attacks/:id/forensics
  ↓
[ForensicsPage.jsx / ForensicsDrawer component]
  Shows:
  ├── Attack summary card
  │     id | attackType | severity | confidence | status | detectedBy
  ├── Raw HTTP request block
  │     method | url | ip | headers | body | queryParams | responseCode
  ├── IP Intel panel
  │     total_requests_24h | total_attacks_ever | first_attack
  │     last_attack | attack_types_seen
  └── Attack chain timeline
        Each entry: { time, method, url, code }
        pattern_label: 'APT-style automated scanner' | etc.
```

### Flow 4 — Live Attack Detection (Developer's App via Middleware)

```
Developer's app has sentinel-middleware installed
  ↓
Request arrives → middleware fires POST /api/logs/ingest (async, non-blocking)
  ↓
Gateway saves SystemLog → calls detectionConnector.js → POST /analyze to Detection Engine
  ↓
Detection Engine returns { threat_detected, threat_type, severity, confidence, ... }
  ↓
If threat_detected:
  Gateway creates AttackEvent → emits 'attack:new' Socket.io event
  Dashboard LiveAttackFeed receives event → new row prepended
  If severity = critical → toast + red screen flash
```

### Flow 5 — Alerts Page (Analyst)

```
User navigates to http://localhost:5173/alerts
  ↓
[Alerts.jsx]
  GET /api/alerts?limit=50
  Shows: list of alerts with severity badge, timestamp, message
  Click alert → PATCH /api/alerts/:id/read → marks read
```

### Flow 6 — Services Health Page (Operator)

```
User navigates to http://localhost:5173/services
  ↓
[Services.jsx]
  GET /api/service-status
  Shows per service:
    name | status (online/offline) | responseTimeMs | lastChecked
  Services monitored:
    gateway (3000) | detection-engine (8002) | pcap-processor (8003) | armoriq-agent (8004)
```

### Flow 7 — ArmorIQ Action Queue (Developer / Human Approver) — PLANNED

```
Attack stored → Gateway calls POST http://localhost:8004/respond
  ↓
ArmorIQ Agent:
  Auto-executes: log_attack | send_alert | rate_limit_ip | generate_report | flag_review
  Blocks (queues): permanent_ban_ip | shutdown_endpoint | purge_all_sessions | modify_firewall
  ↓
Blocked actions saved to action_queue collection
Socket.io emits 'action:pending' event
  ↓
[Dashboard ActionQueue section]
  Shows PendingActionCard:
    action description | agentReason | blockedReason | risk warning
    [✅ APPROVE]  [❌ REJECT]
  User clicks APPROVE → POST /api/actions/:id/approve
  Audit log updated
```

---

## 5. MongoDB Schema

### Collection: `systemlogs` (maps to SystemLog model)

```js
{
  _id:          ObjectId,
  projectId:    String,          // which app/source sent this
  timestamp:    Date,
  method:       String,          // 'GET' | 'POST' | 'PUT' | 'DELETE'
  url:          String,
  queryParams:  Object,
  body:         Object,
  headers: {
    userAgent:   String,
    contentType: String,
    referer:     String
  },
  ip:           String,
  responseCode: Number           // HTTP status code (nullable)
}
```

### Collection: `attackevents` (maps to AttackEvent model)

```js
{
  _id:                  ObjectId,
  requestId:            ObjectId,   // ref → systemlogs._id
  timestamp:            Date,
  ip:                   String,
  attackType:           String,     // ENUM — see §6
  severity:             String,     // 'low' | 'medium' | 'high' | 'critical'
  status:               String,     // 'attempt' | 'successful' | 'blocked'
  detectedBy:           String,     // 'rule' | 'ml' | 'both'
  confidence:           Number,     // 0.0 – 1.0
  payload:              String,
  explanation:          String,     // JSON stringified or plain text
  mitigationSuggestion: String,
  responseCode:         Number
}
```

### Collection: `servicestatuses` (maps to ServiceStatus model)

```js
{
  _id:           ObjectId,
  serviceName:   String,
  status:        String,     // 'online' | 'offline'
  lastChecked:   Date,
  responseTimeMs: Number,
  errorMessage:  String
}
```

### Collection: `ip_intelligence` — PLANNED

```js
{
  _id:           ObjectId,
  ip:            String,      // indexed, unique
  abuseScore:    Number,
  totalReports:  Number,
  isTor:         Boolean,
  country:       String,
  city:          String,
  isp:           String,
  threatScore:   Number,      // 0–100 calculated
  cachedAt:      Date         // TTL 24 hours
}
```

### Collection: `action_queue` — PLANNED

```js
{
  _id:           ObjectId,
  attackId:      ObjectId,
  timestamp:     Date,
  action:        String,      // 'permanent_ban_ip' | 'shutdown_endpoint' | etc.
  status:        String,      // 'pending' | 'approved' | 'rejected'
  agentReason:   String,
  blockedReason: String,
  approvedBy:    String,
  approvedAt:    Date,
  executedAt:    Date
}
```

### Collection: `audit_log` — PLANNED

```js
{
  _id:        ObjectId,
  timestamp:  Date,
  action:     String,
  status:     String,         // 'ALLOWED' | 'BLOCKED' | 'APPROVED' | 'REJECTED'
  triggeredBy: String,        // 'agent' | 'human'
  ip:         String,
  attackId:   ObjectId,
  meta:       Object
}
```

---

## 6. Canonical Field Registry

> **Rule:** Copy-paste these exact values. Never invent alternate spellings.

### `attackType` enum (AttackEvent model)

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
| `recon` | Port Scan / Recon | PCAP |
| `ddos` | DoS / DDoS / ICMP / DNS Amp | PCAP |
| `unknown` | Unclassified | fallback |

### `severity` enum

| Value | Used in |
|-------|--------|
| `low` | AttackEvent, Detection Engine response |
| `medium` | AttackEvent, Detection Engine response |
| `high` | AttackEvent, Detection Engine response |
| `critical` | AttackEvent, Detection Engine response |

> PCAP Processor uses uppercase (`LOW/MEDIUM/HIGH/CRITICAL`) internally.
> Gateway's `pcap.js` normalises to lowercase before saving.

### `status` enum (AttackEvent)

| Value | Meaning |
|-------|--------|
| `attempt` | Default; response code unknown or neutral |
| `successful` | responseCode 200/302 |
| `blocked` | responseCode 403/404/500 |

### `detectedBy` enum (AttackEvent)

| Value | Meaning |
|-------|--------|
| `rule` | Regex rule engine matched |
| `ml` | ML classifier triggered |
| `both` | Rule + adversarial decoder both fired |

### PCAP Processor `attack_type` (local_attacks array)

| Value | Maps to `attackType` |
|-------|---------------------|
| `PORT_SCAN` | `recon` |
| `SYN_FLOOD` | `ddos` |
| `DDOS` | `ddos` |
| `ICMP_FLOOD` | `ddos` |
| `DNS_AMPLIFICATION` | `ddos` |
| `SQL_INJECTION` | `sqli` |
| `XSS` | `xss` |
| `BRUTE_FORCE` | `brute_force` |

### Detection Engine `threat_type` (human labels)

| Value | Maps to `attackType` |
|-------|---------------------|
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

### Socket.io Event Payloads (§9 for full details)

| Event | Emitted by | Consumed by |
|-------|-----------|-------------|
| `attack:new` | Gateway after AttackEvent created | Dashboard LiveAttackFeed |
| `alert:new` | Gateway after Alert created | Dashboard alert badge |
| `action:pending` | Gateway after action_queue insert | Dashboard ActionQueue |

### Response Envelope (§10 for full details)

```js
// All Gateway API responses use this shape
{
  success: boolean,
  message: string,
  data:    object | array | null
}
```

---

## 7. Build Status

### ✅ COMPLETE

| Feature | What's Done | File(s) |
|---------|-------------|--------|
| Gateway API core | Ingest, routes, middleware, circuit breaker | `backend/src/` |
| MongoDB connection | Atlas + 3 models | `backend/src/config/database.js`, `models/` |
| Socket.io server | Event emitter wired to all attack/alert events | `backend/src/sockets/` |
| Log ingest | `POST /api/logs/ingest` → SystemLog → Detection Engine call | `backend/src/routes/logs.js` |
| Attack persistence | AttackEvent create + emit | `backend/src/services/attackService.js` |
| Forensics endpoint | 3-query aggregation, IP history, chain pattern | `backend/src/controllers/forensicsController.js` |
| Stats endpoint | `GET /api/stats` | `backend/src/services/statsService.js` |
| Service health | Ping all 4 services, upsert ServiceStatus | `backend/src/services/serviceHealthService.js` |
| PCAP route (v2) | Upload → PCAP service → merge both attack lists | `backend/src/routes/pcap.js` |
| PCAP Processor | 8 detectors, full pipeline, 10/10 tests | `services/pcap-processor/` |
| React Dashboard | All 10 pages rendered | `dashboard/src/pages/` |
| PcapAnalyzer page | v2 schema, 5 stat cards, correct field names | `dashboard/src/pages/PcapAnalyzer.jsx` |
| api.js | All API calls + `unwrap` helper | `dashboard/src/services/api.js` |

### 🟡 PARTIAL

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Detection Engine | FastAPI scaffold, `rules.py`, `main.py` | `sentinel_v5.pkl` model file, `classifier.py` fully wired, `explainer.py` (needs OPENAI_API_KEY) |
| Dashboard charts | Page shells exist | Recharts donut + timeline not wired to live data |
| Dashboard LiveAttackFeed | Socket.io client exists (`socket.js`) | `attack:new` listener not yet rendering rows on Dashboard.jsx |
| IP Intel panel | `GET /api/intel/:ip` stub | AbuseIPDB + IPInfo API keys not set, no caching layer |
| Alerts | Full page + route + model | Alert creation logic not triggered from attack events |

### 🔲 NOT BUILT

| Feature | Original Plan | Priority |
|---------|---------------|----------|
| ArmorIQ Agent (`:8004`) | LangChain + ArmorClaw, auto-response | P0 for demo |
| ActionQueue UI | PendingActionCard + approve/reject | P0 for demo |
| `action_queue` collection | MongoDB model + route | P0 for demo |
| `audit_log` collection | MongoDB model + route | P1 |
| Threat Intelligence | `GET /api/intel/:ip`, AbuseIPDB, IPInfo | P1 |
| npm Middleware Package | `sentinel-middleware` npm package | P1 |
| Adversarial ML Training | `adversarial_loop.py` → `sentinel_v5.pkl` | Must complete before Detection Engine works |
| ForensicsDrawer (full) | ML confidence, adversarial decode shown | P1 |
| Export CSV/JSON | Button in AttackTable | P2 |
| IP History Timeline | Component in IP Intel Panel | P2 |
| Settings page | ProjectId / API key management | P2 |

---

## 8. Port & URL Map

| Service | Port | Base URL | Start Command |
|---------|------|----------|---------------|
| Gateway API | 3000 | `http://localhost:3000` | `cd backend && npm start` |
| PCAP Processor | 8003 | `http://localhost:8003` | `cd services/pcap-processor && uvicorn main:app --port 8003` |
| Detection Engine | 8002 | `http://localhost:8002` | `cd services/detection-engine && uvicorn main:app --port 8002` |
| ArmorIQ Agent | 8004 | `http://localhost:8004` | `cd services/armoriq-agent && uvicorn main:app --port 8004` |
| React Dashboard | 5173 | `http://localhost:5173` | `cd dashboard && npm run dev` |
| MongoDB | 27017 | Atlas cloud | configured in `.env` |

### Environment Variables (backend `.env`)

```
NODE_ENV=development
PORT=3000
MONGO_URI=<your Atlas URI>
DETECTION_ENGINE_URL=http://localhost:8002
PCAP_SERVICE_URL=http://localhost:8003
ARMORIQ_URL=http://localhost:8004
```

---

## 9. Socket.io Events Reference

### `attack:new` — emitted by Gateway after every AttackEvent

```js
{
  id:         string,       // AttackEvent._id
  ip:         string,
  attackType: string,       // see §6 attackType enum
  severity:   string,       // 'low' | 'medium' | 'high' | 'critical'
  status:     string,       // 'attempt' | 'successful' | 'blocked'
  detectedBy: string,       // 'rule' | 'ml' | 'both'
  confidence: number,       // 0.0 – 1.0
  url:        string,
  timestamp:  ISODate,
  source:     string        // 'live' | 'pcap'
}
```

### `alert:new` — emitted on high/critical attack

```js
{
  id:      string,
  message: string,
  severity: string
}
```

### `action:pending` — PLANNED, emitted after ArmorIQ queues an action

```js
{
  id:           string,     // action_queue._id
  action:       string,
  agentReason:  string,
  blockedReason: string,
  ip:           string,
  attackId:     string
}
```

---

## 10. Response Envelope Standard

Every Gateway API response uses:

```js
// Success
{
  success: true,
  message: string,
  data:    object | array
}

// Error
{
  success: false,
  message: string,
  code:    string    // 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
}
```

`api.js` in the dashboard uses `unwrap = res => res.data.data` to strip the envelope.
Always access payload as `data.xyz` — never `res.data.xyz` directly from frontend.

---

## Changelog

| Date | Change | File(s) |
|------|--------|---------|
| 2026-03-26 | PCAP Processor built — 8 detectors, full pipeline | `services/pcap-processor/` |
| 2026-03-26 | PCAP route fixed — port 8001→8003, v2 schema, schema mismatch fixed | `backend/src/routes/pcap.js` |
| 2026-03-26 | Service health fixed — pcap port 8001→8003, armoriq 8003→8004 | `backend/src/services/serviceHealthService.js` |
| 2026-03-26 | PcapAnalyzer.jsx fixed — all field names updated to v2 schema | `dashboard/src/pages/PcapAnalyzer.jsx` |
| 2026-03-26 | Deprecated `parser.py` deleted | `services/pcap-processor/` |
| 2026-03-26 | `backend/.env.example` updated with all service URLs | `backend/.env.example` |
| 2026-03-26 | `MASTER_REFERENCE.md` created | this file |
