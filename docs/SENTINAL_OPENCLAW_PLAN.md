# SENTINAL × OpenClaw × ArmorClaw Integration Plan

## Overview

This document defines the target architecture, implementation strategy, required code changes, and rollout phases for integrating SENTINAL with OpenClaw and ArmorClaw from ArmorIQ.

---

## What Each Component Actually Is

| Component | What it is | Role in SENTINAL |
|---|---|---|
| **SENTINAL** | Python threat response engine | Detects, analyzes, executes |
| **OpenClaw** | Node.js AI agent gateway (chat-based) | Admin operator interface via Telegram |
| **ArmorClaw** | Security plugin for OpenClaw | Verifies admin commands before execution |
| **Telegram Bot** | Chat interface | Alert delivery + approval channel |
| **Dashboard** | FastAPI web UI | Secondary visibility + audit interface |

> **Key insight:** OpenClaw is NOT a Python SDK embedded in SENTINAL. It is a separate Node.js gateway that runs locally. SENTINAL sends alerts TO it and receives decisions FROM it via HTTP.

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
│  executor.py        ← action execution       │
│  audit_logger.py    ← full audit trail       │
└──────────┬───────────────────────────────────┘
           │
           │  (HTTP POST pending action)
           ▼
┌──────────────────────────────────────────────┐
│         services/openclaw_bridge.py          │
│  Sends alert to OpenClaw gateway             │
│  Receives approve/reject decisions           │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│         OpenClaw Gateway (Node.js)           │
│         Installed via ArmorIQ installer      │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │         ArmorIQ Plugin               │    │
│  │  • Intent token verification         │    │
│  │  • Cryptographic proof validation    │    │
│  │  • Policy enforcement                │    │
│  └──────────────────────────────────────┘    │
└──────────┬───────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────┐
│         Telegram Bot Interface               │
│                                              │
│  🚨 Alert: SSH Brute Force from 1.2.3.4     │
│  Confidence: 91% | Action: BAN IP           │
│  [✅ Approve]  [❌ Reject]  [👁 Details]    │
└──────────┬───────────────────────────────────┘
           │  Admin decision
           ▼
┌──────────────────────────────────────────────┐
│  ArmorClaw verifies → SENTINAL executes      │
│  audit_logger records full chain             │
└──────────────────────────────────────────────┘
```

---

## Three Operating Modes

### Mode A — Auto Execute
- Trigger: `confidence >= AUTO_EXECUTE_THRESHOLD` (default 0.95)
- Flow: Detection → Analysis → Auto ban → Telegram notification only
- No human required

### Mode B — Human Approval Required
- Trigger: `confidence >= REVIEW_THRESHOLD` (default 0.70)
- Flow: Detection → Analysis → Telegram alert with buttons → Admin approves → ArmorClaw verifies → SENTINAL executes

### Mode C — Monitor Only
- Trigger: `confidence < REVIEW_THRESHOLD`
- Flow: Detection → Analysis → Audit log only → Optional low-priority Telegram notice

---

## Files to Create (New)

```
services/
  openclaw_bridge.py       ← HTTP bridge to OpenClaw gateway
  telegram_notifier.py     ← Telegram alert formatting + sending
  ip_enforcer.py           ← Actual IP ban/unban via iptables/ufw

models/
  threat_analysis.py       ← Structured ThreatAnalysis Pydantic model
  action_proposal.py       ← ActionProposal model with approval states
  pending_action.py        ← PendingAction model for in-memory queue

dashboard/
  __init__.py
  auth.py                  ← JWT authentication
  routes.py                ← FastAPI dashboard routes
  models.py                ← Dashboard-specific Pydantic models

openclaw/
  config.yaml              ← OpenClaw bot config pointing to SENTINAL
  sentinal_tools.yaml      ← SENTINAL-specific tool definitions
