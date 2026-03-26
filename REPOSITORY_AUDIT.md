# REPOSITORY AUDIT
> Phase 0 — Full Repository Scan  
> Date: 2026-03-26  
> Auditor: Senior Systems Architect / Security Engineer

---

## 1. Service Registry

| # | Service | Language | Port | Entry Point | Role |
|---|---------|----------|------|-------------|------|
| 1 | **backend (Gateway)** | Node.js / Express | 3000 | `backend/server.js` | Central API gateway, MongoDB persistence, Socket.io, approval workflow |
| 2 | **armoriq-agent** | Python / FastAPI | 8004 | `services/armoriq-agent/main.py` | Intent building, policy enforcement, execution |
| 3 | **detection-engine** | Python / FastAPI | 8001 | `services/detection-engine/app/main.py` | Attack classification from HTTP events |
| 4 | **pcap-processor** | Python / FastAPI | 8002 | `services/pcap-processor/` | PCAP file parsing and analysis |
| 5 | **middleware** | Node.js | 8003 | `services/middleware/` | Express SDK middleware for event capture |
| 6 | **dashboard** | React / Vite | 5173 | `dashboard/` | Frontend UI |
| 7 | **demo-target** | Node.js | varies | `demo-target/` | Demo attack simulation target |

---

## 2. API Inventory

