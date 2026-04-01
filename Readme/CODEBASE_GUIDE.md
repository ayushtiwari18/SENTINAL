# 🗺️ SENTINAL — Codebase Guide

This document explains every important file and folder so any developer can understand the codebase in minutes.

---

## Root Level

```
SENTINAL/
├── .env.example          # Copy to .env — all config variables with comments
├── ecosystem.config.js   # PM2 process definitions for all 5 services
├── deploy.sh             # One-command cloud deployment (installs everything)
├── start.sh              # Start all services locally
├── stop.sh               # Stop all services
├── status.sh             # Check which services are running
```

---

## backend/ — Node.js Gateway

This is the **central hub** of the system. All HTTP traffic passes through here.

```
backend/
├── package.json
└── src/
    ├── server.js                  ← App entry point. Connects MongoDB, starts Express + Socket.IO
    │
    ├── config/
    │   └── db.js                  ← Mongoose connection to MongoDB Atlas
    │
    ├── middleware/
    │   ├── blocklistMiddleware.js  ← ⭐ Checks every request IP against BlockedIP collection
    │   │                              Caches result 30s to avoid DB hit on every request
    │   └── requestLogger.js       ← Logs every HTTP request to SystemLog collection
    │
    ├── models/                    ← MongoDB schemas (Mongoose)
    │   ├── AttackEvent.js         ← Detected attacks (attackType, severity, ip, confidence)
    │   ├── Alert.js               ← Notifications for high/critical attacks
    │   ├── ActionQueue.js         ← Nexus-proposed actions pending human review
    │   ├── AuditLog.js            ← Immutable log of every approve/reject/block action
    │   ├── BlockedIP.js           ← ⭐ Active blocked IPs. Has TTL index on expiresAt
    │   ├── SystemLog.js           ← Raw HTTP request log (projectId, method, url, ip)
    │   ├── CorrelationSnapshot.js ← AI correlation results
    │   └── ServiceStatus.js       ← Service health records
    │
    ├── routes/                    ← Express route definitions (thin — delegate to controllers)
    │   ├── actions.js             ← GET /pending, POST /:id/approve, POST /:id/reject
    │   ├── alerts.js              ← GET /alerts, PATCH /:id/read
    │   ├── attacks.js             ← GET /recent, GET /:id/forensics
    │   ├── audit.js               ← GET /audit
    │   ├── blocklist.js           ← CRUD for /api/blocklist
    │   ├── gemini.js              ← All /api/gemini/* AI endpoints
    │   ├── armoriq.js             ← POST /api/nexus/trigger (demo/simulate)
    │   ├── pcap.js                ← POST /api/pcap/upload
    │   ├── logs.js                ← GET /api/logs/recent
    │   ├── stats.js               ← GET /api/stats
    │   ├── health.js              ← GET /health
    │   └── serviceStatus.js       ← GET /api/service-status
    │
    ├── controllers/               ← Business logic for each route
    │   ├── actionQueueController.js  ← ⭐ approve() now writes to BlockedIP directly
    │   ├── alertController.js
    │   ├── attackController.js
    │   ├── auditController.js
    │   ├── blocklistController.js
    │   ├── geminiController.js
    │   ├── logController.js
    │   ├── statsController.js
    │   └── serviceStatusController.js
    │
    ├── services/
    │   ├── attackService.js       ← ⭐ reportAttack() — saves event, emits socket, calls Nexus
    │   └── geminiService.js       ← Wraps Gemini API calls
    │
    ├── sockets/
    │   └── broadcastService.js    ← Socket.IO event emitter wrapper
    │
    └── utils/
        ├── logger.js              ← Winston logger (timestamped, coloured)
        └── eventEmitter.js        ← Node EventEmitter instance (shared across modules)
```

---

## services/ — Python Microservices

### services/detection-engine/
ML-based attack classifier. Called by Gateway on every suspicious request.

```
detection-engine/
├── main.py              ← FastAPI app, POST /detect endpoint
├── classifier.py        ← ML pipeline (sklearn)
├── patterns.py          ← Regex patterns for each attack type
├── requirements.txt
└── models/              ← Pre-trained ML model files
```

### services/nexus/
Policy-aware autonomous response agent. Called by Gateway after confirmed attack.