```

## Files to Modify (Existing)

| File | Change |
|---|---|
| `intent_builder.py` | Return structured `ThreatAnalysis` object instead of raw string |
| `runtime.py` | Add confidence-based routing: auto / review / skip |
| `executor.py` | Only execute approved or auto-approved actions |
| `audit_logger.py` | Log full lifecycle: detection → approval → execution |
| `main.py` | Add `/actions/pending`, `/actions/{id}/approve`, `/actions/{id}/reject` |
| `policy.yaml` | Add thresholds + per-threat-type rules |
| `.env.example` | Add ARMORIQ_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, DASHBOARD_JWT_SECRET |
| `requirements.txt` | Add python-telegram-bot, python-jose, httpx, pydantic |

---

## Data Flow — Step by Step

```
Step 1: Detection layer fires:
  {
    "id": "alert-uuid",
    "ip": "103.45.67.89",
    "type": "brute_force",
    "payload": {...},
    "timestamp": "2026-03-29T22:00:00Z"
  }

Step 2: intent_builder.py analyzes:
  {
    "threat_type": "SSH_BRUTE_FORCE",
    "confidence": 0.91,
    "severity": "HIGH",
    "recommended_action": "BAN_IP",
    "reason": "147 failed SSH attempts in 90 seconds",
    "response_mode": "REVIEW_REQUIRED"
  }

Step 3: runtime.py routes:
  confidence 0.91 < 0.95  → REVIEW_REQUIRED
  → calls openclaw_bridge.send_for_approval(alert, analysis)

Step 4: Telegram message sent:
  🚨 SENTINAL Alert #alert-uuid
  IP: 103.45.67.89
  Threat: SSH Brute Force
  Confidence: 91% | Severity: HIGH
  Reason: 147 failed SSH attempts in 90s
  Action: BAN IP
  [✅ Approve] [❌ Reject]

Step 5: Admin taps Approve
  → ArmorClaw verifies intent token
  → POST /actions/alert-uuid/approve
  → executor.py runs ip_enforcer.ban("103.45.67.89")
  → audit_logger records full chain
  → Telegram confirms: ✅ IP 103.45.67.89 banned
```

---

## Prerequisites Before Coding

1. Install OpenClaw:
   ```bash
   curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
   ```

2. Get ArmorIQ API key from https://platform.armoriq.ai → API Dashboard → API Keys

3. Create Telegram bot via @BotFather → get `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`

4. Add all keys to `.env`

---

## Rollout Phases

### Phase 1 — Model Restructuring
- Define `ThreatAnalysis`, `ActionProposal`, `PendingAction` models
- Add approval states: PENDING, APPROVED, REJECTED, AUTO_EXECUTED, SKIPPED
- Modify `intent_builder.py` to return structured output
- Modify `runtime.py` to route by confidence

### Phase 2 — Services Layer
- Write `ip_enforcer.py`
- Write `telegram_notifier.py`
- Write `openclaw_bridge.py`
- Add `/actions` endpoints to `main.py`

### Phase 3 — OpenClaw Config
- Create `openclaw/config.yaml`
- Create `openclaw/sentinal_tools.yaml`
- Test full flow: fake alert → Telegram → approve → IP ban

### Phase 4 — Dashboard
- Build minimal FastAPI dashboard with JWT auth
- Pages: Login, Pending Actions, Audit Log, Blocked IPs

---

## Security Principles

- Never execute a destructive action directly from raw detection output
- All non-trivial actions must pass through policy gate
- Human approval required for ambiguous/medium-confidence cases
- OpenClaw tool permissions must be minimal (SENTINAL-specific only)
- Log every state transition in audit_logger
- JWT auth required for dashboard
- Admin allowlist for Telegram users
- Approval timeout for stale pending actions
- Idempotent action execution
- Rollback support for mistaken blocks

---

## Definition of Done

Integration is complete when:
1. A fake alert fires from `detector.py`
2. SENTINAL analyzes it and sends Telegram alert via OpenClaw
3. Admin taps Approve in Telegram
4. ArmorClaw verifies the intent token
5. SENTINAL bans the IP
6. Audit log records: `detection → analysis → approval → execution`
7. Dashboard shows blocked IP in history
