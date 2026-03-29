# SENTINAL × OpenClaw × ArmorClaw Integration Plan

## Overview

This document defines the complete architecture, implementation strategy, and rollout plan for integrating SENTINAL with OpenClaw and ArmorClaw from ArmorIQ.

---

## What Each Component Does

| Component | Role in SENTINAL |
|---|---|
| **SENTINAL** | Threat detection, analysis, policy decisions, IP enforcement |
| **OpenClaw** | Operator command interface via Telegram/Slack/Discord |
| **ArmorClaw** | Authorization + cryptographic intent verification for admin actions |
| **Telegram Bot** | Alert delivery + approval channel |
| **Dashboard** | Secondary visibility + manual audit interface |

---

## Architecture

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
│  intent_builder.py  ← threat analysis        │
│  runtime.py         ← policy gate            │
│  executor.py        ← action runner          │
│  audit_logger.py    ← full audit trail       │
└──────────────────────┬───────────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
         AUTO-EXECUTE     HUMAN REVIEW
         (conf >= 0.95)   (conf >= 0.70)
              │                 │
              │                 ▼
              │    ┌────────────────────────┐
              │    │   OpenClaw Gateway     │
              │    │   (Node.js service)    │
              │    │                        │
              │    │  ArmorIQ Plugin        │
              │    │  • Intent tokens       │
              │    │  • Policy enforcement  │
              │    │  • Crypto proofs       │
              │    └──────────┬─────────────┘
              │               │
              │               ▼
              │    ┌────────────────────────┐
              │    │   Telegram Interface   │
              │    │                        │
              │    │  🚨 Alert message      │
              │    │  [✅ Approve][❌ Reject]│
              │    └──────────┬─────────────┘
              │               │ admin decision
              │               ▼
              └───────► SENTINAL executes
                        + audit logged
```

---

## Operating Modes

### Mode A — Auto-Execute
- Confidence >= `AUTO_EXECUTE_CONFIDENCE` (default 0.95)
- Policy allows immediate action
- SENTINAL executes, sends Telegram notification only
- Full audit log written

### Mode B — Human Approval Required
- Confidence >= `HUMAN_REVIEW_CONFIDENCE` (default 0.70)
- Action held as PENDING
- Telegram alert sent via OpenClaw with Approve/Reject buttons
- ArmorClaw verifies intent before execution
- SENTINAL executes only after admin approval

### Mode C — Monitor Only
- Confidence below review threshold
- Event logged, no action taken
- Optional low-priority Telegram notice

---

## Data Flow

### Step 1: Alert from Detection Layer
```json
{
  "id": "alert-uuid",
  "ip": "103.45.67.89",
  "type": "brute_force",
  "payload": {},
  "timestamp": "2026-03-29T22:00:00Z"
}
```

### Step 2: intent_builder.py produces ThreatAnalysis
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

### Step 3: runtime.py routes by confidence
- >= 0.95 → auto-execute via executor.py
- >= 0.70 → create PendingAction, notify via OpenClaw/Telegram
- < 0.70 → log and monitor only

### Step 4: Telegram Alert (via OpenClaw)
```
🚨 SENTINAL Alert #alert-uuid

IP: 103.45.67.89
Threat: SSH_BRUTE_FORCE
Confidence: 91%
Severity: 🔴 HIGH
Reason: 147 failed SSH attempts in 90s

Proposed Action: BAN_IP

[✅ Approve] [❌ Reject]
```

### Step 5: Admin approves in Telegram
- OpenClaw receives callback
- ArmorClaw verifies intent token
- POST /actions/{id}/approve sent to SENTINAL
- executor.py runs ip_enforcer.ban(ip)
- audit_logger.py records full chain

---

## New Files Required

```
services/
  openclaw_bridge.py      ← bridge between SENTINAL and OpenClaw gateway
  telegram_notifier.py    ← formats + sends Telegram alerts
  ip_enforcer.py          ← executes actual IP ban/unban

models/
  threat_analysis.py      ← ThreatAnalysis Pydantic model
  action_proposal.py      ← ActionProposal Pydantic model
  pending_action.py       ← PendingAction with approval states

dashboard/
  auth.py                 ← JWT login
  routes.py               ← FastAPI approval endpoints
  models.py               ← Dashboard Pydantic models

openclaw/
  config.yaml             ← OpenClaw gateway config
  sentinal_tools.yaml     ← SENTINAL-specific tool definitions
```

## Modified Files

```
intent_builder.py   ← return structured ThreatAnalysis
runtime.py          ← confidence-based routing
executor.py         ← only execute approved actions
audit_logger.py     ← full lifecycle logging
main.py             ← add approval webhook endpoints
policy.yaml         ← add thresholds + rules
.env.example        ← add new required keys
requirements.txt    ← add new dependencies
```

---

## Prerequisites

1. Install OpenClaw:
   ```bash
   curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
   ```

2. Get ArmorIQ API key from https://platform.armoriq.ai

3. Create Telegram bot via @BotFather

4. Add all keys to `.env`

---

## Rollout Phases

### Phase 1 — Model & Structure
- Structured ThreatAnalysis model
- PendingAction model with approval states
- Audit completeness

### Phase 2 — Telegram Alerts
- telegram_notifier.py
- Approval buttons working
- openclaw_bridge.py bridge

### Phase 3 — Enforcement
- ip_enforcer.py (iptables/ufw)
- executor.py only runs approved actions
- Full end-to-end test

### Phase 4 — OpenClaw + ArmorClaw
- Configure OpenClaw gateway
- ArmorClaw intent verification active
- Expose minimal SENTINAL commands only

### Phase 5 — Dashboard
- FastAPI dashboard with JWT
- Pending actions UI
- Audit log browser
- Blocked IPs history

---

## Security Principles

- Never execute destructive actions from raw detection output
- All non-trivial actions must pass policy check
- Human approval required for ambiguous/medium-confidence cases
- OpenClaw tool permissions kept minimal (SENTINAL-only commands)
- Every state transition logged in audit_logger
- Approval timeout for stale pending actions
- Rollback support for mistaken blocks

---

## Definition of Done

Integration is complete when:
1. Fake alert fires from detection layer
2. SENTINAL analyzes and creates pending action
3. Telegram alert sent via OpenClaw
4. Admin approves in Telegram
5. ArmorClaw verifies intent token
6. SENTINAL bans IP
7. Audit log records: detection → analysis → approval → execution
8. Dashboard shows blocked IP in history