### Backend Gateway (`backend/src/routes/`)

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/health` | `health.js` | Service health check |
| GET | `/api/stats` | `stats.js` | Attack statistics |
| GET/POST | `/api/attacks` | `attacks.js` | List/create attack events |
| GET/POST | `/api/alerts` | `alerts.js` | Alert management |
| POST | `/api/alerts/armoriq` | `alerts.js` | ArmorIQ alert ingestion |
| GET/POST | `/api/audit` | `audit.js` | Audit log read |
| POST | `/api/audit/ingest` | `audit.js` | Audit entry from ArmorIQ |
| POST | `/api/armoriq/respond` | `armoriq.js` | Trigger ArmorIQ enforcement |
| GET/POST | `/api/actions` | `actions.js` | Action approval queue |
| POST | `/api/actions/:id/approve` | `actions.js` | Approve queued action |
| POST | `/api/actions/:id/reject` | `actions.js` | Reject queued action |
| GET | `/api/logs` | `logs.js` | System logs |
| POST | `/api/forensics` | `forensics.js` | PCAP forensics trigger |
| GET | `/api/pcap/*` | `pcap.js` | PCAP upload and analysis |
| GET | `/api/services/status` | `serviceStatus.js` | All service status |

### ArmorIQ Agent (`services/armoriq-agent/`)

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/health` | `main.py` | Health check |
| POST | `/respond` | `main.py` | Main enforcement endpoint |

### Detection Engine (`services/detection-engine/app/`)

| Method | Path | File | Purpose |
|--------|------|------|---------|
| GET | `/health` | `main.py` | Health check |
| POST | `/detect` | `main.py` | Classify HTTP event |
| POST | `/batch-detect` | `main.py` | Batch event classification |

---

## 3. Data Models

### Backend (MongoDB via Mongoose)
- `AttackEvent` — `backend/src/models/AttackEvent.js`
- `Alert` — `backend/src/models/Alert.js`
- `AuditLog` — `backend/src/models/AuditLog.js`
- `Action` — `backend/src/models/Action.js`

### ArmorIQ Agent (Pydantic)
- `AttackContext` — `services/armoriq-agent/models.py`
- `RespondRequest` — `services/armoriq-agent/models.py`
- `ProposedAction` — `services/armoriq-agent/models.py`
- `IntentModel` — `services/armoriq-agent/models.py`
- `DecisionModel` — `services/armoriq-agent/models.py`
- `ActionResult` — `services/armoriq-agent/models.py`
- `RespondResponse` — `services/armoriq-agent/models.py`

---

## 4. Execution Pipeline (Current)

```
HTTP Traffic
    │
    ▼
Middleware SDK (port 8003)
    │  captures request events
    ▼
Detection Engine (port 8001)
    │  classifies attack, returns AttackEvent
    ▼
Backend Gateway (port 3000)
    │  persists AttackEvent to MongoDB
    │  POST /api/armoriq/respond → ArmorIQ Agent
    ▼
ArmorIQ Agent (port 8004)
    │  build_intents()
    │  policy_engine.evaluate()   ← CUSTOM ENGINE (needs OpenClaw)
    │  executor.execute()
    │  audit_logger.log_decision()
    ▼
Backend Gateway
    │  POST /api/audit/ingest
    │  POST /api/alerts/armoriq
    ▼
MongoDB  +  Socket.io → Dashboard
```

---

## 5. Current Policy Enforcement Location

**File:** `services/armoriq-agent/policy_engine.py`  
**Function:** `evaluate(intent: IntentModel) -> DecisionModel`  
**Called from:** `services/armoriq-agent/main.py` line ~75

The current implementation is a **hand-written deterministic rule engine** using Python lambdas. It does NOT use OpenClaw / ArmorClaw. This is the root cause of sponsor track non-compliance.

---

## 6. Middleware / Queue Systems

- No message queue (Redis/RabbitMQ) present — all calls are synchronous HTTP
- Socket.io used for real-time dashboard push (`backend/src/sockets/`)
- Action approval queue is MongoDB-backed (Action model)
- ArmorIQ blocked actions are returned in `actionsQueued` array and stored by Gateway

---

## 7. External Integrations

| Integration | Direction | File | Notes |
|-------------|-----------|------|-------|
| MongoDB | Backend ↔ DB | `backend/src/config/` | Mongoose ODM |
| ArmorIQ Agent | Gateway → Agent | `backend/src/routes/armoriq.js` | HTTP POST |
| Detection Engine | Gateway → Engine | `backend/src/services/` | HTTP POST |
| Socket.io | Gateway → Dashboard | `backend/src/sockets/` | Real-time events |
| OpenClaw/ArmorClaw | **MISSING** | — | Must be added to armoriq-agent |

---

## 8. Dependency Map

```
dashboard
    └── backend (Gateway) :3000
            ├── MongoDB
            ├── armoriq-agent :8004
            │       ├── policy_engine.py  (← replace with openclaw_runtime.py)
            │       ├── executor.py
            │       └── audit_logger.py
            ├── detection-engine :8001
            └── pcap-processor :8002
```

---

## 9. Risk Areas

| Area | Risk | Severity |
|------|------|----------|
| `policy_engine.py` | Custom engine, not OpenClaw — sponsor non-compliance | CRITICAL |
| No `openclaw_runtime.py` | Missing core integration module | CRITICAL |
| No `policy.yaml` | Policies not externalized | HIGH |
| No integration tests | Cannot prove enforcement guarantees | HIGH |
| `executor.py` sends alerts synchronously | 5s timeout could block main response loop | MEDIUM |
| No fallback if ArmorIQ agent is down | Gateway may error on `/api/armoriq/respond` | MEDIUM |
| `audit_logger.py` failure is silently swallowed | Audit gaps possible under load | LOW |

---

## 10. Files Scanned

- `services/armoriq-agent/main.py` ✅
- `services/armoriq-agent/policy_engine.py` ✅
- `services/armoriq-agent/intent_builder.py` ✅
- `services/armoriq-agent/executor.py` ✅
- `services/armoriq-agent/audit_logger.py` ✅
- `services/armoriq-agent/models.py` ✅
- `services/armoriq-agent/requirements.txt` ✅
- `services/detection-engine/app/main.py` ✅ (directory)
- `backend/server.js` ✅
- `backend/src/routes/*` ✅ (full listing)
- `backend/src/models/` ✅ (directory)
- `backend/src/services/` ✅ (directory)
- `backend/src/sockets/` ✅ (directory)
- `MASTER_REFERENCE.md` ✅