```
nexus/
├── main.py              ← FastAPI app, POST /respond endpoint
├── policy_guard.py      ← ⭐ Evaluates actions against policy rules
├── executor.py          ← Executes auto actions (rate_limit_ip, send_alert)
├── audit.py             ← Writes audit entries back to Gateway
└── requirements.txt
```

### services/pcap-processor/
Offline PCAP file analysis.

```
pcap-processor/
├── main.py              ← FastAPI app, POST /analyze endpoint
├── parser.py            ← Scapy-based packet parser
└── requirements.txt
```

---

## dashboard/ — React Frontend

```
dashboard/src/
├── App.jsx                    ← ⭐ React Router — all route definitions
├── main.jsx                   ← Vite entry point
│
├── pages/                     ← One file per dashboard page/route
│   ├── Dashboard.jsx          ← /dashboard — live stats + attack feed
│   ├── Attacks.jsx            ← /attacks — attack list
│   ├── ForensicsPage.jsx      ← /attacks/:id — single attack detail
│   ├── Alerts.jsx             ← /alerts
│   ├── Logs.jsx               ← /logs
│   ├── ActionQueuePage.jsx    ← /action-queue — Nexus approve/reject
│   ├── Blocklist.jsx          ← ⭐ /blocklist — view + manage blocked IPs
│   ├── AuditLog.jsx           ← /audit
│   ├── PcapAnalyzer.jsx       ← /pcap
│   ├── Services.jsx           ← /services — health check panel
│   ├── SimulateAttack.jsx     ← /simulate — trigger test attacks
│   ├── CopilotPage.jsx        ← /copilot — Gemini AI chat
│   ├── CorrelationPage.jsx    ← /correlation — AI threat correlation
│   ├── ExplorePage.jsx        ← /explore
│   ├── Settings.jsx           ← /settings
│   ├── Docs.jsx               ← /docs
│   ├── Landing.jsx            ← / (landing page)
│   └── NotFound.jsx           ← 404
│
├── components/
│   ├── Navbar.jsx             ← ⭐ Nav with live badge counts (alerts, queue, blocklist)
│   ├── AppLayout.jsx          ← Wraps all authenticated pages with Navbar
│   └── ...                    ← Other shared components
│
├── hooks/
│   └── useSocket.js           ← Custom hook for Socket.IO event subscriptions
│
└── services/
    └── api.js                 ← ⭐ All API calls (axios). Single source of truth for endpoints.
```

---

## Key Data Flows

### Attack Detected → Blocklist
```
HTTP request
  → blocklistMiddleware (MongoDB lookup, 30s cache)
  → requestLogger
  → Detection Engine (POST /detect)
  → attackService.reportAttack()
      → AttackEvent saved
      → Alert created (if high/critical)
      → Socket: attack:new
      → callNexus() [fire-and-forget]
          → Nexus policy_guard.py evaluates
          → AUTO: rate_limit_ip written to BlockedIP
          → QUEUED: permanent_ban_ip POSTed to /api/actions
              → Socket: action:pending
              → Human clicks Approve
              → actionQueueController._executeApprovedAction()
              → BlockedIP.findOneAndUpdate()
              → AuditLog.create()
```

### IP Blocked → 403 Enforcement
```
Next request from blocked IP
  → blocklistMiddleware
  → Checks in-memory cache (30s TTL)
  → If not cached: queries MongoDB blockedips
  → If found & not expired: return 403
  → Cache result for 30s
```

---

## ⭐ Most Important Files

| File | Why It Matters |
|---|---|
| `backend/src/middleware/blocklistMiddleware.js` | Everything starts here — enforces all blocks |
| `backend/src/services/attackService.js` | Orchestrates the detection → Nexus pipeline |
| `backend/src/controllers/actionQueueController.js` | Human approval = actual block execution |
| `backend/src/models/BlockedIP.js` | The single source of truth for who is blocked |
| `services/nexus/policy_guard.py` | Decides what Nexus executes vs. queues |
| `dashboard/src/services/api.js` | Every frontend API call lives here |
| `dashboard/src/pages/Blocklist.jsx` | UI for managing blocked IPs |
| `dashboard/src/pages/ActionQueuePage.jsx` | Human-in-the-loop approval UI |
