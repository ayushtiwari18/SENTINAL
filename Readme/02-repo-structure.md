# 02 — Exact Repo Structure

> Source: `MASTER_REFERENCE.md` §2 · Last verified: 2026-03-28

---

```
SENTINAL/
├── .env                             ← NOT committed (gitignored). See deployment guide for values.
├── .env.example                     template for all env vars
├── .env.backup/                     directory (gitignored)
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md              ← original monolithic doc (preserved)
├── Readme/                          ← THIS FOLDER — split reference files
│   ├── INDEX.md
│   ├── 01-architecture.md
│   ├── 02-repo-structure.md         ← you are here
│   ├── 03-services.md
│   ├── 04-features.md
│   ├── 05-api-contracts.md
│   ├── 06-deployment-aws.md
│   ├── 07-aws-sessions.md
│   ├── 08-database.md
│   ├── 09-important-notes.md
│   └── 10-changelog.md
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
│       │   ├── AppLayout.jsx
│       │   ├── Navbar.jsx
│       │   ├── ActionQueue.jsx
│       │   ├── AlertsPanel.jsx
│       │   ├── LiveAttackFeed.jsx
│       │   ├── StatsPanel.jsx
│       │   ├── SystemStatus.jsx
│       │   └── ForensicsDrawer.jsx
│       ├── hooks/
│       │   ├── useSocket.js
│       │   └── [other hooks]
│       ├── pages/                   (14 pages)
│       │   ├── Landing.jsx          /
│       │   ├── Dashboard.jsx        /dashboard
│       │   ├── Attacks.jsx          /attacks
│       │   ├── ForensicsPage.jsx    /attacks/:id
│       │   ├── Alerts.jsx           /alerts
│       │   ├── Logs.jsx             /logs
│       │   ├── PcapAnalyzer.jsx     /pcap
│       │   ├── ActionQueuePage.jsx  /action-queue
│       │   ├── AuditLog.jsx         /audit
│       │   ├── Services.jsx         /services
│       │   ├── Settings.jsx         /settings
│       │   ├── Docs.jsx             /docs
│       │   ├── SimulateAttack.jsx   /simulate
│       │   └── NotFound.jsx         /*
│       └── services/
│           ├── api.js               reads VITE_API_URL (not hardcoded)
│           └── socket.js            reads VITE_SOCKET_URL (not hardcoded)
│
├── config/
│
├── demo-target/                     E2E harness — vulnerable Express app (:4000)
│   ├── server.js                    routes: / /users /login /search /file
│   ├── attack.sh
│   └── package.json
│
├── scripts/
│   ├── validate-env.sh              pre-deploy validator (16 checks)
│   ├── simulate_attack.py
│   └── simulate_attack.sh
│
└── services/
    ├── sentinal-response-engine/        SERVICE 4: Python/FastAPI :8004
    │   ├── main.py
    │   ├── intent_builder.py
    │   ├── openclaw_runtime.py
    │   ├── policy_engine.py
    │   ├── executor.py
    │   ├── audit_logger.py
    │   ├── models.py
    │   ├── policy.yaml
    │   ├── requirements.txt
    │   └── tests/test_enforcement.py  (7/7 pass)
    │
    ├── detection-engine/            SERVICE 3: Python/FastAPI :8002
    │   └── app/
    │       ├── main.py
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
    │           └── express.js
    │
    └── pcap-processor/              SERVICE 2: Python/FastAPI :8003
        ├── main.py
        ├── pcap_loader.py
        ├── packet_parser.py
        ├── flow_builder.py
        ├── attack_detector.py       8 attack detectors
        └── tests/                   (10/10 pass)
```
