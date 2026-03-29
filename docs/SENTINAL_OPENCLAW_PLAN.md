# SENTINAL × OpenClaw × ArmorClaw — Complete Architecture & Implementation Plan

> Last updated: March 2026

---

## Overview

This document defines the target architecture, all required code changes, implementation strategy, and rollout plan for integrating SENTINAL with OpenClaw and ArmorClaw.

### Core Clarification

OpenClaw + ArmorClaw is **not** a Python threat-detection SDK embedded into SENTINAL's backend. It is a **secured agent/gateway system** operating through chat interfaces (Telegram, Slack, Discord), with ArmorClaw enforcing authorization and policy checks on each action before execution.

The correct design:
- **SENTINAL** remains the threat detection and response engine (Python)
- **OpenClaw** becomes the admin/operator command interface (Node.js gateway)
- **ArmorClaw** becomes the authorization layer for admin-triggered actions
- **Telegram** is the primary approval and notification channel
- **Dashboard** is secondary (audit/visibility), built after Telegram flow works

---

## Architecture Diagram

```
┌──────────────────────────────────────────────┐
│              Detection Layer                 │
│      (Snort / Suricata / custom IDS)         │
│  Detects threat → sends structured alert     │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│         SENTINAL Response Engine             │
│              (Python / FastAPI)              │
│                                              │
│  intent_builder.py  ← LLM threat analysis    │
│  runtime.py         ← policy gate            │
│  executor.py        ← action runner          │
│  audit_logger.py    ← full audit trail       │
└──────────────────────┬───────────────────────┘
                       │ alert + proposed action
                       ▼
┌──────────────────────────────────────────────┐
│           OpenClaw Gateway                   │
│            (Node.js — local service)         │
│                                              │
│  Receives operator commands via Telegram     │
│  Routes secured actions through ArmorClaw    │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│           ArmorClaw / ArmorIQ IAP            │
│    Intent verification + policy enforcement  │
│                                              │
│  - validates action intent token             │
│  - enforces org policy                       │
│  - approves or blocks tool execution         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│        Telegram Operator Interface           │
│                                              │
│  🚨 Alert: SSH Brute Force from 1.2.3.4     │
│  Confidence: 91% | Severity: HIGH           │
│  Action: BAN IP                              │
│                                              │
│  [ ✅ Approve ]  [ ❌ Reject ]              │
└──────────────────────────────────────────────┘
```

---

## Operating Modes

### Mode A — Auto-Response (confidence >= 0.95)
1. Detection alert fires
2. SENTINAL analyzes → confidence >= 0.95
3. Policy allows auto-execute
4. SENTINAL bans IP immediately
5. Telegram receives notification only (no approval needed)
6. Audit log records execution

### Mode B — Human Approval Required (0.70 <= confidence < 0.95)
1. Detection alert fires
2. SENTINAL analyzes → confidence in review range
3. Pending action created, sent to Telegram via OpenClaw
4. Admin approves or rejects
5. ArmorClaw verifies the intent token
6. SENTINAL executes only if approved + verified
7. Audit log records full chain

### Mode C — Observe Only (confidence < 0.70)
1. Detection alert fires
2. SENTINAL analyzes → too uncertain
3. Event logged to audit trail
4. Optional low-priority Telegram notice
5. No execution

---

## Data Flow — Step by Step

```python
# Step 1: Detection Layer fires
alert = {
    "id": "alert-uuid-1234",
    "ip": "103.45.67.89",
    "type": "ssh_brute_force",
    "payload": {"attempts": 147, "window_seconds": 90},
    "timestamp": "2026-03-29T22:00:00Z"
}

# Step 2: intent_builder.py produces
analysis = {
    "threat_type": "SSH_BRUTE_FORCE",
    "confidence": 0.91,
    "severity": "HIGH",
    "recommended_action": "BAN_IP",
    "reason": "147 failed SSH attempts in 90 seconds",
    "response_mode": "REVIEW_REQUIRED"
}

# Step 3: runtime.py decides
if analysis["confidence"] >= AUTO_EXECUTE_THRESHOLD:  # 0.95
    executor.ban_ip(alert["ip"])
elif analysis["confidence"] >= REVIEW_THRESHOLD:      # 0.70
    openclaw_bridge.send_for_approval(alert, analysis)
else:
    audit_logger.log("low_confidence_skip", alert)

# Step 4: Telegram message sent
"""
🚨 SENTINAL Alert #alert-uuid-1234

IP: 103.45.67.89
Threat: SSH Brute Force
Confidence: 91%  |  Severity: 🔴 HIGH
Reason: 147 failed SSH attempts in 90 seconds

Proposed Action: BAN IP

[ ✅ Approve ]  [ ❌ Reject ]  [ 👁 Details ]
"""

# Step 5: Admin taps Approve
# OpenClaw receives callback
# ArmorClaw verifies intent token
# SENTINAL POST /webhook/approve?action_id=alert-uuid-1234
# executor.py runs ip_enforcer.ban("103.45.67.89")
# audit_logger records full event
```

---

## File Changes Required

### New Files to Create

