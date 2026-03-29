# SENTINAL × OpenClaw Integration Plan

> **Status:** Planning Phase  
> **Author:** Ayush Tiwari  
> **Last Updated:** March 2026  
> **Docs Reference:** [docs-openclaw.armoriq.ai](https://docs-openclaw.armoriq.ai/docs)

---

## 🎯 Vision

SENTINAL detects threats autonomously. **OpenClaw** (via Telegram) becomes the admin command & notification interface. **ArmorClaw** enforces policy verification on every admin command before SENTINAL executes it. The result: a fully auditable, human-in-the-loop cybersecurity response system.

---

## 🧠 What OpenClaw + ArmorClaw Actually Are

Before diving into implementation, it's critical to understand what these tools do:

| Tool | What it is | What it does in SENTINAL |
|---|---|---|
| **OpenClaw** | A secured AI agent framework (Node.js) | Runs as a **local gateway** — your Telegram bot interface. Admin chats with it to manage SENTINAL. |
| **ArmorClaw** | Security plugin for OpenClaw | **Verifies every command** the admin sends before SENTINAL executes it — via intent tokens + policy enforcement |
| **ArmorIQ IAP** | Intent Access Proxy (cloud) | Issues cryptographic tokens, validates each action step, logs to ArmorIQ backend |

> ⚠️ OpenClaw is NOT a Python cybersecurity library. It is a Node.js AI agent gateway that happens to integrate perfectly with your SENTINAL backend via webhooks.

---

## 🏗️ Complete System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    DETECTION LAYER                        │
│         (IDS / Snort / Suricata / detector.py)           │
│         Detects anomaly → fires JSON alert               │
└─────────────────────┬────────────────────────────────────┘
                      │  Alert JSON
                      ▼
┌──────────────────────────────────────────────────────────┐
│              SENTINAL Response Engine                     │
│                  (Python / FastAPI)                       │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │  intent_builder.py                              │     │
│  │  LLM analyzes alert → ThreatAnalysis object     │     │
│  │  { threat_type, confidence, severity,           │     │
│  │    recommended_action, reasoning }              │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │  runtime.py (Policy Gate)                       │     │
│  │                                                 │     │
│  │  confidence >= 0.95  → AUTO-EXECUTE             │     │
│  │  confidence >= 0.70  → HOLD for human review    │     │
│  │  confidence < 0.70   → LOG ONLY, skip           │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │  executor.py                                    │     │
│  │  Runs approved actions: ban IP, throttle,       │     │
│  │  shutdown port, send alert                      │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│  ┌──────────────────────▼──────────────────────────┐     │
│  │  audit_logger.py                                │     │
│  │  Logs every action with full chain:             │     │
│  │  detection → analysis → decision → execution   │     │
│  └─────────────────────────────────────────────────┘     │
└─────────────────────┬────────────────────────────────────┘
                      │  Pending Actions (needs human review)
                      ▼
┌──────────────────────────────────────────────────────────┐
│              OpenClaw Gateway (Node.js)                   │
│         Installed locally via ArmorClaw installer         │
│                                                          │
│  ┌─────────────────────────────────────────────────┐     │
│  │  ArmorIQ Plugin                                 │     │
│  │  • Captures admin commands (tool steps)         │     │
│  │  • Requests intent token from IAP               │     │
│  │  • Verifies step proof before execution         │     │
│  │  • Enforces policies from ArmorIQ backend       │     │
│  └─────────────────────────────────────────────────┘     │
│                                                          │
│  SENTINAL Custom Tools registered in OpenClaw:           │
│  • sentinal_approve(action_id)                           │
│  • sentinal_reject(action_id)                            │
│  • sentinal_list_pending()                               │
│  • sentinal_get_audit_log(hours)                         │
│  • sentinal_ban_ip(ip)           [direct command]        │
│  • sentinal_unban_ip(ip)         [direct command]        │
└─────────────────────┬────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────┐
│                Telegram Bot Interface                     │
│                                                          │
│  🚨 SENTINAL Alert #abc-123                              │
│  ─────────────────────────────────                       │
│  IP: 103.45.67.89                                        │
│  Threat: SSH Brute Force                                 │
│  Confidence: 91% | Severity: 🔴 HIGH                    │
│  Reasoning: 147 failed attempts in 60s                   │
│  Proposed Action: BAN IP                                 │
│                                                          │
│  [✅ Approve]  [❌ Reject]  [👁 Details]                 │
└─────────────────────┬────────────────────────────────────┘
                      │ Admin taps Approve
                      ▼
┌──────────────────────────────────────────────────────────┐
│  ArmorClaw verifies intent token                         │
│  → SENTINAL POST /webhook/approve?action_id=abc-123      │
│  → executor.py bans 103.45.67.89                         │
│  → audit_logger.py records full chain                    │
│  → Telegram: ✅ IP 103.45.67.89 banned successfully      │
└──────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Changes

### New Files to Create

```
sentinal-response-engine/
├── services/
│   ├── openclaw_bridge.py          ← NEW
│   │   HTTP bridge: SENTINAL → OpenClaw gateway
│   │   Sends pending actions, receives decisions
│   │
│   ├── telegram_notifier.py        ← NEW
│   │   Formats threat alerts as Telegram messages
│   │   Handles inline button callbacks (approve/reject)
│   │
│   └── ip_enforcer.py              ← NEW
│       Executes IP ban/unban via iptables or ufw
│       Supports FIREWALL_BACKEND=ufw|iptables|noop
│
├── dashboard/
│   ├── __init__.py                 ← NEW
│   ├── auth.py                     ← NEW (JWT login)
│   ├── routes.py                   ← NEW (FastAPI routes)
│   └── models.py                   ← NEW (Pydantic models)
│
├── openclaw/
│   ├── config.yaml                 ← NEW
│   │   OpenClaw bot config pointing to SENTINAL
│   │
│   └── sentinal_tools.yaml         ← NEW
│       Custom tool definitions for SENTINAL commands
│
├── models/
│   └── threat.py                   ← NEW
│       ThreatAnalysis Pydantic model
│       PendingAction model
│       AuditEntry model
│
├── .env.example                    ← MODIFY
├── requirements.txt                ← MODIFY
├── main.py                         ← MODIFY
├── intent_builder.py               ← MODIFY
├── runtime.py                      ← MODIFY
└── policy.yaml                     ← MODIFY
```

---

## 🔄 Detailed Data Flow

### Step 1 — Alert Fires
```json
{
  "id": "alert-550e8400-e29b-41d4",
  "source_ip": "103.45.67.89",
  "destination_port": 22,
  "event_type": "repeated_auth_failure",
  "count": 147,
  "window_seconds": 60,
  "timestamp": "2026-03-29T22:00:00Z",
  "raw_payload": "..."
}
```

### Step 2 — intent_builder.py analyzes
```python
# Returns structured ThreatAnalysis
{
  "alert_id": "alert-550e8400-e29b-41d4",
  "threat_type": "SSH_BRUTE_FORCE",
  "confidence": 0.91,
  "severity": "HIGH",          # LOW | MEDIUM | HIGH | CRITICAL
  "recommended_action": "BAN_IP",
  "reasoning": "147 failed SSH auth attempts from 103.45.67.89 in 60s. Pattern matches automated brute force tooling.",
  "ioc": {
    "ip": "103.45.67.89",
    "port": 22,
    "protocol": "SSH"
  }
}
```

### Step 3 — runtime.py routes by confidence
```python
AUTO_EXECUTE_THRESHOLD = float(os.getenv("AUTO_EXECUTE_CONFIDENCE", "0.95"))
HUMAN_REVIEW_THRESHOLD = float(os.getenv("HUMAN_REVIEW_CONFIDENCE", "0.70"))

if analysis.confidence >= AUTO_EXECUTE_THRESHOLD:
    # Execute immediately, notify after
    executor.run(analysis.recommended_action, analysis.ioc)
    telegram_notifier.send_auto_executed(analysis)
    audit_logger.log("auto_executed", analysis)

elif analysis.confidence >= HUMAN_REVIEW_THRESHOLD:
    # Hold, send to Telegram for approval
    action_id = pending_store.save(analysis)
    openclaw_bridge.send_for_approval(action_id, analysis)
    audit_logger.log("pending_review", analysis)

else:
    # Too uncertain — log only
    audit_logger.log("low_confidence_skip", analysis)
```

### Step 4 — Telegram message sent
```
🚨 SENTINAL Alert #abc-123
─────────────────────────────────
IP: 103.45.67.89
Threat: SSH Brute Force
Confidence: 91% | Severity: 🔴 HIGH

Reasoning:
147 failed SSH auth attempts in 60s.
Pattern matches automated brute force tooling.

Proposed Action: BAN IP

[✅ Approve] [❌ Reject] [👁 Details]
```

### Step 5 — Admin approves via Telegram
1. Admin taps ✅ Approve
2. OpenClaw receives callback
3. ArmorClaw plugin intercepts:
   - Requests intent token from ArmorIQ IAP
   - IAP issues cryptographic proof for `sentinal_approve(action_id)`
   - ArmorClaw verifies token + policy allows this action
4. OpenClaw calls SENTINAL: `POST /webhook/approve?action_id=abc-123`
5. SENTINAL `executor.py` calls `ip_enforcer.ban("103.45.67.89")`
6. `audit_logger.py` records:
```json
{
  "action_id": "abc-123",
  "event": "executed",
  "ip": "103.45.67.89",
  "action": "BAN_IP",
  "approved_by": "admin_telegram_user",
  "armoriq_token": "eyJ...",
  "timestamp": "2026-03-29T22:05:30Z"
}
```
7. Telegram confirmation: `✅ IP 103.45.67.89 banned. Audit ID: abc-123`

---

## 🛠️ File-by-File Changes

### `intent_builder.py` — Structured Output
**Change:** Return a typed `ThreatAnalysis` Pydantic model instead of raw dict/string.

```python
# BEFORE
def build_intent(alert: dict) -> dict:
    # raw LLM call, unstructured output
    ...

# AFTER
from models.threat import ThreatAnalysis

def build_intent(alert: dict) -> ThreatAnalysis:
    # LLM call with structured output enforcement
    # Returns validated ThreatAnalysis object
    ...
```

---

### `runtime.py` — Confidence-Based Routing
**Change:** Add three-tier routing: auto-execute / hold for review / log-only.

```python
# BEFORE
def enforce_policy(analysis):
    if policy_allows(analysis.recommended_action):
        return "execute"
    return "block"

# AFTER
def route_action(analysis: ThreatAnalysis) -> str:
    if analysis.confidence >= AUTO_EXECUTE_THRESHOLD:
        return "auto_execute"
    elif analysis.confidence >= HUMAN_REVIEW_THRESHOLD:
        return "pending_review"
    else:
        return "log_only"
```

---

### `main.py` — New Webhook Endpoints
**Change:** Add `/webhook/approve` and `/webhook/reject` endpoints that OpenClaw calls.

```python
# ADD these endpoints

@app.post("/webhook/approve")
async def approve_action(action_id: str, token: str = Header(...)):
    # Verify ArmorIQ intent token
    # Execute the pending action
    # Log to audit trail
    ...

@app.post("/webhook/reject")
async def reject_action(action_id: str, token: str = Header(...)):
    # Cancel the pending action
    # Log rejection to audit trail
    ...

@app.get("/webhook/pending")
async def list_pending(token: str = Header(...)):
    # Return list of pending actions for dashboard
    ...
```

---

### `policy.yaml` — Add Thresholds + ArmorClaw Config
```yaml
# ADD these sections

enforcement:
  auto_execute_confidence: 0.95
  human_review_confidence: 0.70
  
  # Actions that can NEVER auto-execute, always need human approval
  always_require_human:
    - SHUTDOWN_SERVICE
    - BLOCK_SUBNET
    - WIPE_SESSION

armorclaw:
  gateway_url: "http://localhost:3000"
  webhook_base: "http://localhost:8004"
  approved_tool_calls:
    - sentinal_approve
    - sentinal_reject
    - sentinal_list_pending
    - sentinal_ban_ip
    - sentinal_unban_ip
    - sentinal_get_audit_log
```

---

### `.env.example` — New Variables
```env
# ── Existing ──────────────────────────────────────
OPENAI_API_KEY=your_openai_key_here

# ── ArmorIQ / OpenClaw ────────────────────────────
ARMORIQ_API_KEY=your_armoriq_key_from_platform.armoriq.ai
OPENCLAW_GATEWAY_URL=http://localhost:3000

# ── Telegram Bot ──────────────────────────────────
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_admin_chat_id

# ── Dashboard Auth (JWT) ──────────────────────────
DASHBOARD_JWT_SECRET=generate_a_strong_random_secret_here
DASHBOARD_ADMIN_PASSWORD=your_admin_password

# ── Policy Thresholds ─────────────────────────────
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70

# ── IP Enforcement Backend ────────────────────────
# Options: ufw | iptables | noop (noop = log only, no actual banning)
FIREWALL_BACKEND=noop
```

---

### `requirements.txt` — New Dependencies
```txt
# Add to existing requirements

# Telegram bot
python-telegram-bot==21.0

# JWT for dashboard auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Async HTTP for OpenClaw bridge
httpx==0.27.0

# Structured models
pydantic==2.6.0

# IP tables (optional, for real enforcement)
# python-iptables==1.0.1  # uncomment if using iptables backend
```

---

## 📋 New Files — Full Spec

### `services/openclaw_bridge.py`
Responsibilities:
- Send pending action alerts to OpenClaw gateway
- Register SENTINAL as a tool provider in OpenClaw
- Handle incoming webhook calls from OpenClaw (approve/reject)

### `services/telegram_notifier.py`
Responsibilities:
- Format `ThreatAnalysis` objects as Telegram messages
- Include inline keyboard buttons (Approve / Reject / Details)
- Send auto-execution confirmations
- Send low-confidence "monitoring" notices

### `services/ip_enforcer.py`
Responsibilities:
- `ban(ip: str)` — adds IP to firewall deny list
- `unban(ip: str)` — removes IP from deny list
- `list_banned()` — returns current ban list
- Supports `ufw`, `iptables`, and `noop` backends based on env var

### `openclaw/config.yaml`
OpenClaw bot configuration:
- Points to SENTINAL's webhook URLs
- Declares SENTINAL as a registered tool provider
- Sets ArmorIQ API key reference

### `openclaw/sentinal_tools.yaml`
Defines SENTINAL custom tools for OpenClaw:
- Tool names, descriptions, input schemas
- Maps to SENTINAL webhook endpoints

### `dashboard/auth.py`
- JWT token generation and validation
- Admin password verification
- Token expiry: 8 hours

### `dashboard/routes.py`
FastAPI routes:
- `GET /dashboard` — login page
- `POST /dashboard/login` — authenticate, return JWT
- `GET /dashboard/pending` — list pending actions (auth required)
- `GET /dashboard/audit` — audit log viewer (auth required)
- `GET /dashboard/blocked` — blocked IPs list (auth required)

### `models/threat.py`
Pydantic models:
- `ThreatAnalysis` — output of intent_builder
- `PendingAction` — action waiting for human review
- `AuditEntry` — immutable audit log record
- `IPBanRecord` — blocked IP with metadata

---

## 🚀 Implementation Phases

### Phase 0 — Prerequisites (Before writing any code)
- [ ] Run installer: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- [ ] Get ArmorIQ API key: [platform.armoriq.ai](https://platform.armoriq.ai) → API Dashboard → API Keys
- [ ] Create Telegram bot: message @BotFather on Telegram → `/newbot`
- [ ] Get your Telegram Chat ID (message @userinfobot)
- [ ] Add all keys to `.env` (copy from `.env.example`)

### Phase 1 — Core Services (Day 1)
- [ ] Create `models/threat.py` — ThreatAnalysis, PendingAction, AuditEntry
- [ ] Create `services/ip_enforcer.py` — start with `noop` backend
- [ ] Create `services/telegram_notifier.py` — format and send alerts
- [ ] Test: manually send a test alert to Telegram

### Phase 2 — SENTINAL Modifications (Day 1-2)
- [ ] Modify `intent_builder.py` — return `ThreatAnalysis` model
- [ ] Modify `runtime.py` — three-tier confidence routing
- [ ] Modify `main.py` — add `/webhook/approve` and `/webhook/reject`
- [ ] Update `policy.yaml` — thresholds + ArmorClaw config
- [ ] Test: fake alert → routes to correct tier

### Phase 3 — OpenClaw Bridge (Day 2)
- [ ] Create `services/openclaw_bridge.py`
- [ ] Create `openclaw/config.yaml`
- [ ] Create `openclaw/sentinal_tools.yaml`
- [ ] Configure OpenClaw gateway to use SENTINAL tools
- [ ] Test: pending action → Telegram message → approve → webhook fires

### Phase 4 — ArmorClaw Verification (Day 3)
- [ ] Wire ArmorIQ intent token verification into `/webhook/approve`
- [ ] Verify token headers from OpenClaw requests
- [ ] Test full chain: alert → Telegram → approve → ArmorClaw verifies → IP banned → audit logged

### Phase 5 — Dashboard (Day 3-4)
- [ ] Create `dashboard/auth.py` — JWT login
- [ ] Create `dashboard/routes.py` — all dashboard pages
- [ ] Create `dashboard/models.py` — request/response models
- [ ] Test: login, view pending, approve/reject from browser

### Phase 6 — Real Firewall (Day 4-5)
- [ ] Switch `FIREWALL_BACKEND` from `noop` to `ufw` or `iptables`
- [ ] Test IP ban actually blocks traffic
- [ ] Verify unban works correctly

---

## ✅ Definition of Done

The integration is complete when ALL of these pass:

1. **Detection → Analysis:** A fake alert from `detector.py` triggers `intent_builder.py` and returns a valid `ThreatAnalysis`
2. **Routing:** High-confidence alert auto-executes. Medium-confidence alert goes to Telegram. Low-confidence is logged only.
3. **Telegram Alert:** Pending action appears as a formatted Telegram message with inline buttons
4. **Approve Flow:** Admin taps Approve → ArmorClaw verifies intent → SENTINAL bans IP → Telegram confirms
5. **Reject Flow:** Admin taps Reject → Action cancelled → Audit logged
6. **Audit Trail:** Every action (auto or manual) has a complete audit record: `detection → analysis → decision → execution`
7. **Dashboard:** Admin can log in, view pending actions, view audit log, see blocked IPs
8. **ArmorClaw Gate:** Every admin command via Telegram is verified by ArmorClaw before SENTINAL acts on it

---

## 🔐 Security Notes

1. **Never expose `/webhook/approve` publicly** — it must only accept requests from the local OpenClaw gateway
2. **Validate ArmorIQ intent tokens** on every webhook call — reject unverified requests
3. **Rate limit the dashboard** — max 5 login attempts per minute
4. **Audit log is append-only** — never delete or modify entries
5. **`noop` firewall backend for development** — never run real iptables in dev/testing
6. **Rotate `DASHBOARD_JWT_SECRET`** regularly in production

---

## 📞 Resources

| Resource | Link |
|---|---|
| OpenClaw Docs | [docs-openclaw.armoriq.ai](https://docs-openclaw.armoriq.ai/docs) |
| ArmorIQ Platform | [platform.armoriq.ai](https://platform.armoriq.ai) |
| ArmorClaw GitHub | [github.com/armoriq/armorclaw](https://github.com/armoriq/armorclaw) |
| ArmorIQ Support | license@armoriq.io |
| SENTINAL Repo | [github.com/ayushtiwari18/SENTINAL](https://github.com/ayushtiwari18/SENTINAL) |

---

*This document is the single source of truth for the SENTINAL × OpenClaw integration. Update it as implementation progresses.*
