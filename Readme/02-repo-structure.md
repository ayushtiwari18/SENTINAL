# 02 — Repository Structure

> **Last updated:** 2026-04-01
> **Reflects:** Actual current repo state — verified by directory scan

---

## Root Layout

```
SENTINAL/
├── .env.example               ← Root-level env template (all services combined)
├── .env.backup/               ← Backup env dir (gitignored in production)
├── .gitignore
├── README.md                  ← Public-facing repo readme
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
├── postman/                   ← Postman collection exports
├── scripts/                   ← Root-level utility scripts (shell/Python)
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
├── scripts/                   ← Backend utility scripts
│   ├── seed.js                ← Demo data seeder
│   ├── atlasVerify.js         ← MongoDB Atlas connection verifier
│   └── backfill-geo.js        ← NEW: One-time Geo-IP backfill for existing AttackEvents
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
    │   ├── auth.js
    │   ├── rateLimiter.js
    │   └── errorHandler.js
    ├── models/                ← Mongoose schemas
    │   ├── SystemLog.js
    │   ├── AttackEvent.js     ← includes geoIntel sub-document (added 2026-04-01)
    │   ├── Alert.js
    │   ├── ActionQueue.js
    │   ├── AuditLog.js
    │   └── ServiceStatus.js
    ├── routes/                ← Express routers (1 file per domain)
    │   ├── health.js          ← GET /api/health
    │   ├── logs.js            ← /api/logs
    │   ├── attacks.js         ← /api/attacks
    │   ├── forensics.js       ← /api/attacks/:id/forensics
    │   ├── alerts.js          ← /api/alerts
    │   ├── nexus.js           ← /api/nexus  (Nexus agent proxy)
    │   ├── pcap.js            ← /api/pcap
    │   ├── gemini.js          ← /api/gemini
    │   ├── actions.js         ← /api/actions
    │   ├── audit.js           ← /api/audit
    │   ├── stats.js           ← /api/stats
    │   ├── serviceStatus.js   ← /api/service-status
    │   ├── blocklist.js       ← /api/blocklist
    │   └── geoIntel.js        ← NEW: /api/geo  (Geo-IP heatmap + stats)
    ├── sockets/               ← Socket.IO event handlers
    │   └── socketServer.js
    └── utils/                 ← Shared utilities
        ├── logger.js
        ├── circuitBreaker.js
        └── helpers.js
```

---

## services/ — Python Microservices

```
services/
├── .gitignore
│
├── detection-engine/          ← ML + Rule-based attack detection  :8002
│   ├── requirements.txt
│   ├── models/                ← ML model binaries (sentinel_v5.pkl — git-ignored)
│   └── app/
│       ├── main.py            ← FastAPI app, /health + /analyze endpoints
│       ├── run.py
│       ├── schemas.py
│       ├── classifier.py      ← XGBoost model load + inference
│       ├── rules.py           ← Regex/keyword rule engine
│       ├── features.py        ← URL feature extraction
│       ├── decoder.py         ← URL decode + normalization
│       ├── explainer.py       ← Gemini Flash LLM explanation
│       └── webhook_router.py
│
├── pcap-processor/            ← Network packet capture analysis  :8003
│
├── Nexus-agent/               ← Nexus AI security agent  :8004
│   └── blocklist.txt
│
└── sentinal-response-engine/  ← Autonomous response  :8005
    ├── main.py
    ├── runtime.py
    ├── intent_builder.py
    ├── policy_engine.py
    ├── policy.yaml
    ├── executor.py
    ├── audit_logger.py
    ├── models.py
    ├── requirements.txt
    └── tests/
```

---

## dashboard/ — React + Vite Frontend

```
dashboard/src/
├── main.jsx
├── App.jsx                    ← 15 routes, all inside AppLayout
├── components/
│   └── AppLayout.jsx          ← Sidebar + outlet wrapper
├── pages/
│   ├── Landing.jsx
│   ├── Dashboard.jsx
│   ├── Attacks.jsx
│   ├── ForensicsPage.jsx
│   ├── Alerts.jsx
│   ├── Logs.jsx
│   ├── Services.jsx
│   ├── Settings.jsx
│   ├── Docs.jsx
│   ├── PcapAnalyzer.jsx
│   ├── ActionQueuePage.jsx
│   ├── AuditLog.jsx
│   ├── SimulateAttack.jsx
│   ├── ExplorePage.jsx
│   ├── CopilotPage.jsx
│   ├── CorrelationPage.jsx
│   ├── Blocklist.jsx
│   ├── NotFound.jsx
│   └── GeoThreatMap.jsx       ← NEW: /geo — Leaflet world map + KPI cards
├── hooks/
├── services/
└── socket.js
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
| `config/` | Shared YAML/JSON configs |
| `postman/` | Postman collection for manual API testing |
| `scripts/` | Shell/Python utility scripts |

---

## Key Files to Know

| File | Why It Matters |
|------|----------------|
| `backend/server.js` | Express app bootstrap — all 14 routes mounted here |
| `backend/src/routes/geoIntel.js` | NEW: Geo-IP heatmap + stats aggregation routes |
| `backend/scripts/backfill-geo.js` | NEW: One-time geo enrichment for existing records |
| `dashboard/src/pages/GeoThreatMap.jsx` | NEW: Leaflet world map visualization |
| `backend/src/services/detectionConnector.js` | Calls detection engine — circuit breaker lives here |
| `services/detection-engine/app/main.py` | POST /analyze — the ML inference endpoint |
| `services/sentinal-response-engine/policy.yaml` | Declarative response policy |
| `ecosystem.config.js` | PM2 process definitions |
| `.env.example` | Source of truth for all required env vars |