```
sentinal-response-engine/
├── services/
│   ├── openclaw_bridge.py       ← Sends alerts to OpenClaw gateway
│   ├── telegram_notifier.py     ← Formats + sends Telegram messages
│   └── ip_enforcer.py           ← Executes IP ban/unban via iptables/ufw
├── models/
│   ├── threat_analysis.py       ← ThreatAnalysis Pydantic model
│   ├── action_proposal.py       ← ActionProposal Pydantic model
│   └── pending_action.py        ← PendingAction + status enum
├── dashboard/
│   ├── __init__.py
│   ├── auth.py                  ← JWT login
│   ├── routes.py                ← FastAPI dashboard routes
│   └── models.py                ← Dashboard Pydantic models
└── openclaw/
    ├── config.yaml              ← OpenClaw bot config for SENTINAL
    └── sentinal_tools.yaml      ← Custom tool definitions
```

### Files to Modify

| File | Change |
|---|---|
| `intent_builder.py` | Return structured `ThreatAnalysis` object |
| `runtime.py` | Add confidence-based routing (auto / hold / skip) |
| `executor.py` | Only execute actions with APPROVED status |
| `audit_logger.py` | Log full lifecycle: detection → analysis → decision → execution |
| `main.py` | Add `/webhook/approve` and `/webhook/reject` endpoints |
| `policy.yaml` | Add thresholds + allowed actions per threat type |
| `.env.example` | Add all new required keys |
| `requirements.txt` | Add new dependencies |

---

## Implementation Plan

### Phase 1 — Prerequisites
- [ ] Install OpenClaw: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- [ ] Get ArmorIQ API key from https://platform.armoriq.ai → API Dashboard
- [ ] Create Telegram bot via @BotFather → get `TELEGRAM_BOT_TOKEN`
- [ ] Get your Telegram chat ID
- [ ] Fill all new `.env` variables

### Phase 2 — SENTINAL Core Changes
- [ ] Create `models/threat_analysis.py`
- [ ] Create `models/action_proposal.py`
- [ ] Create `models/pending_action.py`
- [ ] Modify `intent_builder.py` → structured output
- [ ] Modify `runtime.py` → confidence routing
- [ ] Modify `executor.py` → approval gate
- [ ] Modify `audit_logger.py` → full lifecycle logging

### Phase 3 — Integration Services
- [ ] Create `services/ip_enforcer.py`
- [ ] Create `services/telegram_notifier.py`
- [ ] Create `services/openclaw_bridge.py`
- [ ] Modify `main.py` → approval webhook endpoints

### Phase 4 — OpenClaw Configuration
- [ ] Create `openclaw/config.yaml`
- [ ] Create `openclaw/sentinal_tools.yaml`
- [ ] Test full flow: fake alert → Telegram message → approve → IP ban

### Phase 5 — Dashboard (After Telegram Flow Works)
- [ ] Build `dashboard/auth.py` (JWT)
- [ ] Build `dashboard/routes.py` (FastAPI)
- [ ] Pages: Login, Pending Actions, Blocked IPs, Audit Log

---

## Policy Design

```yaml
# policy.yaml additions
auto_execute_confidence: 0.95
review_required_confidence: 0.70
default_low_confidence_action: monitor

rules:
  - threat_type: SSH_BRUTE_FORCE
    action: BAN_IP
    auto_execute_if_confidence_gte: 0.98

  - threat_type: PORT_SCAN
    action: BAN_IP
    requires_human_review: true

  - threat_type: SQLI_ATTEMPT
    action: MONITOR
    requires_human_review: true

  - threat_type: DDOS
    action: BAN_IP
    auto_execute_if_confidence_gte: 0.95
```

---

## .env.example Updates

```env
# Existing
OPENAI_API_KEY=your_openai_key

# ArmorIQ / OpenClaw (get from https://platform.armoriq.ai)
ARMORIQ_API_KEY=your_armoriq_key
OPENCLAW_GATEWAY_URL=http://localhost:3000

# Telegram Bot (get from @BotFather)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_admin_chat_id

# Dashboard Auth
DASHBOARD_JWT_SECRET=your_jwt_secret_here
DASHBOARD_ADMIN_PASSWORD=your_secure_password

# Policy Thresholds
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70

# IP Enforcement Backend: ufw | iptables | noop (for testing)
FIREWALL_BACKEND=noop
```

---

## Dependencies to Add

```txt
# requirements.txt additions
python-telegram-bot==21.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
pydantic==2.6.0
```

---

## Security Principles

- Never execute a destructive action directly from raw detection output
- All non-trivial actions must pass through policy evaluation
- Human approval required for ambiguous confidence cases
- OpenClaw tool permissions must be minimal — only SENTINAL-specific commands
- Every state transition must be logged
- Approval timeouts for stale pending actions
- Idempotent execution to prevent double-bans

---

## Definition of Done (Milestone 1)

The integration is complete when:
1. A fake alert fires from the detection layer
2. SENTINAL analyzes it and creates a pending action
3. Telegram alert is sent with Approve/Reject buttons
4. Admin taps Approve
5. ArmorClaw verifies the intent token
6. SENTINAL executes the IP ban
7. Audit log contains: `detection → analysis → pending → approved → executed`

**Do not build the dashboard before Milestone 1 works.**
