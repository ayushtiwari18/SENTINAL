# 01 — System Architecture

> **Last updated:** 2026-03-31  
> **Reflects:** Current repo state (backend/, services/, dashboard/, demo-target/)

---

## System-at-a-Glance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SENTINAL PLATFORM                                  │
│                                                                             │
│  ┌──────────────┐     SDK/Agent Snippet (JS)                                │
│  │ Target App   │ ──────────────────────────────────────────────────────►  │
│  │ (demo-target)│                                                           │
│  └──────────────┘                                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                  BACKEND  (Node.js + Express)  :3000                │   │
│  │                                                                     │   │
│  │  server.js                                                          │   │
│  │   ├── src/routes/        (health, logs, attacks, alerts,            │   │
│  │   │                       Nexus, pcap, gemini, actions,           │   │
│  │   │                       audit, forensics, stats, serviceStatus)   │   │
│  │   ├── src/controllers/   (business logic per route)                 │   │
│  │   ├── src/services/      (detectionConnector, pcapConnector,        │   │
│  │   │                       NexusConnector, mongoService…)          │   │
│  │   ├── src/models/        (Mongoose schemas)                         │   │
│  │   ├── src/middleware/    (auth, rateLimit, errorHandler…)           │   │
│  │   ├── src/sockets/       (Socket.IO real-time event bus)            │   │
│  │   ├── src/validators/    (Joi/Zod request validators)               │   │
│  │   └── src/utils/         (helpers, logger, circuit-breaker)         │   │
│  │                                                                     │   │
│  └──────────────────────────┬──────────────┬──────────────┬───────────┘   │
│                             │ HTTP         │ HTTP         │ HTTP           │
│                             ▼              ▼              ▼               │
│  ┌──────────────────┐  ┌──────────────┐  ┌───────────────────────────┐   │
│  │ DETECTION ENGINE │  │PCAP PROCESSOR│  │  SENTINAL RESPONSE ENGINE │   │
│  │  (Python/FastAPI)│  │(Python/FastAPI│  │      (Python/FastAPI)     │   │
│  │     :8002        │  │    :8003)    │  │          :8005            │   │
│  │                  │  │              │  │                           │   │
│  │ app/             │  │ (pcap files) │  │ main.py                   │   │
│  │  main.py         │  │              │  │ runtime.py                │   │
│  │  classifier.py   │  └──────────────┘  │ intent_builder.py         │   │
│  │  rules.py        │                    │ policy_engine.py          │   │
│  │  features.py     │                    │ executor.py               │   │
│  │  explainer.py    │                    │ audit_logger.py           │   │
│  │  decoder.py      │                    │ policy.yaml               │   │
│  │  schemas.py      │                    └───────────────────────────┘   │
│  │  webhook_router.py│                                                     │
│  │ models/          │   ┌─────────────────────────────────────────────┐   │
│  └──────────────────┘   │         Nexus AGENT                       │   │
│                         │  (services/Nexus-agent)  :8004             │   │
│                         │  blocklist.txt                               │   │
│                         └─────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                  DASHBOARD  (React + Vite)  :5173                    │  │
│  │   Components, Pages, Hooks, Services, Socket.IO client               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                   MONGODB ATLAS                                       │  │
│  │   Collections: logs, attacks, alerts, projects, auditLogs, pcap      │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Port Registry

| Service | Port | Runtime | Entry Point |
|---------|------|---------|-------------|
| Backend (Node.js Gateway) | 3000 | Node.js 18+ | `backend/server.js` |
| Detection Engine | 8002 | Python 3.10+ / FastAPI | `services/detection-engine/app/main.py` |
| PCAP Processor | 8003 | Python 3.10+ / FastAPI | `services/pcap-processor/` |
| Nexus Agent | 8004 | Python 3.10+ / FastAPI | `services/Nexus-agent/` |
| Sentinal Response Engine | 8005 | Python 3.10+ / FastAPI | `services/sentinal-response-engine/main.py` |
| Dashboard (dev) | 5173 | Vite / React | `dashboard/` |
| Demo Target App | 4000 | Node.js | `demo-target/` |

---

## Request Lifecycle — 4 Core Flows

