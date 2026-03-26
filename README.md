# SENTINAL 🛡️

> Real-time web application security monitoring platform.
> One-line Express middleware → instant attack detection, forensics, and live dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-Express-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-FastAPI-blue)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-Vite-61dafb)](https://vitejs.dev)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-47A248)](https://www.mongodb.com/atlas)

---

## Overview

SENTINAL is a microservices-based security layer that wraps any Express.js application. It captures HTTP metadata, runs it through a multi-layer detection engine (rules + ML), surfaces threats in a live React dashboard, and can trigger autonomous remediation via the ArmorIQ agent.

---

## Architecture

```
Developer App  ──►  services/middleware  (npm package / one-liner)
                          │
                          ▼
         Service 1 — Gateway API          Node.js + Express + Socket.io  :3000
                          │
              ┌───────────┴──────────────┐
              ▼                          ▼
 Service 3 — Detection Engine       Service 2 — PCAP Processor
   Python + FastAPI  :8002            Python + Scapy  :8001
              │
              ▼
  Service 6 — Data Layer (MongoDB Atlas)
              │
    ┌─────────┴───────────┐
    ▼                     ▼
 Service 4 — Dashboard   Service 5 — ArmorIQ Agent
 React + Vite  :5173      Python + LangChain  :8003
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 18
- Python ≥ 3.10
- MongoDB Atlas cluster (or local instance)

### 1. Gateway / Backend

```bash
cd backend
cp .env.example .env
# Set MONGO_URI=mongodb+srv://.../<dbname>  (DB name must be: sentinal)
npm install
npm run dev
# Starts on http://localhost:3000
```

### 2. Seed Demo Data

```bash
# From repo root
node backend/scripts/seed.js
# Creates: 80 system logs, 50 attack events, proportional alerts
```

### 3. Detection Engine

```bash
cd services/detection-engine
pip install -r requirements.txt
uvicorn main:app --port 8002 --reload
```

### 4. Dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:5173
```

### 5. ArmorIQ Agent *(optional)*

```bash
cd services/armoriq-agent
pip install -r requirements.txt
uvicorn main:app --port 8003 --reload
```

### 6. PCAP Processor *(optional)*

```bash
cd services/pcap-processor
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

---

## Repository Layout

```
SENTINAL/
├── backend/                        # Service 1 — Gateway API (Node.js)
│   ├── server.js
│   ├── .env.example
│   ├── package.json
│   ├── doc/                        # API & architecture docs
│   ├── scripts/
│   │   └── seed.js
│   └── src/
│       ├── config/                 # DB & env config
│       ├── controllers/            # Route handlers
│       ├── middleware/             # Express middleware
│       ├── models/                 # Mongoose schemas
│       ├── routes/                 # API route definitions
│       ├── services/               # Business logic
│       ├── sockets/                # Socket.io event handlers
│       ├── tests/                  # Unit & integration tests
│       ├── utils/                  # Shared helpers
│       └── validators/             # Request validation
│
├── dashboard/                      # Service 4 — React Dashboard
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/             # Reusable UI components
│       ├── hooks/                  # Custom React hooks
│       ├── pages/                  # Page-level views
│       ├── services/               # API & Socket.io clients
│       ├── styles/                 # Global CSS / themes
│       └── utils/                  # Frontend helpers
│
├── services/
│   ├── detection-engine/           # Service 3 — Python/FastAPI ML engine
│   ├── armoriq-agent/              # Service 5 — LangChain remediation agent
│   ├── pcap-processor/             # Service 2 — Scapy PCAP forensics
│   └── middleware/                 # Express middleware package source
│
├── demo-target/                    # Sample vulnerable app for demos
├── scripts/                        # Repo-level helper scripts
├── MASTER_REFERENCE.md             # Full architecture & design reference
└── .gitignore
```

---

## API Reference (Gateway — port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/logs/ingest` | Ingest HTTP request metadata |
| GET | `/api/logs/recent` | Last 20 system logs |
| GET | `/api/attacks/recent` | Last 20 attack events |
| GET | `/api/attacks/:id/forensics` | Full forensic report for an attack |
| GET | `/api/stats` | Aggregate platform stats |
| GET | `/api/service-status` | Health of all microservices |
| GET | `/api/alerts` | Alert feed |
| PATCH | `/api/alerts/:id/read` | Mark an alert as read |
| GET | `/api/health` | Basic uptime check |

### Socket.io Events (same port 3000)

All events carry: `{ event: string, timestamp: string, data: {...} }`

| Event | Trigger |
|-------|---------|
| `attack:new` | New attack detected |
| `alert:new` | New high/critical alert created |
| `service:status` | Microservice health change |
| `stats:update` | Aggregate stats changed |

---

## Data Models

### AttackEvent
| Field | Values |
|-------|--------|
| `attackType` | `sqli` \| `xss` \| `traversal` \| `command_injection` \| `ssrf` \| `lfi_rfi` \| `brute_force` \| `hpp` \| `xxe` \| `webshell` \| `unknown` |
| `severity` | `low` \| `medium` \| `high` \| `critical` |
| `status` | `attempt` \| `successful` \| `blocked` |
| `detectedBy` | `rule` \| `ml` \| `both` |
| `confidence` | `0.0 – 1.0` |

### Alert
| Field | Values |
|-------|--------|
| `type` | `attack_detected` \| `service_down` \| `rate_limit` \| `anomaly` |
| `severity` | `low` \| `medium` \| `high` \| `critical` |

Alerts are auto-created for every `high` or `critical` attack event.

---

## Service Status

| Service | Tech | Port | Status |
|---------|------|------|--------|
| Gateway API | Node.js + Express + Socket.io | 3000 | ✅ Live |
| PCAP Processor | Python + Scapy | 8001 | 🚧 In Progress |
| Detection Engine | Python + FastAPI | 8002 | ✅ Live |
| ArmorIQ Agent | Python + LangChain | 8003 | 🚧 In Progress |
| React Dashboard | React + Vite | 5173 | ✅ Live |
| Data Layer | MongoDB Atlas | — | ✅ Live |

---

## Roadmap

- [ ] ArmorIQ Agent: action queue, human-in-the-loop approval flow
- [ ] PCAP Processor: full Scapy pipeline integration
- [ ] Detection Engine: fix `status` field (currently hardcoded `unknown`, should derive from `responseCode`)
- [ ] IP Intelligence: integrate AbuseIPDB + IPInfo into forensics controller
- [ ] MongoDB collections: `action_queue`, `audit_log`, `ip_intelligence`
- [ ] npm publish `services/middleware` as a standalone package

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push and open a Pull Request

---

## License

MIT © [Ayush Tiwari](https://ayusht.netlify.app/)
