# SENTINAL × OpenClaw × ArmorClaw Integration Plan

## Vision

SENTINAL detects and responds to threats autonomously. OpenClaw (via Telegram) becomes the **admin command interface**. ArmorClaw enforces **policy verification** on every admin-triggered action before SENTINAL executes it.

---

## Core Clarification

OpenClaw + ArmorClaw is **not** a Python threat-detection SDK. It is a **secured agent/gateway system** (Node.js) that operates through chat interfaces like Telegram, Slack, Discord — with ArmorClaw enforcing authorization on each action before execution.

Correct integration model:
- **SENTINAL** = threat detection + response engine (stays Python)
- **OpenClaw** = admin/operator interface via Telegram
- **ArmorClaw** = authorization + policy verification for admin actions
- **Telegram** = primary approval channel
- **Dashboard** = secondary visibility/audit interface

---

## Architecture

```
┌─────────────────────────────────────────────┐
│             DETECTION LAYER                 │
│    (Snort / Suricata / custom IDS)          │
│  Detects threat → sends structured alert   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│        SENTINAL Response Engine             │
│            (Python / FastAPI)               │
│                                             │
│  intent_builder.py  ← LLM threat analysis  │
│  runtime.py         ← policy decision gate  │
│  executor.py        ← runs approved actions │
│  audit_logger.py    ← full audit trail      │
└──────────────────────┬──────────────────────┘
                       │ alert + proposed action
                       ▼
┌─────────────────────────────────────────────┐
│         OpenClaw Gateway (Node.js)          │
│   Receives SENTINAL alerts via HTTP         │
│   Sends approval prompts to Telegram        │
│   Routes admin decisions back to SENTINAL   │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│            ArmorClaw Layer                  │
│   Intent verification + policy enforcement  │
│   Approves or blocks each action            │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│       Telegram / Operator Interface         │
│   Admin sees alert → approve or reject      │
└─────────────────────────────────────────────┘
```

---

## Operating Modes

### Mode A — Auto-execute
- Confidence >= 0.95 AND policy allows → SENTINAL executes immediately
- Telegram receives notification only
- Audit log records full event

### Mode B — Human approval required
- Confidence >= 0.70 AND < 0.95, OR sensitive action type
- SENTINAL sends approval request to Telegram via OpenClaw
- Admin approves/rejects
- ArmorClaw verifies before execution

### Mode C — Observe only
- Confidence < 0.70
- Event stored in audit log
- Optional informational Telegram notice

---

## Telegram Approval Message Format

```
🚨 SENTINAL Threat Alert

Case ID: case-1024
IP: 103.45.67.89
Threat: SSH_BRUTE_FORCE
Confidence: 91%
Severity: 🔴 HIGH

Reason: 147 failed login attempts in 90 seconds

Proposed Action: BAN_IP

[✅ Approve] [❌ Reject] [👁 Details]
```

---

## Files to Create

```
services/
  openclaw_bridge.py      ← HTTP bridge to OpenClaw gateway
  telegram_notifier.py    ← formats + sends Telegram alerts
  ip_enforcer.py          ← executes IP ban/unban via iptables/ufw
models/
  threat_analysis.py      ← structured ThreatAnalysis dataclass
  action_proposal.py      ← structured ActionProposal dataclass
  pending_action.py       ← pending action state model
dashboard/
  auth.py                 ← JWT login
  routes.py               ← FastAPI routes
  models.py               ← Pydantic models
openclaw/
  config.yaml             ← OpenClaw bot config
  sentinal_tools.yaml     ← SENTINAL-specific tool definitions
```

## Files to Modify

| File | Change |
|---|---|
| `intent_builder.py` | Return structured `ThreatAnalysis` with confidence, type, severity, action |
| `runtime.py` | Add confidence-based routing: auto / hold / skip |
| `executor.py` | Only execute approved/auto-approved actions |
| `audit_logger.py` | Log full lifecycle: detection → analysis → approval → execution |
| `main.py` | Add `/actions/pending`, `/actions/{id}/approve`, `/actions/{id}/reject` endpoints |
| `policy.yaml` | Add `auto_execute_confidence`, `review_required_confidence`, per-threat rules |
| `.env.example` | Add new env vars (see below) |
| `requirements.txt` | Add new dependencies |

---

## New Environment Variables

```env
# ArmorIQ / OpenClaw
ARMORIQ_API_KEY=your_armoriq_key
OPENCLAW_GATEWAY_URL=http://localhost:3000

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_admin_chat_id
TELEGRAM_ALLOWED_USERS=comma_separated_user_ids

# Dashboard Auth
DASHBOARD_JWT_SECRET=your_jwt_secret
DASHBOARD_ADMIN_PASSWORD=your_admin_password

# Policy Thresholds
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70

# IP Enforcement
FIREWALL_BACKEND=ufw
```

---

## New Dependencies

```txt
python-telegram-bot==21.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
pydantic==2.6.0
```

---

## Rollout Phases

### Phase 1 — Model restructuring
- Define `ThreatAnalysis`, `ActionProposal`, `PendingAction` models
- Add approval states: PENDING, APPROVED, REJECTED, AUTO_EXECUTED, SKIPPED
- Update `intent_builder.py` and `runtime.py`

### Phase 2 — Telegram integration
- Write `telegram_notifier.py`
- Write `ip_enforcer.py`
- Add approval endpoints to `main.py`

### Phase 3 — OpenClaw + ArmorClaw bridge
- Install OpenClaw: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- Write `openclaw_bridge.py`
- Configure `openclaw/config.yaml` and `openclaw/sentinal_tools.yaml`
- Test full flow: alert → Telegram → approve → ban → audit

### Phase 4 — Dashboard
- JWT auth
- Pending actions view
- Audit log view
- Blocked IPs view

---

## Definition of Done

1. Fake alert fires from detection layer
2. SENTINAL analyzes → creates pending action
3. Telegram message sent via OpenClaw
4. Admin approves in Telegram
5. ArmorClaw verifies intent
6. SENTINAL bans IP
7. Audit log records: detection → analysis → approval → execution
8. Dashboard shows blocked IP in history

---

## Security Principles

- Never execute destructive actions directly from raw detection output
- All non-trivial actions must pass through policy
- Human approval required for ambiguous/sensitive cases
- Keep OpenClaw tool permissions minimal and SENTINAL-specific
- Log every state transition
- Admin allowlist for Telegram users
- Approval timeout for stale pending actions
- Idempotent action execution
- Rollback support for mistaken blocks
