# SENTINAL × OpenClaw × ArmorClaw Integration Plan

## Overview

This document defines the full architecture, implementation strategy, and rollout plan for integrating SENTINAL with OpenClaw and ArmorClaw from ArmorIQ.

---

## What Each Component Actually Does

| Component | Role in SENTINAL |
|---|---|
| **Detection Layer** | Detects threats, fires structured alerts |
| **SENTINAL Engine** | Analyzes alerts, proposes actions, enforces policy |
| **OpenClaw** | Node.js AI agent gateway — admin command interface via Telegram/Slack |
| **ArmorClaw** | Security plugin inside OpenClaw — verifies every action before execution |
| **Telegram Bot** | Primary admin notification and approval channel |
| **Dashboard** | Secondary visibility, audit log, manual review (Phase 2) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Detection Layer                    │
│   (Snort / Suricata / custom detector.py)       │
│   Detects threat → fires JSON alert             │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         SENTINAL Response Engine                │
│              (Python / FastAPI)                 │
│                                                 │
│  intent_builder.py  ← LLM threat analysis       │
│  runtime.py         ← policy + routing gate     │
│  executor.py        ← runs approved actions     │
│  audit_logger.py    ← logs full event chain     │
└──────────────────────┬──────────────────────────┘
                       │ alert + proposed action
                       ▼
┌─────────────────────────────────────────────────┐
│        OpenClaw Gateway (Node.js)               │
│   Installed via: curl -fsSL                     │
│   https://armoriq.ai/install-armorclaw.sh | bash│
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │          ArmorClaw Plugin                 │  │
│  │  • Captures action intent                 │  │
│  │  • Requests intent token from IAP         │  │
│  │  • Verifies each step before execution    │  │
│  │  • Enforces organization policies         │  │
│  └───────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         Telegram / Operator Interface           │
│                                                 │
│  🚨 Alert: Brute force from 103.45.67.89        │
│  Confidence: 91% | Severity: HIGH               │
│  Proposed: BAN_IP                               │
│                                                 │
│  [ ✅ Approve ]  [ ❌ Reject ]  [ 👁 Details ] │
└──────────────────────┬──────────────────────────┘
                       │ admin decision
                       ▼
┌─────────────────────────────────────────────────┐
│   ArmorClaw verifies intent token + policy      │
│   → SENTINAL executes approved action           │
│   → audit_logger.py records full chain          │
└─────────────────────────────────────────────────┘
```

---

## Operating Modes

### Mode A — Auto-Execute
- Confidence >= `AUTO_EXECUTE_THRESHOLD` (default: 0.95)
- Policy explicitly allows immediate action
- SENTINAL executes, Telegram sends notification only

### Mode B — Human Approval Required
- Confidence >= `REVIEW_THRESHOLD` (default: 0.70)
- Alert sent to Telegram via OpenClaw bridge
- Admin approves or rejects
- ArmorClaw verifies before execution

### Mode C — Monitor Only
- Confidence < `REVIEW_THRESHOLD`
- Event logged, no action taken
- Optional low-priority Telegram notice

---

## Data Flow — Step by Step

### Step 1: Alert Fires
```json
{
  "id": "alert-uuid-001",
  "ip": "103.45.67.89",
  "type": "brute_force",
  "attempts": 147,
  "window_seconds": 90,
  "timestamp": "2026-03-29T22:00:00Z"
}
```

### Step 2: intent_builder.py Analysis
```json
{
  "threat_type": "SSH_BRUTE_FORCE",
  "confidence": 0.91,
  "severity": "HIGH",
  "recommended_action": "BAN_IP",
  "reason": "147 failed SSH attempts in 90 seconds",
  "response_mode": "REVIEW_REQUIRED"
}
```

### Step 3: runtime.py Policy Gate
```python
if confidence >= AUTO_EXECUTE_THRESHOLD:
    # execute immediately
elif confidence >= REVIEW_THRESHOLD:
    # send to Telegram for human approval
else:
    # log and monitor only
```

### Step 4: Telegram Alert (via openclaw_bridge.py)
```
🚨 SENTINAL Alert #alert-uuid-001

IP: 103.45.67.89
Threat: SSH_BRUTE_FORCE
Confidence: 91% | Severity: HIGH
Reason: 147 failed SSH attempts in 90 seconds

