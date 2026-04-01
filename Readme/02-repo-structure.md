# 02 — Repository Structure

> **Last updated:** 2026-03-31  
> **Reflects:** Actual current repo state — verified by directory scan

---

## Root Layout

```
SENTINAL/
├── .env.example               ← Root-level env template (all services combined)
├── .env.backup/               ← Backup env dir (gitignored in production)
├── .gitignore
├── MASTER_REFERENCE.md        ← Legacy monolithic reference (do not edit)
├── README.md                  ← Public-facing repo readme
├── SPONSOR_TRACK_REPORT.md    ← Hackathon/sponsor track report
├── naming-and-boundaries.md   ← Service naming conventions & boundary rules
├── ecosystem.config.js        ← PM2 process manager config (all services)
├── deploy.sh                  ← Full AWS deployment automation script
├── start.sh                   ← Local start script (all services)
├── stop.sh                    ← Local stop script
├── status.sh                  ← Health check script
│
├── backend/                   ← Node.js Express gateway (PRIMARY API)
├── services/                  ← Python microservices
├── dashboard/                 ← React + Vite frontend
├── demo-target/               ← Vulnerable demo app for SDK testing
├── config/                    ← Shared config files
├── docs/                      ← Extra documentation / specs
├── postman/                   ← Postman collection exports
├── scripts/                   ← Utility/maintenance scripts
└── Readme/                    ← This structured reference folder
```

---

## backend/ — Node.js Gateway

```
backend/
├── server.js                  ← Entry point: Express + Socket.IO init
├── package.json
├── package-lock.json
├── .env.example               ← Backend-specific env vars
├── .gitignore
├── doc/                       ← Auto-generated or legacy API docs
├── scripts/                   ← Backend-specific utility scripts
└── src/
    ├── config/                ← DB connection, env loader, constants
    ├── controllers/           ← Route handler logic (1 file per domain)
    │   ├── logController.js
    │   ├── attackController.js
    │   ├── alertController.js
    │   ├── NexusController.js
    │   ├── pcapController.js
    │   ├── geminiController.js
    │   ├── actionController.js
    │   ├── auditController.js
    │   ├── forensicsController.js
    │   └── statsController.js
    ├── middleware/            ← Express middleware chain
    │   ├── auth.js            ← JWT verification
    │   ├── rateLimit.js       ← Rate limiter
    │   └── errorHandler.js    ← Global error handler
    ├── models/                ← Mongoose schemas
    │   ├── Log.js
    │   ├── Attack.js
    │   ├── Alert.js
    │   ├── Project.js
    │   └── AuditLog.js
    ├── routes/                ← Express routers (1 file per domain)
    │   ├── health.js          ← GET /api/health
    │   ├── logs.js            ← /api/logs
    │   ├── attacks.js         ← /api/attacks
    │   ├── alerts.js          ← /api/alerts
    │   ├── Nexus.js         ← /api/Nexus  (Nexus agent proxy)
    │   ├── pcap.js            ← /api/pcap     (PCAP processor proxy)
    │   ├── gemini.js          ← /api/gemini   (direct Gemini calls)
    │   ├── actions.js         ← /api/actions  (response actions)
    │   ├── audit.js           ← /api/audit
    │   ├── forensics.js       ← /api/forensics
    │   ├── stats.js           ← /api/stats
    │   └── serviceStatus.js   ← /api/services/status
    ├── services/              ← External service connectors
    │   ├── detectionConnector.js   ← → :8002 Detection Engine
    │   ├── pcapConnector.js        ← → :8003 PCAP Processor
    │   ├── NexusConnector.js     ← → :8004 Nexus Agent
    │   ├── responseConnector.js    ← → :8005 Response Engine
    │   └── mongoService.js         ← MongoDB CRUD helpers
    ├── sockets/               ← Socket.IO event handlers
    │   └── index.js           ← All real-time event emissions
    ├── utils/                 ← Shared utilities
    │   ├── logger.js          ← Winston logger
    │   ├── circuitBreaker.js  ← Opossum circuit breaker wrapper
    │   └── helpers.js         ← Misc helpers
    ├── validators/            ← Request validation schemas
    │   └── logValidator.js
    └── tests/                 ← Jest unit/integration tests
```

