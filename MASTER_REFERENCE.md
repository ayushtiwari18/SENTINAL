# SENTINAL — Master Reference Document

> **Version:** 7.0 · **Date:** 2026-03-27 · **Status:** Living document — single source of truth
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
14. [Production Deployment — AWS EC2 (Full Guide)](#14-production-deployment)
15. [Changelog](#15-changelog)
16. [MongoDB Atlas Track](#16-mongodb-atlas-track)

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
│  full pipeline │  │  HTTP-status layer    │  │  openclaw_runtime.py     │
│  10/10 tests ✅│  │  ML optional          │  │  policy_engine.py (fbck) │
└────────────────┘  └───────────────────────┘  │  executor.py             │
                                               │  audit_logger.py         │
                                               │  models.py               │
                                               │  policy.yaml             │
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
  intent_builder.py  →  builds 5–6 ProposedAction intents per attack
         │
  openclaw_runtime.py  ← PRIMARY (reads policy.yaml)
    RULE_001: action in blocked_actions  → BLOCK
    RULE_002: risk_level == 'critical'   → BLOCK
    RULE_003: risk_level == 'high'       → BLOCK
    RULE_004: action in allowed_actions  → ALLOW
    RULE_DEFAULT: no match              → BLOCK (fail-safe)
    on crash → policy_engine.py fallback
         │
  ┌──────┴──────────────────────┐
  │ ALLOW                       │ BLOCK
  │ executor.py fires           │ ActionQueue.create() → MongoDB
  │ emit(audit:new)             │ emit(action:pending) + emit(audit:new)
  └─────────────────────────────┘
         │
  audit_logger.py → POST /api/audit/ingest → AuditLog saved
```

---

## 2. Exact Repo Structure

```
SENTINAL/
├── .env                             ← NOT committed (gitignored). See §14 for values.
├── .env.example                     template for all env vars
├── .gitignore
├── README.md
├── MASTER_REFERENCE.md              ← this file (only doc)
├── ecosystem.config.js              PM2 process manager config (all 4 services)
├── start.sh  /  stop.sh  /  status.sh
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
│       ├── models/                  (6 models)
│       ├── routes/                  (11 route files)
│       ├── services/                (5 services)
│       ├── sockets/broadcastService.js
│       ├── tests/                   (8 test files)
│       └── utils/
│
├── dashboard/                       SERVICE 5: React SPA (Vite :5173)
│   ├── .env.production              VITE_API_URL + VITE_SOCKET_URL
│   ├── vite.config.js
│   └── src/
│       ├── components/              (8 components)
│       ├── hooks/                   (3 hooks)
│       ├── pages/                   (13 pages)
│       └── services/
│           ├── api.js               reads VITE_API_URL (not hardcoded)
│           └── socket.js            reads VITE_SOCKET_URL (not hardcoded)
│
├── config/
├── demo-target/                     E2E harness (Express :4000)
│
├── scripts/
│   ├── validate-env.sh              pre-deploy validator (16 checks)
│   ├── simulate_attack.py
│   └── simulate_attack.sh
│
└── services/
    ├── armoriq-agent/               SERVICE 4: Python/FastAPI :8004
    │   ├── main.py  intent_builder.py  openclaw_runtime.py
    │   ├── policy_engine.py  executor.py  audit_logger.py
    │   ├── models.py  policy.yaml  requirements.txt
    │   └── tests/test_enforcement.py
    │
    ├── detection-engine/            SERVICE 3: Python/FastAPI :8002
    │   └── app/
    │       ├── main.py  rules.py  adversarial.py
    │       └── [classifier.py]  (ML optional)
    │
    ├── middleware/                  npm package: sentinel-middleware
    │   └── src/  (index.js  config.js  sender.js  adapters/)
    │
    └── pcap-processor/              SERVICE 2: Python/FastAPI :8003
        ├── main.py  pcap_loader.py  packet_parser.py
        ├── flow_builder.py  attack_detector.py
        └── tests/
```

---

## 3. Service Registry

| Service | Language | Port | Status | Entry Point |
|---------|----------|------|--------|-------------|
| Gateway API | Node.js + Express | 3000 | ✅ LIVE (prod) | `backend/server.js` |
| PCAP Processor | Python + FastAPI | 8003 | ✅ LIVE (prod) | `services/pcap-processor/main.py` |
| Detection Engine | Python + FastAPI | 8002 | ✅ LIVE (prod) | `services/detection-engine/app/main.py` |
| ArmorIQ Agent | Python + FastAPI | 8004 | ✅ LIVE (prod) | `services/armoriq-agent/main.py` |
| React Dashboard | Vite + React | 5173 | ✅ LIVE (prod) | `dashboard/src/main.jsx` |
| sentinel-middleware | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| Demo Target | Node.js + Express | 4000 | ✅ WORKING | `demo-target/server.js` |
| MongoDB Atlas | Cloud (SRV) | — | ✅ LIVE (prod) | `backend/src/config/database.js` |

---

## 4. Complete Request Lifecycle

### Flow A — Live Request via Middleware

```
1.  User hits app → sentinel-middleware captures res.on('finish') async
2.  POST /api/logs/ingest → SystemLog saved to MongoDB
3.  setImmediate() → detectionConnector → POST :8002/analyze
4.  threat_detected = false → stop.
    threat_detected = true:
      AttackEvent.create() → emit(attack:new)
      IF high/critical: Alert.create() → emit(alert:new)
      callArmorIQ() [async] → POST :8004/respond
5.  ArmorIQ: openclaw_runtime evaluates each intent
      ALLOW → executor.py fires → audit entry
      BLOCK → ActionQueue.create() → emit(action:pending) → audit entry
6.  Human: /action-queue → APPROVE/REJECT → AuditLog(HUMAN_OVERRIDE)
```

### Flow B — PCAP Upload
```
POST /api/pcap/upload → POST :8003/process
→ pcap_loader → packet_parser → flow_builder → attack_detector
→ AttackEvent.create() per attack → emit(attack:new)
```

### Flow C — Direct ArmorIQ Trigger (Demo)
```
POST /api/armoriq/trigger → reportAttack() → full pipeline (Flow A steps 4–6)
```

---

## 5. API Contracts — Every Live Route

### Gateway (`:3000`) — all responses use envelope (§12)

```
POST /api/logs/ingest
Body: { projectId, method, url, ip, queryParams?, body?, headers?,
        responseCode?, processingTimeMs? }
⚠️  EXACT FIELDS ONLY — Joi strict mode. No userAgent, no extra fields.
Response 201: { success:true, data:{ id:ObjectId } }

GET  /api/attacks/recent?limit=50
GET  /api/attacks/:id/forensics
GET  /api/attacks/search?q=<term>&limit=20&page=1
GET  /api/attacks/search/stats

GET   /api/alerts?limit=50
PATCH /api/alerts/:id/read
POST  /api/alerts/armoriq        ← ArmorIQ executor only

GET  /api/actions/pending
POST /api/actions/:id/approve   Body: { approvedBy: string }
POST /api/actions/:id/reject    Body: { rejectedBy: string }

GET  /api/audit?limit=100
POST /api/audit/ingest          ← audit_logger.py only

POST /api/armoriq/trigger       Body: { ip?, attackType?, severity?, confidence?, status? }
POST /api/pcap/upload           multipart: field "pcap" + field "projectId"
GET  /api/stats
GET  /api/service-status
GET  /api/logs/recent?limit=50
GET  /health
```

### Detection Engine (`:8002`)
```
POST /analyze   Body: { logId, projectId, method, url, ip, queryParams, body, headers, responseCode }
GET  /health
```

### ArmorIQ Agent (`:8004`)
```
POST /respond   Body: { attackId, ip, attackType, severity, status, confidence }
GET  /health    → { openclaw_loaded:bool, enforcement:'ArmorClaw-v1' }
```

### PCAP Processor (`:8003`)
```
POST /process   Body: { filepath:string, projectId:string }
GET  /health
```

---

## 6. OpenClaw Enforcement Architecture

| File | Role |
|------|------|
| `main.py` | FastAPI app — `_evaluate_with_fallback()` per intent |
| `intent_builder.py` | Builds 5–6 `IntentModel` objects per attack |
| `openclaw_runtime.py` | **PRIMARY** — loads `policy.yaml`, RULE_001→004→DEFAULT |
| `policy_engine.py` | **FALLBACK** — hardcoded rules, used if openclaw_runtime crashes |
| `executor.py` | Fires ALLOW decisions (HTTP 200/201 check, no raise_for_status) |
| `audit_logger.py` | POSTs every decision to `/api/audit/ingest` |
| `policy.yaml` | Declarative: allowed_actions, blocked_actions, risk_rules, default:BLOCK |

### `policy_rule_id` enum
| Rule | Fires when |
|------|------------|
| `RULE_001` | action in `blocked_actions` |
| `RULE_002` | `risk_level == 'critical'` |
| `RULE_003` | `risk_level == 'high'` |
| `RULE_004` | action in `allowed_actions` |
| `RULE_DEFAULT` | nothing matched — fail-safe BLOCK |
| `HUMAN_OVERRIDE` | human approved/rejected via Dashboard |

---

## 7. MongoDB Schema — All 6 Collections

```
systemlogs:     { projectId*, timestamp*, method, url, queryParams, body, headers, ip*, responseCode, processingTimeMs }
attackevents:   { requestId*, timestamp*, ip*, attackType*, severity*, status*, detectedBy, confidence, payload, explanation, mitigationSuggestion }
alerts:         { attackId*, title, message, severity, type, isRead, resolvedAt, meta }
action_queue:   { attackId(String)*, action*, status*, agentReason, blockedReason, ip, approvedBy, approvedAt }
audit_log:      { intent_id, action, status*, triggeredBy, ip*, attackId(String), policy_rule_id, enforcement_level, reason, meta }
servicestatuses:{ serviceName(unique), status, lastChecked, responseTimeMs, errorMessage }
```
`*` = indexed  |  `audit_log` = singular (NOT `audit_logs`)  |  `attackId` = plain String in action_queue + audit_log

---

## 8. Canonical Field Registry

### `attackType` enum
`sqli` · `xss` · `traversal` · `command_injection` · `ssrf` · `lfi_rfi` · `brute_force` · `hpp` · `xxe` · `webshell` · `recon` · `ddos` · `unknown`

### ArmorIQ Action enum + Policy
| Action | Policy | Rule |
|--------|--------|------|
| `send_alert` / `log_attack` / `rate_limit_ip` / `flag_for_review` / `generate_report` | ALLOW | RULE_004 |
| `permanent_ban_ip` / `shutdown_endpoint` / `purge_all_sessions` / `modify_firewall_rules` | BLOCK | RULE_001 |

---

## 9. Build Status

### ✅ COMPLETE & VERIFIED (2026-03-27 production)
| Feature | Evidence |
|---------|----------|
| Gateway API — 11 route files | All routes respond correctly |
| MongoDB — 6 models | 125+ logs, 77+ attacks in production |
| Socket.io — 6 events | Live dashboard confirmed |
| Detection pipeline | sqli/xss/traversal/command_injection classified |
| PCAP Processor | 10/10 tests pass |
| ArmorIQ + OpenClaw | 7/7 pytest pass, live enforcement confirmed |
| React Dashboard — 10 pages | Live data, no Network Error |
| PM2 — 5 services | All online, saved, auto-restart enabled |
| AWS EC2 deployment | All services live at 44.201.147.239 |
| MongoDB Atlas | IP allowlisted to EC2, Atlas Search live |
| validate-env.sh | 16/16 checks pass |

### 🟡 PARTIAL
| Feature | What's Missing |
|---------|----------------|
| Detection Engine | `sentinel_v5.pkl` ML model |
| Gemini integration | Real `GEMINI_API_KEY` |
| Dashboard Charts | Recharts donut + timeline not wired |

### 🔲 NOT BUILT
`sentinel_v5.pkl` (P0) · Dashboard charts (P1) · Threat Intelligence (P1) · Nginx + HTTPS (P1) · CSV export (P2)

---

## 10. Port & URL Map + Start Commands

### Local Development
| Service | Port | Command |
|---------|------|---------|
| Gateway | 3000 | `cd backend && npm run dev` |
| Detection Engine | 8002 | `cd services/detection-engine && source .venv/bin/activate && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `cd services/pcap-processor && source .venv/bin/activate && uvicorn main:app --port 8003` |
| ArmorIQ Agent | 8004 | `cd services/armoriq-agent && source .venv/bin/activate && uvicorn main:app --port 8004` |
| Dashboard | 5173 | `cd dashboard && npm run dev` |

### Production (current live)
| Service | Port | Public URL |
|---------|------|------------|
| Gateway | 3000 | `http://44.201.147.239:3000` |
| Detection Engine | 8002 | `http://44.201.147.239:8002` |
| PCAP Processor | 8003 | `http://44.201.147.239:8003` |
| ArmorIQ Agent | 8004 | `http://44.201.147.239:8004` |
| Dashboard | 5173 | `http://44.201.147.239:5173` |

---

## 11. Socket.io Events Reference

| Event | Emitted by | Payload |
|-------|-----------|--------|
| `attack:new` | attackService | `{ id, ip, attackType, severity, status, detectedBy, confidence, timestamp }` |
| `alert:new` | attackService | `{ id, title, severity, type, timestamp }` |
| `action:pending` | actionQueueController | `{ id, action, agentReason, blockedReason, ip, attackId }` |
| `audit:new` | auditController | `{ id, action, status, reason, policy_rule_id, triggeredBy, ip, attackId, timestamp }` |
| `service:status` | serviceHealthService | `{ serviceName, status, responseTimeMs, timestamp }` |
| `stats:update` | statsService | stats payload |

---

## 12. Response Envelope Standard

```js
{ success: true,  message: string, data: object | array }  // success
{ success: false, message: string, code: string }          // error
// code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
```
`api.js` unwraps with `res => res.data.data`. Arrays come as `{ data:[] }` — use `r.data.length` not `r.length`.

---

## 13. Demo Day Guide

### Health Check
```bash
./status.sh   # production
# or individually:
curl http://localhost:3000/health
curl http://localhost:8004/health   # must show openclaw_loaded:true
```

### Ingest Test
```bash
curl -s -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"projectId":"demo","method":"GET","url":"/search?q=<script>alert(1)</script>",
       "ip":"1.2.3.4","headers":{},"queryParams":{},"body":{}}'
```

### ArmorIQ Demo — ALLOW (medium severity)
```bash
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-1","ip":"5.5.5.5","attackType":"sqli","severity":"medium","confidence":0.9,"status":"attempt"}'
# actionsExecuted: [send_alert, log_attack, rate_limit_ip]
```

### ArmorIQ Demo — BLOCK (critical severity)
```bash
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-2","ip":"6.6.6.6","attackType":"brute_force","severity":"critical","confidence":0.97,"status":"successful"}'
# actionsQueued: [permanent_ban_ip(BLOCK), shutdown_endpoint(BLOCK)]
```

### Full E2E
```bash
bash demo-target/attack.sh
# Watch: http://44.201.147.239:5173
```

### Judge Pitch
> *"SENTINEL detects threats in real time and enforces responses through OpenClaw —
> reading from policy.yaml. Safe actions like send_alert execute automatically.
> Dangerous actions like permanent_ban_ip are blocked and queued for human approval.
> Every decision is logged with the exact policy rule that fired it."*

---

## 14. Production Deployment — AWS EC2 (Full Guide)

This is the complete step-by-step guide to deploy SENTINAL on a **fresh AWS EC2 Ubuntu instance** from your local machine using a `.pem` key.

---

### PART A — AWS Console: Launch EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com) → **EC2** → **Launch Instance**
2. **Name:** `sentinal-server`
3. **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
4. **Instance type:** `t2.medium` (minimum — needs RAM for 4 Python services)
5. **Key pair:**
   - Click **Create new key pair**
   - Name: `sentinal-key`
   - Type: RSA, Format: `.pem`
   - Click **Create** — downloads `sentinal-key.pem` to your machine
6. **Security Group** — Add these inbound rules:

| Type | Port | Source |
|------|------|--------|
| SSH | 22 | My IP (or 0.0.0.0/0 for dev) |
| Custom TCP | 3000 | 0.0.0.0/0 |
| Custom TCP | 5173 | 0.0.0.0/0 |
| Custom TCP | 8002 | 0.0.0.0/0 |
| Custom TCP | 8003 | 0.0.0.0/0 |
| Custom TCP | 8004 | 0.0.0.0/0 |

7. **Storage:** 20 GB gp3
8. Click **Launch Instance**
9. Wait ~2 min → copy the **Public IPv4 address** (e.g. `44.201.147.239`)

---

### PART B — Local Machine: Connect via SSH

**On Windows (PowerShell) or Mac/Linux Terminal:**

```bash
# Step 1 — Fix .pem permissions (required on Mac/Linux)
chmod 400 ~/Downloads/sentinal-key.pem

# Step 2 — SSH into the instance
ssh -i ~/Downloads/sentinal-key.pem ubuntu@44.201.147.239

# If on Windows (PowerShell), use:
ssh -i C:\Users\YourName\Downloads\sentinal-key.pem ubuntu@44.201.147.239

# You should see:
# ubuntu@ip-172-31-xx-xx:~$
```

> **Tip:** If you get `WARNING: UNPROTECTED PRIVATE KEY FILE` on Windows,
> right-click the .pem → Properties → Security → Advanced → Remove all inherited permissions,
> add only your user with Read access.

---

### PART C — EC2: Install System Dependencies

Run all of these on the EC2 server after SSH:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should show v20.x
npm --version    # should show 10.x

# Install Python 3.11 + venv + pip
sudo apt install -y python3.11 python3.11-venv python3-pip python3-dev
python3 --version   # should show Python 3.11.x

# Install build tools (needed for some Python packages)
sudo apt install -y build-essential libssl-dev libffi-dev

# Install libpcap (needed for PCAP Processor)
sudo apt install -y libpcap-dev

# Install PM2 globally
sudo npm install -g pm2

# Install serve globally (for dashboard static files)
sudo npm install -g serve

# Verify PM2
pm2 --version   # should show 5.x
```

---

### PART D — EC2: Clone the Repo

```bash
cd ~
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd ~/SENTINAL
ls
# Should see: backend  dashboard  services  scripts  ecosystem.config.js  etc.
```

---

### PART E — EC2: Set Up Python Virtual Environments

Each Python service needs its own venv. Run all of these:

```bash
# ── Detection Engine ──────────────────────────────────────────────────
cd ~/SENTINAL/services/detection-engine
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# ── PCAP Processor ────────────────────────────────────────────────────
cd ~/SENTINAL/services/pcap-processor
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# ── ArmorIQ Agent ─────────────────────────────────────────────────────
cd ~/SENTINAL/services/armoriq-agent
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# Verify venvs exist:
ls ~/SENTINAL/services/detection-engine/.venv/bin/python3
ls ~/SENTINAL/services/pcap-processor/.venv/bin/python3
ls ~/SENTINAL/services/armoriq-agent/.venv/bin/python3
```

---

### PART F — EC2: Install Node.js Dependencies

```bash
# Backend (Gateway API)
cd ~/SENTINAL/backend
npm install --omit=dev

# Dashboard
cd ~/SENTINAL/dashboard
npm install
```

---

### PART G — EC2: Configure Environment

```bash
cd ~/SENTINAL

# Create .env from template
cp .env.example .env

# Generate JWT_SECRET (copy the output)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate API_SECRET (run again, different value)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Open .env and fill in values
nano .env
```

**Required values to fill in `.env`:**

```bash
# ── Core
NODE_ENV=production
LOG_LEVEL=info
PUBLIC_URL=http://<YOUR_EC2_PUBLIC_IP>

# ── Ports (keep as-is)
GATEWAY_PORT=3000
DETECTION_PORT=8002
PCAP_PORT=8003
ARMORIQ_PORT=8004

# ── Internal URLs (keep as localhost)
DETECTION_URL=http://localhost:8002
PCAP_URL=http://localhost:8003
ARMORIQ_URL=http://localhost:8004
GATEWAY_URL=http://localhost:3000

# ── Database  ← MOST IMPORTANT
# Get from: MongoDB Atlas → your cluster → Connect → Drivers → copy SRV string
MONGO_URI=mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/sentinal
#          ⚠️ MUST be MONGO_URI — not MONGO_URL

# ── Secrets  ← paste the two hex strings you generated above
JWT_SECRET=<paste 64-char hex here>
API_SECRET=<paste 64-char hex here>

# ── Optional
GEMINI_API_KEY=none
```

**Save** (`Ctrl+O`, `Enter`, `Ctrl+X`) then validate:

```bash
chmod +x ~/SENTINAL/scripts/validate-env.sh
./scripts/validate-env.sh --env-only
# Must show: ✓ 16 passed   ✖ 0 failed   ALL CHECKS PASSED
```

---

### PART H — EC2: Configure Dashboard for Production

The dashboard `.env.production` is already in the repo with the current EC2 IP.
If deploying to a **different IP**, update it:

```bash
nano ~/SENTINAL/dashboard/.env.production
```

```bash
VITE_API_URL=http://<YOUR_EC2_PUBLIC_IP>:3000
VITE_SOCKET_URL=http://<YOUR_EC2_PUBLIC_IP>:3000
```

Then build the dashboard:

```bash
cd ~/SENTINAL/dashboard
npm run build
# Creates dashboard/dist/ — static files served by PM2+serve
```

---

### PART I — EC2: Start All Services with PM2

```bash
cd ~/SENTINAL

# Create logs directory
mkdir -p logs

# Start all 4 backend services (uses ecosystem.config.js)
pm2 start ecosystem.config.js

# Start dashboard (serves built static files)
pm2 start "serve -s dist -l 5173" --name sentinal-dashboard --cwd ~/SENTINAL/dashboard

# Check all are online
pm2 list
```

**Expected output:**
```
┌────┬────────────────────┬──────┬───────────┬──────────┐
│ id │ name               │ ↺    │ status    │ memory   │
├────┼────────────────────┼──────┼───────────┼──────────┤
│ 0  │ sentinal-gateway   │ 0    │ online    │ ~80mb    │
│ 1  │ sentinal-detection │ 0    │ online    │ ~50mb    │
│ 2  │ sentinal-pcap      │ 0    │ online    │ ~70mb    │
│ 3  │ sentinal-armoriq   │ 0    │ online    │ ~60mb    │
│ 4  │ sentinal-dashboard │ 0    │ online    │ ~10mb    │
└────┴────────────────────┴──────┴───────────┴──────────┘
```

---

### PART J — EC2: Enable Auto-Start on Reboot

```bash
# Save current process list
pm2 save

# Generate systemd startup script
pm2 startup
# It prints a command like:
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# COPY that exact command and run it
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Save again after running the sudo command
pm2 save
```

---

### PART K — Verify Full Deployment

```bash
# 1. Full health check
./status.sh
# Expected: ✓ Gateway HTTP 200  ✓ Detection HTTP 200  ✓ PCAP HTTP 200  ✓ ArmorIQ HTTP 200

# 2. Test log ingest + attack detection
curl -s -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"projectId":"prod-test","method":"GET",
       "url":"/search?q=<script>alert(1)</script>",
       "ip":"1.2.3.4","headers":{},"queryParams":{},"body":{}}' \
  | python3 -m json.tool
# Expected: { "success": true, "data": { "id": "..." } }

# 3. Verify from your local machine (replace with your EC2 IP)
curl http://44.201.147.239:3000/health
curl http://44.201.147.239:8002/health
curl http://44.201.147.239:8003/health
curl http://44.201.147.239:8004/health

# 4. Open dashboard in browser
# http://44.201.147.239:5173
```

---

### PART L — MongoDB Atlas: Whitelist EC2 IP

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Your project → **Network Access** → **IP Access List**
3. Click **Edit** on `0.0.0.0/0` (if it exists) → **Delete** it
4. Click **Add IP Address** → enter `44.201.147.239` → **Confirm**
5. Wait ~30 seconds for it to apply
6. Test connection: `./scripts/validate-env.sh --env-only` should still pass

---

### PART M — Day-to-Day Operations

```bash
# View all processes
pm2 list

# Tail logs for a specific service
pm2 logs sentinal-gateway
pm2 logs sentinal-detection
pm2 logs sentinal-armoriq

# Last 50 lines from all services (no tail)
pm2 logs --lines 50 --nostream

# Restart one service
pm2 restart sentinal-gateway

# Restart everything
pm2 restart all

# Stop everything
pm2 stop all

# Full health check
./status.sh

# After git pull + code changes:
git pull origin main
cd ~/SENTINAL/dashboard && npm run build
pm2 restart all
pm2 save
```

---

### Current Infrastructure

| Item | Value |
|------|-------|
| Provider | AWS EC2 |
| Instance type | Ubuntu 22.04 LTS |
| Public IP | `44.201.147.239` |
| Internal hostname | `ip-172-31-84-131` |
| Process manager | PM2 v5 |
| MongoDB | Atlas cloud — `cluster0.lenxm5v.mongodb.net` |
| Atlas IP allowlist | `44.201.147.239` only |
| Dashboard URL | `http://44.201.147.239:5173` |

### Known Issues Fixed During This Deployment

| Issue | Fix |
|-------|-----|
| `validate-env.sh` broken `cd` on line 30 | Rewrote script with correct `$(dirname "${BASH_SOURCE[0]}")/..` |
| `.env` had `MONGO_URL` instead of `MONGO_URI` | Renamed — Joi validator requires exact name `MONGO_URI` |
| `api.js` hardcoded `baseURL: 'http://localhost:3000'` | Now reads `import.meta.env.VITE_API_URL` |
| `socket.js` hardcoded `GATEWAY_URL = 'http://localhost:3000'` | Now reads `import.meta.env.VITE_SOCKET_URL` |
| `ecosystem.config.js` partially corrupted | Fully rewritten with correct `.venv` Python paths |
| Dashboard showing `Network Error` in prod | Fixed by adding `dashboard/.env.production` with EC2 IP |

---

## 15. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | ArmorIQ Agent + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Fix1: typed Pydantic models + dot-access. Fix2: executor safe HTTP. Fix3: audit:new socket event. Demo Target E2E |
| 2026-03-26 | 4.0 | openclaw_runtime.py + policy.yaml added. 4 redundant doc files deleted |
| 2026-03-27 | 5.0 | MongoDB Atlas Track: Atlas Search, $facet aggregation, all 6 collections verified |
| 2026-03-27 | 6.0 | Production deployment on AWS EC2: PM2, env fixes, dashboard API URL fix, Atlas IP allowlist |
| 2026-03-27 | 7.0 | **Full AWS EC2 deploy guide** added (Parts A–M): .pem key, EC2 launch, Security Group, apt install, Python venvs, npm install, .env setup, validate-env, dashboard build, PM2 start + startup + save, MongoDB Atlas IP allowlist, day-to-day commands |

---

## 16. MongoDB Atlas Track

### Connection — `backend/src/config/database.js`
- URI from `process.env.MONGO_URI` — fails fast if missing
- Retry: 3 attempts × 3s delay
- Options: `serverSelectionTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:10`
- Graceful shutdown: `SIGINT`/`SIGTERM` → `mongoose.connection.close()`

### Atlas Search Index
- **Name:** `attackevents_search` on collection `attackevents`
- **Fields:** `payload` (standard), `ip` (keyword), `attackType` (keyword), `explanation` (standard), `mitigationSuggestion` (standard)
- **Endpoint:** `GET /api/attacks/search?q=<term>` — auto-falls back to `$regex` if index not provisioned

```json
{
  "mappings": { "dynamic": false, "fields": {
    "payload":              { "type": "string", "analyzer": "lucene.standard" },
    "ip":                   { "type": "string", "analyzer": "lucene.keyword" },
    "attackType":           { "type": "string", "analyzer": "lucene.keyword" },
    "explanation":          { "type": "string", "analyzer": "lucene.standard" },
    "mitigationSuggestion": { "type": "string", "analyzer": "lucene.standard" }
  }},
  "name": "attackevents_search"
}
```

### Live Production Evidence (2026-03-27)
```
./status.sh                           → 16 passed, 0 warnings, 0 failed
GET /health (all 4 services)          → HTTP 200, uptime confirmed
POST /api/logs/ingest (XSS)           → { success:true, id:"69c64d4bd30dcf7649d14622" }
GET /api/stats                        → totalLogs:125, totalAttacks:77
Dashboard http://44.201.147.239:5173  → Live data, all 10 pages render
```