Proposed Action: BAN_IP

[ ✅ Approve ]  [ ❌ Reject ]
```

### Step 5: Admin Decision → ArmorClaw Verification → Execution
- Admin taps Approve
- ArmorClaw verifies intent token
- `executor.py` calls `ip_enforcer.ban(ip)`
- `audit_logger.py` records full chain

---

## Files Changed

### New Files
```
services/openclaw_bridge.py     — bridge between SENTINAL and OpenClaw gateway
services/telegram_notifier.py   — Telegram alert formatting and sending
services/ip_enforcer.py         — IP ban/unban via iptables/ufw abstraction
models/threat_analysis.py       — Pydantic model for structured threat output
models/action_proposal.py       — Pydantic model for proposed action
models/pending_action.py        — Pydantic model for approval state tracking
docs/SENTINAL_OPENCLAW_PLAN.md  — this document
```

### Modified Files
```
intent_builder.py    — returns structured ThreatAnalysis
runtime.py           — confidence-based routing (auto/review/skip)
executor.py          — only executes approved actions
audit_logger.py      — logs full event lifecycle
main.py              — adds /actions/pending, /actions/{id}/approve, /actions/{id}/reject
policy.yaml          — adds confidence thresholds and response modes
.env.example         — adds ARMORIQ_API_KEY, TELEGRAM_BOT_TOKEN, etc.
requirements.txt     — adds python-telegram-bot, httpx, pydantic v2
```

---

## Prerequisites

Before implementing:

1. Install OpenClaw + ArmorClaw:
```bash
curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
```

2. Get ArmorIQ API key: https://platform.armoriq.ai → API Dashboard → API Keys

3. Create Telegram bot via @BotFather → get `TELEGRAM_BOT_TOKEN`

4. Get your Telegram `CHAT_ID` by messaging your bot and calling:
```
https://api.telegram.org/bot<TOKEN>/getUpdates
```

5. Fill in `.env` from `.env.example`

---

## Rollout Phases

### Phase 1 — Core Restructuring (Week 1)
- [ ] Add Pydantic models: ThreatAnalysis, ActionProposal, PendingAction
- [ ] Update intent_builder.py to return structured output
- [ ] Update runtime.py with confidence routing
- [ ] Update executor.py to check approval state
- [ ] Update audit_logger.py with full lifecycle logging

### Phase 2 — Notification + Approval (Week 1-2)
- [ ] Implement telegram_notifier.py
- [ ] Implement openclaw_bridge.py
- [ ] Add /actions/approve and /actions/reject endpoints in main.py
- [ ] Test full flow: fake alert → Telegram → approve → IP ban → audit log

### Phase 3 — IP Enforcement (Week 2)
- [ ] Implement ip_enforcer.py with iptables/ufw backend
- [ ] Add FIREWALL_BACKEND config (ufw / iptables / noop)
- [ ] Test IP ban and rollback

### Phase 4 — OpenClaw Config (Week 2-3)
- [ ] Configure OpenClaw gateway with SENTINAL webhook URLs
- [ ] Define SENTINAL-specific tools in openclaw/sentinal_tools.yaml
- [ ] Restrict OpenClaw tool permissions to SENTINAL ops only

### Phase 5 — Dashboard (Week 3-4)
- [ ] Build FastAPI dashboard with JWT auth
- [ ] Pages: Login, Pending Actions, Blocked IPs, Audit Log
- [ ] Connect to same approve/reject webhook endpoints

---

## Security Principles

- Never execute destructive actions directly from raw detection output
- All non-trivial actions must pass through policy gate
- Human approval required for ambiguous confidence cases
- OpenClaw tool permissions restricted to SENTINAL ops only
- Every state transition logged in audit_logger.py
- Approval timeout for stale pending actions (configurable)
- Idempotent execution — same action_id cannot execute twice

---

## Definition of Done

Integration is complete when:
1. Fake alert fires from detector.py
2. SENTINAL analyzes and creates pending action
3. Telegram alert sent via OpenClaw bridge
4. Admin approves in Telegram
5. ArmorClaw verifies intent
6. SENTINAL bans the IP
7. Audit log records: detection → analysis → pending → approved → executed
