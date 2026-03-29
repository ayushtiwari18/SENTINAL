# SENTINAL × OpenClaw + ArmorClaw — Complete Integration Plan

> **Last Updated:** March 29, 2026  
> **Status:** Planning Phase  
> **Author:** SENTINAL Core Team

---

## 📌 Executive Summary

SENTINAL is an autonomous cybersecurity response engine. This document defines the complete strategy to integrate **OpenClaw** (AI agent framework) and **ArmorClaw** (policy enforcement plugin) from [ArmorIQ](https://armoriq.ai) into the SENTINAL pipeline.

After reading the [official OpenClaw docs](https://docs-openclaw.armoriq.ai/docs), the correct integration model is:

> **OpenClaw becomes the Telegram-based admin command interface.**  
> **ArmorClaw enforces policy on every admin command before SENTINAL executes it.**

This is NOT about replacing Python code with Node.js. It is about adding a **secure, verified, chat-based human-in-the-loop layer** on top of the existing SENTINAL Python backend.

---

## 🏗️ New System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     DETECTION LAYER                          │
│         (IDS / Snort / Suricata / custom detector.py)        │
│   Monitors network → detects anomaly → fires JSON alert      │
└───────────────────────────┬──────────────────────────────────┘
                            │  POST /alert  (JSON)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│              SENTINAL Response Engine (Python/FastAPI)        │
│                                                              │
│  ┌─────────────────┐   ┌──────────────────┐                 │
│  │ intent_builder  │──▶│   runtime.py     │                 │
│  │ (LLM analysis)  │   │ (policy gate)    │                 │
│  └─────────────────┘   └────────┬─────────┘                 │
│                                 │                            │
│              ┌──────────────────┼──────────────────┐        │
│              │                  │                  │        │
│         confidence          confidence         confidence   │
│          >= 0.95            0.70–0.95            < 0.70     │
│              │                  │                  │        │
│         AUTO-EXECUTE      HOLD FOR HUMAN        LOG ONLY   │
│              │                  │                  │        │
│         executor.py       openclaw_bridge.py   audit_logger │
│              │                  │                            │
└──────────────┼──────────────────┼────────────────────────────┘
               │                  │
               │          POST to OpenClaw Gateway
               │                  │
               │                  ▼
               │   ┌──────────────────────────────────────┐
               │   │     OpenClaw Gateway  (Node.js)      │
               │   │     Running locally on your server   │
               │   │                                      │
               │   │  ┌────────────────────────────────┐  │
               │   │  │      ArmorIQ Plugin             │  │
               │   │  │  • Captures admin command       │  │
               │   │  │  • Requests intent token (IAP)  │  │
               │   │  │  • Verifies cryptographic proof  │  │
               │   │  │  • Checks active policies        │  │
               │   │  └────────────────────────────────┘  │
               │   └──────────────────┬───────────────────┘
               │                      │
               │                      ▼
               │   ┌──────────────────────────────────────┐
               │   │        Telegram Bot Interface        │
               │   │                                      │
               │   │  🚨 SENTINAL Alert #a1b2c3           │
               │   │  IP: 103.45.67.89                   │
               │   │  Threat: SSH Brute Force            │
               │   │  Confidence: 91% | Severity: HIGH   │
               │   │  Action: BAN IP                     │
               │   │                                      │
               │   │  [✅ Approve] [❌ Reject] [👁 Info]   │
               │   └──────────────────┬───────────────────┘
               │                      │  Admin taps Approve
               │                      │
               │          ArmorClaw verifies intent token
               │                      │
               │          POST /webhook/approve → SENTINAL
               │                      │
               └──────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │      ip_enforcer.py         │
              │  Executes: iptables BAN     │
              │  audit_logger records event │
              └─────────────────────────────┘
```

---

## 📁 Complete File Change Map

### 🆕 New Files to Create

```
SENTINAL/
├── services/
│   ├── openclaw_bridge.py         ← Sends alerts to OpenClaw gateway
│   │                                 Receives approve/reject webhooks
│   │
│   ├── telegram_notifier.py       ← Formats Telegram alert messages
│   │                                 Handles inline button callbacks
│   │
│   └── ip_enforcer.py             ← Executes actual IP ban/unban
│                                     via iptables / ufw
│
├── dashboard/
│   ├── __init__.py
│   ├── auth.py                    ← JWT login for web dashboard
│   ├── routes.py                  ← FastAPI routes (login, pending, logs)
│   └── models.py                  ← Pydantic models for API
│
└── openclaw/
    ├── config.yaml                ← OpenClaw bot config pointing to SENTINAL
    └── sentinal_tools.yaml        ← Custom tool definitions for SENTINAL ops
```

### ✏️ Files to Modify

| File | What Changes | Why |
|------|-------------|-----|
| `services/sentinal-response-engine/intent_builder.py` | Return structured `ThreatAnalysis` Pydantic model | runtime.py needs typed output to make routing decisions |
| `services/sentinal-response-engine/runtime.py` | Add `confidence_router()` — routes to auto/hold/skip | Core logic for human-in-the-loop |
| `services/sentinal-response-engine/main.py` | Add `/webhook/approve` and `/webhook/reject` endpoints | OpenClaw calls these after admin decision |
| `services/sentinal-response-engine/executor.py` | Call `ip_enforcer.ban()` instead of placeholder | Actual firewall enforcement |
| `config/policy.yaml` | Add `auto_execute_threshold`, `human_review_threshold` | Configurable confidence gates |
| `.env.example` | Add 6 new env vars (see below) | Credentials for new services |
| `requirements.txt` | Add 5 new packages (see below) | New service dependencies |

---

## 🔄 Detailed Data Flow

### Step 1 — Threat Detected
```python
# detector.py (or IDS integration) fires this
alert = {
    "id": "alert-uuid-001",
    "timestamp": "2026-03-29T22:00:00Z",
    "source_ip": "103.45.67.89",
    "destination_port": 22,
    "protocol": "TCP",
    "payload_summary": "147 failed SSH auth attempts in 60 seconds",
    "raw_events": [...]
}
# POST to SENTINAL: http://localhost:8004/alert
```

### Step 2 — LLM Analysis (`intent_builder.py`)
```python
# Returns structured ThreatAnalysis
class ThreatAnalysis(BaseModel):
    threat_type: str           # "SSH Brute Force"
    confidence: float          # 0.91
    severity: str              # "HIGH" | "MEDIUM" | "LOW"
    recommended_action: str    # "BAN_IP" | "THROTTLE" | "MONITOR"
    reasoning: str             # "147 failed SSH attempts from single IP in 60s"
    affected_ip: str           # "103.45.67.89"
    alert_id: str              # "alert-uuid-001"
```

### Step 3 — Policy Gate (`runtime.py`)
```python
def confidence_router(analysis: ThreatAnalysis):
    threshold_auto   = float(os.getenv("AUTO_EXECUTE_CONFIDENCE", "0.95"))
    threshold_review = float(os.getenv("HUMAN_REVIEW_CONFIDENCE", "0.70"))

    if analysis.confidence >= threshold_auto:
        # HIGH confidence — execute immediately, notify after
        executor.execute(analysis)
        telegram_notifier.send_auto_executed(analysis)
        audit_logger.log("AUTO_EXECUTED", analysis)

    elif analysis.confidence >= threshold_review:
        # MEDIUM confidence — hold, send to Telegram for human decision
        pending_store[analysis.alert_id] = analysis
        openclaw_bridge.send_for_approval(analysis)
        audit_logger.log("PENDING_REVIEW", analysis)

    else:
        # LOW confidence — log only, do nothing
        audit_logger.log("LOW_CONFIDENCE_SKIP", analysis)
```

### Step 4 — Telegram Alert Format
```
🚨 SENTINAL Alert  #alert-uuid-001

📍 IP Address:  103.45.67.89
🔍 Threat:      SSH Brute Force
📊 Confidence:  91%
🔴 Severity:    HIGH
⚡ Action:      BAN IP

💬 Reasoning:
147 failed SSH authentication attempts
from single IP in 60 seconds

──────────────────────────
[✅ Approve Ban]  [❌ Reject]  [👁 Details]
──────────────────────────
⏰ Awaiting response...
```

### Step 5 — Admin Approves via Telegram
1. Admin taps **✅ Approve Ban**
2. OpenClaw receives Telegram callback
3. **ArmorClaw Plugin intercepts:**
   - Requests intent token from IAP (ArmorIQ backend)
   - Verifies cryptographic proof for this action
   - Checks active policies allow `BAN_IP` action
4. If all checks pass → calls `POST http://localhost:8004/webhook/approve`
5. SENTINAL's `/webhook/approve` endpoint:
   - Retrieves pending analysis from `pending_store`
   - Calls `executor.execute(analysis)` → `ip_enforcer.ban(ip)`
   - Calls `audit_logger.log("APPROVED_EXECUTED", analysis, admin_id)`
   - Updates Telegram message: "✅ IP 103.45.67.89 banned successfully"

### Step 6 — IP Enforcement (`ip_enforcer.py`)
```python
import subprocess
import os

FIREWALL_BACKEND = os.getenv("FIREWALL_BACKEND", "ufw")  # ufw | iptables | noop

def ban(ip: str) -> bool:
    if FIREWALL_BACKEND == "ufw":
        result = subprocess.run(["ufw", "deny", "from", ip, "to", "any"],
                                capture_output=True, text=True)
        return result.returncode == 0

    elif FIREWALL_BACKEND == "iptables":
        result = subprocess.run(["iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"],
                                capture_output=True, text=True)
        return result.returncode == 0

    elif FIREWALL_BACKEND == "noop":
        # Testing mode — log but don't actually ban
        print(f"[NOOP] Would ban IP: {ip}")
        return True

def unban(ip: str) -> bool:
    # Mirror of ban() with DROP → ACCEPT or ufw delete
    ...
```

---

## 🛠️ OpenClaw Configuration

### `openclaw/config.yaml`
```yaml
# OpenClaw config for SENTINAL integration
name: SENTINAL Security Agent
description: >
  Autonomous cybersecurity response assistant for SENTINAL.
  Delivers threat alerts and processes admin approval/rejection commands.

armoriq:
  api_key: ${ARMORIQ_API_KEY}
  policy_enforcement: strict

telegram:
  bot_token: ${TELEGRAM_BOT_TOKEN}
  admin_chat_id: ${TELEGRAM_CHAT_ID}

sentinal_backend:
  base_url: ${SENTINAL_BACKEND_URL}    # e.g., http://localhost:8004
  webhook_approve: /webhook/approve
  webhook_reject: /webhook/reject
  webhook_secret: ${WEBHOOK_SECRET}
```

### `openclaw/sentinal_tools.yaml`
```yaml
# Custom tools exposed to OpenClaw for SENTINAL operations
tools:
  - name: approve_action
    description: Approve a pending SENTINAL security action (e.g., IP ban)
    parameters:
      alert_id: string
    action: POST ${SENTINAL_BACKEND_URL}/webhook/approve
    body: { "alert_id": "${alert_id}" }

  - name: reject_action
    description: Reject a pending SENTINAL security action
    parameters:
      alert_id: string
    action: POST ${SENTINAL_BACKEND_URL}/webhook/reject
    body: { "alert_id": "${alert_id}" }

  - name: list_pending
    description: List all pending SENTINAL security actions awaiting approval
    action: GET ${SENTINAL_BACKEND_URL}/pending

  - name: list_blocked_ips
    description: Show all currently blocked IPs
    action: GET ${SENTINAL_BACKEND_URL}/blocked-ips

  - name: get_audit_log
    description: Retrieve SENTINAL audit log
    parameters:
      hours: integer   # last N hours, default 24
    action: GET ${SENTINAL_BACKEND_URL}/audit?hours=${hours}

  - name: unban_ip
    description: Remove an IP from the block list
    parameters:
      ip: string
    action: POST ${SENTINAL_BACKEND_URL}/unban
    body: { "ip": "${ip}" }
```

---

## 📦 Dependencies

### `requirements.txt` additions
```txt
# Telegram Bot
python-telegram-bot==21.0

# JWT for dashboard auth
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4

# Async HTTP (for openclaw_bridge)
httpx==0.27.0

# Structured data models
pydantic==2.6.0
```

### Node.js (OpenClaw Gateway)
OpenClaw runs as a separate Node.js process. Install once:
```bash
curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
```
Prerequisites: Node.js v22+, pnpm, Git

---

## 🔐 Environment Variables

### `.env.example` — Full Updated Version
```env
# ── Existing ────────────────────────────────────────────
OPENAI_API_KEY=your_openai_api_key_here

# ── ArmorIQ / OpenClaw ──────────────────────────────────
# Get from: https://platform.armoriq.ai → API Dashboard → API Keys
ARMORIQ_API_KEY=your_armoriq_api_key_here

# URL where OpenClaw gateway runs locally
OPENCLAW_GATEWAY_URL=http://localhost:3000

# ── Telegram Bot ─────────────────────────────────────────
# Create bot at: https://t.me/BotFather → /newbot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here

# Your Telegram chat/group ID (admin receives alerts here)
TELEGRAM_CHAT_ID=your_telegram_chat_id_here

# ── Dashboard Authentication ─────────────────────────────
DASHBOARD_JWT_SECRET=change_this_to_a_strong_random_string
DASHBOARD_ADMIN_USERNAME=admin
DASHBOARD_ADMIN_PASSWORD=change_this_to_a_strong_password

# ── Webhook Security ────────────────────────────────────
# Shared secret between OpenClaw and SENTINAL webhooks
WEBHOOK_SECRET=change_this_to_a_strong_random_string

# ── Policy Thresholds ───────────────────────────────────
# Actions above this confidence execute automatically (no human needed)
AUTO_EXECUTE_CONFIDENCE=0.95

# Actions between this and AUTO_EXECUTE go to Telegram for approval
HUMAN_REVIEW_CONFIDENCE=0.70

# ── IP Enforcement Backend ───────────────────────────────
# Options: ufw | iptables | noop (noop = testing mode, no actual bans)
FIREWALL_BACKEND=noop

# ── SENTINAL Backend ─────────────────────────────────────
SENTINAL_BACKEND_URL=http://localhost:8004
```

---

## 📋 Implementation Phases

### Phase 1 — Prerequisites (Before writing any code)
- [ ] Install OpenClaw: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- [ ] Get ArmorIQ API key from [platform.armoriq.ai](https://platform.armoriq.ai)
- [ ] Create Telegram bot via @BotFather → copy `TELEGRAM_BOT_TOKEN`
- [ ] Get your Telegram Chat ID (send message to bot, check `/getUpdates`)
- [ ] Fill in all `.env` values
- [ ] Verify OpenClaw gateway starts: `pnpm start` in OpenClaw directory

### Phase 2 — Core Python Services (Day 1–2)
- [ ] Create `services/ip_enforcer.py` with `ban()`, `unban()`, `list_banned()`
- [ ] Create `services/telegram_notifier.py` with `send_alert()`, `send_auto_executed()`, `update_message()`
- [ ] Create `services/openclaw_bridge.py` with `send_for_approval()`, `notify_openclaw()`
- [ ] Test: manually trigger `telegram_notifier.send_alert()` — verify Telegram message appears

### Phase 3 — SENTINAL Core Modifications (Day 2)
- [ ] Modify `intent_builder.py` — return `ThreatAnalysis` Pydantic model
- [ ] Modify `runtime.py` — add `confidence_router()` with auto/hold/skip logic
- [ ] Modify `executor.py` — call `ip_enforcer.ban()` for real enforcement
- [ ] Modify `main.py` — add endpoints:
  - `POST /webhook/approve?alert_id=xxx` (called by OpenClaw after approval)
  - `POST /webhook/reject?alert_id=xxx` (called by OpenClaw after rejection)
  - `GET /pending` (list actions awaiting human review)
  - `GET /blocked-ips` (list currently banned IPs)
  - `GET /audit` (audit log)
  - `POST /unban` (remove IP from block list)
- [ ] Update `config/policy.yaml` — add confidence thresholds

### Phase 4 — OpenClaw Configuration (Day 3)
- [ ] Create `openclaw/config.yaml` with SENTINAL backend URLs
- [ ] Create `openclaw/sentinal_tools.yaml` with tool definitions
- [ ] Apply config to OpenClaw installation
- [ ] Test: send fake alert → Telegram message appears → tap Approve → webhook fires

### Phase 5 — Dashboard (Day 3–4)
- [ ] Build `dashboard/auth.py` — JWT login (username + password)
- [ ] Build `dashboard/routes.py` — 4 pages: Login, Pending, Audit Log, Blocked IPs
- [ ] Wire dashboard approve/reject buttons to same `/webhook/approve` endpoints
- [ ] Test: full flow through dashboard

### Phase 6 — End-to-End Testing (Day 4)
- [ ] Run `python test_fake_alert.py` — fires a fake high-confidence alert
  - Verify: auto-executes, Telegram "auto-banned" message sent, audit logged
- [ ] Run `python test_fake_alert.py --confidence 0.80` — medium confidence alert
  - Verify: Telegram approval message sent with buttons
  - Tap Approve → verify ArmorClaw processes → IP ban executed → audit logged
- [ ] Run `python test_fake_alert.py --confidence 0.50` — low confidence alert
  - Verify: log-only, no Telegram message, no ban
- [ ] Test rejection flow: send alert, tap Reject → verify no ban, audit logged

---

## ✅ Definition of Done

The integration is complete when **all 7 checkpoints pass**:

1. ✅ Fake alert fires from detector → SENTINAL processes it via `intent_builder.py`
2. ✅ High-confidence threat auto-bans IP, sends Telegram "auto-executed" notification
3. ✅ Medium-confidence threat sends Telegram approval message with Approve/Reject buttons
4. ✅ Admin taps Approve in Telegram → ArmorClaw verifies intent token → SENTINAL bans IP
5. ✅ Admin taps Reject → no action taken, rejection logged
6. ✅ Audit log records full chain: `detection → analysis → routing → [approval] → execution`
7. ✅ Dashboard login works, shows pending actions, blocked IPs, audit log

---

## 🔒 Security Considerations

1. **Webhook validation** — all `/webhook/*` endpoints must verify `WEBHOOK_SECRET` header
2. **ArmorClaw is the trust boundary** — never skip ArmorClaw verification, even in testing
3. **`FIREWALL_BACKEND=noop` in development** — never run `iptables` commands in dev/test
4. **JWT expiry** — dashboard tokens expire in 8 hours, no refresh tokens
5. **Audit everything** — every approve, reject, auto-execute, and skip must be logged with timestamp, IP, confidence score, and admin identity (if applicable)
6. **Rate limit webhooks** — max 10 approve/reject requests per minute per IP

---

## 📚 References

- OpenClaw Docs: [docs-openclaw.armoriq.ai](https://docs-openclaw.armoriq.ai/docs)
- ArmorIQ Platform: [platform.armoriq.ai](https://platform.armoriq.ai)
- ArmorIQ GitHub: [github.com/armoriq/armorclaw](https://github.com/armoriq/armorclaw)
- SENTINAL Repo: [github.com/ayushtiwari18/SENTINAL](https://github.com/ayushtiwari18/SENTINAL)

---

*This document is the single source of truth for the OpenClaw + ArmorClaw integration.*  
*Update this doc whenever architectural decisions change.*