### Flow A — Normal HTTP Log (Most Common)
```
Target App
  │  SDK snippet fires POST /api/logs
  ▼
Backend :3000  ←── JWT auth middleware
  │  LogController → LogService → MongoDB (save raw log)
  │  detectionConnector.js → POST :8002/analyze
  ▼
Detection Engine :8002
  │  decoder.py    → URL decode + normalize
  │  rules.py      → regex/keyword match (SQLi, XSS, LFI, SSRF, CMDi)
  │  features.py   → extract 8 numeric features
  │  classifier.py → XGBoost model inference (sentinel_v5.pkl)
  │  explainer.py  → Gemini Flash LLM explanation (if attack)
  │  Returns { isAttack, attackType, confidence, llm_explanation }
  ▼
Backend :3000
  │  If isAttack → AttackService → MongoDB (save attack event)
  │  socket.emit('new-attack') → Dashboard
  │  If confidence > threshold → POST :8005/respond
  ▼
Sentinal Response Engine :8005
  │  intent_builder.py → build intent from attack context
  │  runtime.py → LLM runtime
  │  policy_engine.py + policy.yaml → choose action
  │  executor.py → execute (block IP, alert, quarantine)
  │  audit_logger.py → log action to MongoDB
  ▼
Dashboard notified via Socket.IO
```

### Flow B — PCAP / Network Forensics
```
Dashboard (file upload) or CLI
  │  POST /api/pcap/upload
  ▼
Backend :3000 → pcapConnector → POST :8003/analyze
  ▼
PCAP Processor :8003
  │  Parse .pcap / .pcapng
  │  Extract flows, protocols, anomalies
  │  Returns forensics report
  ▼
Backend → MongoDB (save report)
Dashboard notified via Socket.IO
```

### Flow C — Nexus / AI Chat
```
Dashboard chat input
  │  POST /api/Nexus/chat
  ▼
Backend :3000 → NexusConnector → POST :8004/chat
  ▼
Nexus Agent :8004
  │  blocklist.txt filter
  │  Gemini Flash LLM → contextual security answer
  │  Returns { response, context }
  ▼
Dashboard renders response
```

### Flow D — Direct Gemini Analysis
```
Dashboard / API client
  │  POST /api/gemini/analyze-attack
  ▼
Backend :3000 → gemini.js route
  │  Direct Gemini Flash call (no microservice hop)
  │  Returns { explanation, impact, mitigation }
  ▼
Client
```

---

## Decision Flow (Response Engine)

```
Attack Event Received
        │
        ▼
  intent_builder.py
  (build structured intent: type, severity, source IP, context)
        │
        ▼
  policy_engine.py  ←── policy.yaml
  (match intent to policy rule → decide action)
        │
        ├── BLOCK_IP    → executor.py → update blocklist
        ├── ALERT_ONLY  → audit_logger.py → log only
        ├── QUARANTINE  → executor.py → isolate session
        └── ESCALATE    → emit high-severity socket event
        │
        ▼
  audit_logger.py → MongoDB auditLogs collection
```

---

## Service Communication Matrix

| Caller | Callee | Protocol | Auth |
|--------|--------|----------|------|
| Backend | Detection Engine | HTTP REST | Internal (no auth) |
| Backend | PCAP Processor | HTTP REST | Internal |
| Backend | Nexus Agent | HTTP REST | Internal |
| Backend | Sentinal Response Engine | HTTP REST | Internal |
| Backend | MongoDB Atlas | MongoDB Driver | Connection string |
| Dashboard | Backend | HTTP REST + Socket.IO | JWT Bearer |
| Demo Target | Backend | HTTP REST | API Key (SDK) |

---

## Real-Time Layer (Socket.IO)

All real-time events flow through `backend/src/sockets/`:

| Event | Direction | Payload |
|-------|-----------|--------|
| `new-log` | Server → Client | raw log entry |
| `new-attack` | Server → Client | attack event with ML result |
| `new-alert` | Server → Client | alert object |
| `response-action` | Server → Client | executor action taken |
| `service-status` | Server → Client | health of all Python services |

---

## Deployment Topology (AWS)

```
  Route 53
     │
  CloudFront (dashboard static)
     │
  EC2 t3.medium (Ubuntu)
     ├── pm2: backend :3000
     ├── pm2 / venv: detection-engine :8002
     ├── pm2 / venv: pcap-processor :8003
     ├── pm2 / venv: Nexus-agent :8004
     └── pm2 / venv: sentinal-response-engine :8005
     │
  Security Group: 80/443 public, 3000/8002-8005 internal only
     │
  MongoDB Atlas (M0 free / M10 prod)
```

→ Full AWS setup steps: [06-deployment-aws.md](./06-deployment-aws.md)  
→ Full API reference: [API.md](./API.md)
