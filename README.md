# SENTINAL

Real-time web application security monitoring platform.
One-line Express middleware → instant attack detection, forensics, and live dashboard.

---

## Architecture

```
Developer App (middleware)
        ↓
Service 1 — Gateway API        ✓  Node.js + Express + Socket.io  (port 3000)
        ↓
Service 3 — Detection Engine   ✓  Python + FastAPI                (port 8002)
        ↓
Service 6 — Data Layer         ✓  MongoDB Atlas
        ↓
Service 4 — React Dashboard    ✓  React + Vite                   (port 5173)
Service 5 — ArmorIQ Agent      ✗  Python + LangChain             (port 8003)
Service 2 — PCAP Processor     ✗  Python + Scapy                 (port 8001)
```

---

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI=mongodb+srv://.../<dbname>?... (must end with /sentinal)
npm install
npm run dev
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

---

## API Surface (Gateway — port 3000)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/logs/ingest | Ingest HTTP request metadata |
| GET | /api/logs/recent | Last 20 system logs |
| GET | /api/attacks/recent | Last 20 attack events |
| GET | /api/attacks/:id/forensics | Full forensic report |
| GET | /api/stats | Aggregate stats |
| GET | /api/service-status | Service health |
| GET | /api/alerts | Alert feed |
| PATCH | /api/alerts/:id/read | Mark alert read |
| GET | /api/health | Basic uptime check |

### Socket Events (Socket.io — same port 3000)

All events carry: `{ event: string, timestamp: string, data: {...} }`

| Event | Trigger |
|-------|---------|
| attack:new | New attack detected |
| alert:new | New high/critical alert created |
| service:status | Service health change |
| stats:update | Stats changed |

---

## Data Models

### AttackEvent
- `attackType`: sqli | xss | traversal | command_injection | ssrf | lfi_rfi | brute_force | hpp | xxe | webshell | unknown
- `severity`: low | medium | high | critical
- `status`: attempt | successful | blocked
- `detectedBy`: rule | ml | both
- `confidence`: 0.0 – 1.0

### Alert
- `type`: attack_detected | service_down | rate_limit | anomaly
- `severity`: low | medium | high | critical
- Auto-created for every high/critical attack

---

## Known Gaps (to build next)

- Service 5: ArmorIQ Agent (LangChain + action queue)
- Service 2: PCAP Processor (Scapy)
- Detection Engine: fix `status` field (currently hardcoded `unknown`, should use responseCode)
- IP Intelligence: integrate AbuseIPDB + IPInfo into forensicsController
- Collections not yet created: `action_queue`, `audit_log`, `ip_intelligence`

---

## Repository Layout

```
SENTINAL/
├── backend/
│   ├── server.js
│   ├── scripts/seed.js
│   └── src/
│       ├── controllers/
│       ├── models/
│       ├── routes/
│       ├── services/
│       ├── sockets/
│       └── utils/
├── dashboard/
│   ├── src/
│   │   ├── components/
│   │   ├── services/api.js
│   │   ├── services/socket.js
│   │   └── App.jsx
│   └── package.json
└── services/
    └── detection-engine/   (Python/FastAPI)
```
