# 🏗️ SENTINAL — System Architecture

## Project Goal

SENTINAL is an **AI-powered Web Application Firewall (WAF) + Intrusion Detection System (IDS)** built for real-time threat detection and autonomous response. Unlike traditional WAFs that only block based on static rules, SENTINAL uses:

1. **ML-based scoring** (Detection Engine) to classify attacks with confidence scores
2. **Policy-aware AI agent** (Nexus) to decide which actions to execute vs. queue for human review
3. **Human-in-the-loop control** via the Action Queue dashboard — high-risk actions (permanent bans, endpoint shutdowns) need explicit human approval
4. **Gemini AI** for forensic analysis, threat correlation, and natural language security Q&A

---

## System Components

### 1. Gateway (Node.js / Express) — Port 3000
The central hub. Every HTTP request to a protected application first passes through the Gateway middleware.

**Responsibilities:**
- Run `blocklistMiddleware` — checks every request IP against MongoDB `blockedips` collection
- Log every request to `systemlogs` collection
- Forward suspicious requests to Detection Engine
- Receive Nexus enforcement decisions and write to `action_queue`
- Serve all REST APIs to the Dashboard
- Broadcast real-time events via Socket.IO

**Key files:**
```
backend/src/
  server.js                  — App entry point
  middleware/
    blocklistMiddleware.js    — IP block check (cached 30s)
    requestLogger.js         — Logs all requests
  routes/
    actions.js               — /api/actions (approve/reject queue)
    attacks.js               — /api/attacks
    blocklist.js             — /api/blocklist (CRUD)
    gemini.js                — /api/gemini (AI features)
    armoriq.js               — /api/nexus/trigger (demo/simulate)
  controllers/
    actionQueueController.js — Approve = write to BlockedIP
  models/
    BlockedIP.js             — TTL-indexed, 30s cache in middleware
    ActionQueue.js           — Pending Nexus proposals
    AttackEvent.js           — All detected attacks
    Alert.js                 — High/critical notifications
    AuditLog.js              — Immutable action history
    SystemLog.js             — Raw HTTP request log
```

---

### 2. Detection Engine (Python / FastAPI) — Port 8002
ML-based attack classifier. Called by the Gateway for every suspicious request.

**Responsibilities:**
- Accept `{ method, url, body, headers, ip }` from Gateway
- Run pattern matching + ML scoring pipeline
- Return `{ attackType, severity, confidence, detected: bool }`

**Location:** `services/detection-engine/`

---

### 3. Nexus Policy Engine (Python / FastAPI) — Port 8004
The autonomous response agent. Called by the Gateway *after* an attack is confirmed and saved.

**Responsibilities:**
- Receive `{ attackId, ip, attackType, severity, confidence }` from Gateway
- Evaluate actions against `PolicyGuard-v1` rules
- **Auto-execute** low-risk actions: `send_alert`, `log_attack`, `rate_limit_ip`, `flag_for_review`
- **Queue** high-risk actions for human approval: `permanent_ban_ip`, `shutdown_endpoint`
- POST queued actions to Gateway `/api/actions` (stored in `action_queue`)

**Location:** `services/nexus/`

**Policy rules (simplified):**
```
RULE_001: shutdown_endpoint  → ALWAYS BLOCK  (requires human auth)
RULE_002: permanent_ban_ip   → BLOCK if not already blocked (requires human auth)
RULE_003: rate_limit_ip      → AUTO-EXECUTE (low risk, reversible)
RULE_004: send_alert         → AUTO-EXECUTE
RULE_005: log_attack         → AUTO-EXECUTE
```

---

### 4. PCAP Processor (Python / FastAPI) — Port 8003
Offline packet capture analysis.

**Responsibilities:**
- Accept `.pcap` / `.pcapng` file uploads
- Parse with `scapy` / `pyshark`
- Extract IPs, protocols, anomalies
- Return structured attack candidates to Gateway

**Location:** `services/pcap-processor/`

---

### 5. React Dashboard (Vite) — Port 5173
Real-time security operations center UI.

**Location:** `dashboard/src/`

---

## Full Request Flow

```
1. HTTP Request arrives
        ↓
2. blocklistMiddleware checks MongoDB blockedips (30s cache)
   → If blocked: return 403 immediately
   → If not blocked: continue
        ↓
3. requestLogger.js logs to systemlogs
        ↓
4. Detection Engine called → returns { attackType, severity, confidence }
        ↓
5. If attack detected → attackService.reportAttack()
   → Saves AttackEvent to MongoDB
   → Emits socket event: attack:new
   → Creates Alert if severity=high/critical
   → Calls Nexus (fire-and-forget, non-blocking)
        ↓
6. Nexus evaluates policy:
   → AUTO actions: rate_limit_ip written to BlockedIP, alert sent
   → BLOCKED actions: POSTed to Gateway → saved to action_queue
   → Socket event: action:pending
        ↓
7. Human sees card in /action-queue
   → Clicks Approve:
     → permanent_ban_ip / rate_limit_ip → written to BlockedIP
     → AuditLog entry created
   → Clicks Reject:
     → action marked rejected
     → AuditLog entry created
        ↓
8. /blocklist shows all active blocked IPs
   → blocklistMiddleware picks up within 30s
   → All future requests from that IP get 403
```

---

## MongoDB Collections

| Collection | Purpose | TTL |
|---|---|---|
| `systemlogs` | Raw HTTP request log | None |
| `attackevents` | Confirmed attack records | None |
| `alerts` | High/critical notifications | None |
| `action_queue` | Pending Nexus proposals | None |
| `audit_log` | Immutable action history | None |
| `blockedips` | Active IP blocks | `expiresAt` field (TTL index) |
| `correlationsnapshots` | AI correlation results | None |
| `servicestatuses` | Service health records | None |

---

## Real-time Events (Socket.IO)

| Event | Direction | Trigger |
|---|---|---|
| `attack:new` | Server → Client | New attack detected |
| `alert:new` | Server → Client | High/critical alert created |
| `action:pending` | Server → Client | Nexus queues action for review |
| `blocklist:updated` | Server → Client | IP blocked/unblocked |

---

## AI Features (Gemini 1.5 Pro)

| Feature | Endpoint | Description |
|---|---|---|
| **Security Copilot** | `POST /api/gemini/chat` | Natural language Q&A, streaming support |
| **Forensic Report** | `POST /api/gemini/report/:id` | Auto-generate technical/executive/forensic report |
| **Threat Correlation** | `POST /api/gemini/correlate` | Cross-attack pattern analysis across all events |
| **Payload Mutation** | `POST /api/gemini/mutate` | Generate attack payload variants for testing |
