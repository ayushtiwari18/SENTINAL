# SENTINAL 🛡️

> Real-time web application security monitoring platform.  
> Drop-in Express middleware → instant attack detection, forensics, and live dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-Express-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-FastAPI-blue)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-Vite-61dafb)](https://vitejs.dev)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_Atlas-47A248)](https://www.mongodb.com/atlas)
[![Postman Collection](https://img.shields.io/badge/Postman-Run%20Collection-FF6C37?logo=postman&logoColor=white)](https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/SENTINAL_Postman_Collection.json)

---

## 🚀 Test the API with Postman

**Import the full collection in one click:**

1. Open Postman → **Import**
2. Paste this URL:
```
https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/SENTINAL_Postman_Collection.json
```
3. Set up the `SENTINAL Production` environment with your EC2 IP:

| Variable | Value |
|---|---|
| `base` | `http://<YOUR_EC2_IP>:3000` |
| `detection` | `http://<YOUR_EC2_IP>:8002` |
| `pcap` | `http://<YOUR_EC2_IP>:8003` |
| `armoriq` | `http://<YOUR_EC2_IP>:8004` | (sentinal-response-engine)

> The collection includes 40+ requests across 8 folders: health checks, attack simulations, ArmorIQ enforcement tests, full pipeline triggers, human approval workflow, and an end-to-end demo sequence.

---

## Overview

SENTINAL is a microservices-based security layer that wraps any Express.js application. It captures HTTP metadata, runs it through a multi-layer detection engine (rule-based + adversarial decoder), surfaces threats in a live React dashboard, and triggers autonomous remediation via the **ArmorIQ** agent.

---

## Architecture

```
User Traffic
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Gateway API          Node.js + Express + Socket.io      │  :3000
│  backend/server.js                                       │
└──────────────┬───────────────────┬──────────────────────┘
               │                   │
               ▼                   ▼
  ┌────────────────────┐  ┌──────────────────────┐
  │  Detection Engine  │  │   PCAP Processor     │
  │  Python + FastAPI  │  │  Python + Scapy      │  :8003
  │  :8002             │  └──────────────────────┘
  └────────────────────┘
               │
               ▼
  ┌────────────────────┐    ┌──────────────────────┐
  │  MongoDB Atlas     │    │  SENTINAL Response   │
  │  (Data Layer)      │    │  Engine (FastAPI)    │  :8004
  └────────────────────┘    └──────────────────────┘
               │
               ▼
  ┌────────────────────┐
  │  Dashboard         │
  │  React + Vite      │  :5173
  └────────────────────┘
```

### Service Port Map

| Service | Tech | Port |
|---|---|---|
| Gateway API | Node.js + Express + Socket.io | **3000** |
| Detection Engine | Python + FastAPI | **8002** |
| PCAP Processor | Python + FastAPI + Scapy | **8003** |
| SENTINAL Response Engine (ArmorIQ) | Python + FastAPI | **8004** |
| React Dashboard | React + Vite | **5173** |
| Database | MongoDB Atlas | — |

---

## Prerequisites

- **Node.js** ≥ 18 — [nodejs.org](https://nodejs.org)
- **Python** ≥ 3.10 — [python.org](https://python.org)
- **PM2** — `npm install -g pm2`
- **MongoDB Atlas** free cluster — [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas/register)
- **Google Gemini API Key** *(optional — for ArmorIQ AI decisions)* — [aistudio.google.com](https://aistudio.google.com/app/apikey)

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd SENTINAL
```

### 2. Create your `.env` file

All 4 services read from **one single `.env` file at the project root**.

```bash
cp .env.example .env
```

Then open `.env` and fill in your values. The only fields you **must** change:

```bash
# Required — system will not start without these
MONGO_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/sentinel
JWT_SECRET=generate_a_long_random_string_here

# Optional but recommended for AI features
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Generate a secure JWT secret:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

### 3. Validate your environment

Before starting anything, check that all required variables are set:

```bash
chmod +x scripts/validate-env.sh
./scripts/validate-env.sh --env-only
```

You should see:
```
  ✓  MONGO_URI  =  mongodb+srv://user:****@cluster...
  ✓  JWT_SECRET length is 64 chars (good)
  ...
  ALL CHECKS PASSED — safe to deploy.
```

### 4. Start all services with one command

```bash
chmod +x start.sh stop.sh status.sh
./start.sh
```

This will:
1. Check `node`, `python3`, `pm2` are installed
2. Verify `.env` exists
3. Install Node dependencies if needed
4. Start all 4 services via PM2
5. Auto-run health checks after 6 seconds

### 5. Start the Dashboard

```bash
cd dashboard
npm install
npm run dev
# Open http://localhost:5173
```

---

## Service Management

### Start / Stop / Status

```bash
./start.sh          # start all services (production)
./start.sh --dev    # start all services (development mode)
./stop.sh           # stop all (keep in PM2 list)
./stop.sh --delete  # stop + remove from PM2
./status.sh         # check all health endpoints
```

### PM2 Commands

```bash
pm2 list                          # show all processes
pm2 logs                          # tail all logs live
pm2 logs sentinal-gateway         # tail one service
pm2 monit                         # live CPU + memory dashboard
pm2 restart ecosystem.config.js   # restart all
pm2 reload ecosystem.config.js    # zero-downtime reload
pm2 save                          # save process list
pm2 startup                       # auto-start on server reboot
```

### Auto-start on Server Reboot

```bash
pm2 save
pm2 startup    # follow the printed command (requires sudo)
```

---

## Manual Setup (without PM2)

If you prefer to run services manually in separate terminals:

**Terminal 1 — Gateway**
```bash
cd backend
npm install
node server.js
```

**Terminal 2 — Detection Engine**
```bash
cd services/detection-engine
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

**Terminal 3 — PCAP Processor**
```bash
cd services/pcap-processor
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8003
```

**Terminal 4 — SENTINAL Response Engine (ArmorIQ)**
```bash
cd services/sentinal-response-engine
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8004
```

> Each Python service auto-reads the root `.env` file via `python-dotenv`.

---

## Health Checks

Every service exposes a `/health` endpoint. Check them after starting:

```bash
./status.sh

# Or manually:
curl http://localhost:3000/health    # Gateway
curl http://localhost:8002/health    # Detection Engine
curl http://localhost:8003/health    # PCAP Processor
curl http://localhost:8004/health    # SENTINAL Response Engine (ArmorIQ)
```

All return the same standard shape:
```json
{
  "status":  "ok",
  "service": "gateway",
  "uptime":  143
}
```

> The full `/api/health` endpoint on the gateway also includes DB status, memory usage, and service URLs.

---

## Seed Demo Data

```bash
node backend/scripts/seed.js
# Creates: 80 system logs, 50 attack events, proportional alerts
```

---

## Repository Layout

```
SENTINAL/
├── .env.example                    ← copy to .env and fill in values
├── .env                            ← YOUR secrets (never commit)
├── ecosystem.config.js             ← PM2 process config (all 4 services)
├── start.sh                        ← start all services
├── stop.sh                         ← stop all services
├── status.sh                       ← check all health endpoints
├── SENTINAL_Postman_Collection.json ← Postman collection (import this)
│
├── config/
│   └── envValidator.js             ← startup env guard (exits if vars missing)
│
├── backend/                        ← Gateway API (Node.js)
│   ├── server.js
│   ├── package.json
│   └── src/
│       ├── config/                 ← DB connection
│       ├── controllers/            ← Route handlers
│       ├── middleware/             ← Rate limiter, auth
│       ├── models/                 ← Mongoose schemas
│       ├── routes/                 ← API route definitions
│       ├── services/               ← Business logic, service connectors
│       ├── sockets/                ← Socket.io event handlers
│       ├── tests/                  ← Unit & integration tests
│       └── utils/                  ← Logger, helpers
│
├── services/
│   ├── detection-engine/           ← Python FastAPI — rule-based + adversarial detection
│   ├── sentinal-response-engine/   ← Python FastAPI — ArmorIQ policy enforcement
│   ├── pcap-processor/             ← Python FastAPI + Scapy — PCAP forensics
│   └── middleware/                 ← Express middleware package source
│
├── dashboard/                      ← React + Vite frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── services/               ← API + Socket.io clients
│
├── scripts/
│   ├── validate-env.sh             ← pre-deploy env + health validator
│   ├── simulate_attack.sh          ← attack simulation (demo)
│   └── simulate_attack.py
│
├── demo-target/                    ← Sample vulnerable app for demos
└── logs/                           ← PM2 log output (git-ignored)
```

---

## API Reference (Gateway — port 3000)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Liveness probe (no DB required — for AWS ALB) |
| GET | `/api/health` | Full health: DB status + memory + service URLs |
| POST | `/api/logs/ingest` | Ingest HTTP request metadata |
| GET | `/api/attacks/recent` | Last 20 attack events |
| GET | `/api/attacks/search?q=` | Full-text search attacks |
| GET | `/api/attacks/:id/forensics` | Full forensic report for an attack |
| POST | `/api/nexus/trigger` | Manually trigger full attack pipeline (returns 201) |
| GET | `/api/stats` | Aggregate platform stats |
| GET | `/api/service-status` | Health of all microservices |
| GET | `/api/alerts` | Alert feed |
| PATCH | `/api/alerts/:id/read` | Mark an alert as read |
| POST | `/api/pcap/upload` | Upload `.pcap` / `.pcapng` for analysis |
| GET | `/api/audit` | Audit log of ArmorIQ decisions |
| GET | `/api/actions/pending` | Pending human-approval actions |
| POST | `/api/actions/:id/approve` | Approve a blocked action (HUMAN_OVERRIDE) |
| POST | `/api/actions/:id/reject` | Reject a blocked action |

### Socket.io Events (port 3000)

| Event | Trigger |
|---|---|
| `attack:new` | New attack detected |
| `alert:new` | New high/critical alert created |
| `service:status` | Microservice health change |
| `stats:update` | Aggregate stats changed |

---

## Data Models

### AttackEvent

| Field | Values |
|---|---|
| `attackType` | `sqli` \| `xss` \| `traversal` \| `command_injection` \| `ssrf` \| `lfi_rfi` \| `brute_force` \| `hpp` \| `xxe` \| `webshell` \| `recon` \| `ddos` \| `unknown` |
| `severity` | `low` \| `medium` \| `high` \| `critical` |
| `status` | `attempt` \| `successful` \| `blocked` |
| `detectedBy` | `rule` \| `ml` \| `both` |
| `confidence` | `0.0 – 1.0` |

### Alert

| Field | Values |
|---|---|
| `type` | `attack_detected` \| `service_down` \| `rate_limit` \| `anomaly` |
| `severity` | `low` \| `medium` \| `high` \| `critical` |

---

## Environment Variables Reference

See [`.env.example`](.env.example) for the full annotated list.

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | ✅ | MongoDB Atlas connection string |
| `GATEWAY_PORT` | ✅ | Express Gateway port (default: 3000) |
| `DETECTION_PORT` | ✅ | Detection Engine port (default: 8002) |
| `PCAP_PORT` | ✅ | PCAP Processor port (default: 8003) |
| `ARMORIQ_PORT` | ✅ | SENTINAL Response Engine port (default: 8004) |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `DETECTION_URL` | ✅ | Internal URL of Detection Engine |
| `PCAP_URL` | ✅ | Internal URL of PCAP Processor |
| `ARMORIQ_URL` | ✅ | Internal URL of SENTINAL Response Engine |
| `GATEWAY_URL` | ✅ | Gateway URL (used by ArmorIQ to call back) |
| `GEMINI_API_KEY` | ⚠️ | Google Gemini key for ArmorIQ AI decisions |
| `NODE_ENV` | ⚠️ | `development` \| `production` \| `test` |
| `LOG_LEVEL` | ⚠️ | `error` \| `warn` \| `info` \| `debug` |

> **The system will refuse to start** if any ✅ variable is missing, printing a clear error message with the exact fix. See [`config/envValidator.js`](config/envValidator.js).

---

## Troubleshooting

**Gateway won’t start — "Missing Environment Variables"**
```bash
./scripts/validate-env.sh --env-only
# Shows exactly which variables are missing
```

**Services start but detection isn’t working**
```bash
./status.sh
# Check which service is returning non-200
pm2 logs sentinal-detection   # see Python error
```

**Port already in use**
```bash
lsof -i :8002        # find what’s using the port
# Change DETECTION_PORT in .env, then ./stop.sh && ./start.sh
```

**PM2 processes keep restarting**
```bash
pm2 logs             # see crash reason
pm2 monit            # live monitor
```

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Validate before pushing: `./scripts/validate-env.sh --env-only`
5. Push and open a Pull Request

---

## License

MIT © [Ayush Tiwari](https://ayusht.netlify.app/)