---

## services/ — Python Microservices

```
services/
├── .gitignore
│
├── detection-engine/          ← ML + Rule-based attack detection  :8002
│   ├── requirements.txt
│   ├── File Structure.md      ← Internal structure notes
│   ├── models/                ← ML model binaries (sentinel_v5.pkl — git-ignored)
│   └── app/
│       ├── main.py            ← FastAPI app, /health + /analyze endpoints
│       ├── run.py             ← Uvicorn launcher
│       ├── schemas.py         ← Pydantic request/response models
│       ├── classifier.py      ← XGBoost model load + inference
│       ├── rules.py           ← Regex/keyword rule engine
│       ├── features.py        ← URL feature extraction (8 features)
│       ├── decoder.py         ← URL decode + normalization
│       ├── explainer.py       ← Gemini Flash LLM explanation
│       └── webhook_router.py  ← Webhook event routing
│
├── pcap-processor/            ← Network packet capture analysis  :8003
│   └── (Python FastAPI service)
│
├── Nexus-agent/             ← Nexus AI security agent  :8004
│   └── blocklist.txt          ← IP/domain blocklist
│
├── sentinal-response-engine/  ← Autonomous response  :8005
│   ├── main.py                ← FastAPI app, /respond endpoint
│   ├── run.py                 ← Uvicorn launcher
│   ├── runtime.py             ← LLM reasoning engine
│   ├── intent_builder.py      ← Build structured intent from attack context
│   ├── policy_engine.py       ← Match intent to policy rules
│   ├── policy.yaml            ← Declarative policy rules (YAML)
│   ├── executor.py            ← Execute decided action
│   ├── audit_logger.py        ← Write action to MongoDB audit log
│   ├── models.py              ← Pydantic schemas
│   ├── requirements.txt
│   ├── .env.example
│   ├── README.md
│   └── tests/                 ← Pytest test suite
│
└── middleware/                ← Shared Python middleware utilities
```

---

## dashboard/ — React + Vite Frontend

```
dashboard/
├── index.html
├── vite.config.js
├── package.json
├── tailwind.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── components/            ← Reusable UI components
    ├── pages/                 ← Route-level page components
    ├── hooks/                 ← Custom React hooks (useSocket, useAttacks…)
    ├── services/              ← API client functions (axios)
    └── socket.js              ← Socket.IO client init
```

---

## demo-target/ — Vulnerable Demo App

```
demo-target/
├── (Node.js app with intentional vulnerabilities)
└── (SENTINAL SDK snippet pre-installed for testing)
```

---

## Root Config & Scripts

| File | Purpose |
|------|---------|
| `ecosystem.config.js` | PM2 config — defines all 5 processes with env vars |
| `deploy.sh` | Full AWS EC2 deployment: git pull, install, start |
| `start.sh` | Local dev: start all services in correct order |
| `stop.sh` | Kill all services |
| `status.sh` | Check health of all running services |
| `.env.example` | Master env template with all required variables |
| `naming-and-boundaries.md` | Naming conventions & service boundary rules |
| `config/` | Shared YAML/JSON configs |
| `postman/` | Postman collection for manual API testing |
| `scripts/` | DB seed, migration, utility scripts |
| `docs/` | Additional specs, diagrams, external docs |

---

## Key Files to Know

| File | Why It Matters |
|------|----------------|
| `backend/server.js` | Express app bootstrap — all routes mounted here |
| `backend/src/services/detectionConnector.js` | Calls detection engine — circuit breaker lives here |
| `services/detection-engine/app/main.py` | POST /analyze — the ML inference endpoint |
| `services/sentinal-response-engine/policy.yaml` | Declarative response policy — edit to change behavior |
| `services/sentinal-response-engine/runtime.py` | LLM autonomous response runtime |
| `ecosystem.config.js` | PM2 process definitions — update when adding services |
| `.env.example` | Source of truth for all required env vars |
