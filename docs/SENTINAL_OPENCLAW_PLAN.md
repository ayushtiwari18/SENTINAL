# SENTINAL × OpenClaw × ArmorClaw — Complete Architecture & Implementation Plan

> **Last updated:** March 2026  
> **Status:** Planning phase

---

## 1. What These Products Actually Are

| Product | What it is | What it is NOT |
|---|---|---|
| **OpenClaw** | A Node.js AI agent gateway — runs locally, operates via Telegram/Slack/Discord | A Python threat-analysis SDK |
| **ArmorClaw** | A security plugin for OpenClaw — verifies every agent action with intent tokens + policy enforcement | A firewall or IP-ban library |
| **SENTINAL** | Your Python cybersecurity response engine — detects threats, analyzes them, executes responses | Unchanged — remains the core engine |

---

## 2. Revised Architecture

```
┌─────────────────────────────────────────────┐
│           DETECTION LAYER                   │
│   (IDS / Snort / Suricata / custom)         │
│   Detects anomaly → fires structured alert  │
└──────────────────────┬──────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────┐
│       SENTINAL Response Engine              │
│           (Python / FastAPI)                │
│                                             │
│  intent_builder.py   ← LLM threat analysis  │
│  runtime.py          ← policy gate          │
│  executor.py         ← action runner        │
│  audit_logger.py     ← full audit trail     │
└──────────────────────┬──────────────────────┘
                       │
              ┌────────┴────────┐
              │                 │
        HIGH confidence    MEDIUM confidence
        auto-execute       needs human approval
              │                 │
              ▼                 ▼
        executor.py    ┌────────────────────┐
        bans IP        │  OpenClaw Gateway  │
        immediately    │  (Node.js local)   │
                       │                   │
                       │  ArmorClaw Plugin  │
                       │  verifies intent   │
                       │  token + policy    │
                       └────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Telegram Bot         │
                    │                       │
                    │  🚨 Alert message     │
                    │  [✅ Approve] [❌ Reject] │
                    └───────────┬───────────┘
                                │ admin decision
                                ▼
                    SENTINAL executes action
                    audit_logger records chain
```

---

## 3. Operating Modes

### Mode A — Auto-Execute (High Confidence)
- Confidence >= `AUTO_EXECUTE_THRESHOLD` (default: 0.95)
- Policy allows immediate block
- SENTINAL executes directly, sends Telegram notification only
- Full audit trail recorded

### Mode B — Human Approval Required (Medium Confidence)
- Confidence between `REVIEW_THRESHOLD` (0.70) and `AUTO_EXECUTE_THRESHOLD` (0.95)
- SENTINAL creates pending action
- OpenClaw sends Telegram alert with approve/reject buttons
- ArmorClaw verifies admin's intent token before executing
- SENTINAL executes only after ArmorClaw approval

### Mode C — Monitor Only (Low Confidence)
- Confidence < `REVIEW_THRESHOLD` (0.70)
- Event logged to audit trail
- Optional low-priority Telegram notice
- No action taken

---

## 4. Data Flow — Step by Step

### Step 1: Alert arrives
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

### Step 2: SENTINAL analyzes (intent_builder.py)
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

### Step 3: Policy gate (runtime.py)
```python
if confidence >= 0.95:
    # AUTO — execute immediately
elif confidence >= 0.70:
    # HOLD — send to OpenClaw/Telegram for approval
else:
    # SKIP — log only
```

### Step 4: Telegram message (via OpenClaw)
```
🚨 SENTINAL Alert #alert-uuid-001

IP: 103.45.67.89
Threat: SSH Brute Force
Confidence: 91%
Severity: 🔴 HIGH
Reason: 147 failed SSH attempts in 90s

Proposed Action: BAN IP

[✅ Approve] [❌ Reject] [👁 Details]
```

### Step 5: Admin approves
1. Admin taps ✅ Approve in Telegram
2. OpenClaw receives callback
3. **ArmorClaw verifies intent token** (is admin authorized? does policy allow this?)
4. Sends `POST /webhook/approve?action_id=uuid` to SENTINAL
5. `executor.py` runs `ip_enforcer.ban(ip)`
6. `audit_logger.py` records full chain

---

## 5. Files to Create

```
sentinal-response-engine/
├── services/
│   ├── openclaw_bridge.py      ← HTTP bridge: SENTINAL ↔ OpenClaw gateway
│   ├── telegram_notifier.py    ← Formats + sends Telegram alerts
│   └── ip_enforcer.py          ← Executes IP ban/unban via iptables/ufw
│
├── models/
│   ├── threat_analysis.py      ← Pydantic model: ThreatAnalysis
│   ├── action_proposal.py      ← Pydantic model: ActionProposal
│   └── pending_action.py       ← Pydantic model: PendingAction (with approval state)
│
├── dashboard/
│   ├── __init__.py
│   ├── auth.py                 ← JWT login
│   ├── routes.py               ← FastAPI routes: /actions, /audit, /blocked-ips
│   └── models.py               ← Request/response schemas
│
└── openclaw/
    ├── config.yaml             ← OpenClaw bot config pointing to SENTINAL webhooks
    └── sentinal_tools.yaml     ← Custom tool definitions for admin commands
```

---

## 6. Files to Modify

| File | Change |
|---|---|
| `intent_builder.py` | Return structured `ThreatAnalysis` with confidence, severity, response_mode |
| `runtime.py` | Add confidence-based routing: auto / review / skip |
| `executor.py` | Only execute actions with status APPROVED or AUTO_APPROVED |
| `audit_logger.py` | Log full lifecycle: detection → analysis → decision → execution |
| `main.py` | Add `/webhook/approve`, `/webhook/reject`, `/actions/pending` endpoints |
| `policy.yaml` | Add confidence thresholds + per-threat-type rules |
| `.env.example` | Add ARMORIQ_API_KEY, OPENCLAW_GATEWAY_URL, TELEGRAM_BOT_TOKEN, etc. |
| `requirements.txt` | Add python-telegram-bot, python-jose, httpx, pydantic |

---

## 7. OpenClaw Strategy

### What OpenClaw SHOULD do in SENTINAL
- Act as the admin operator interface via Telegram
- Expose narrow, SENTINAL-specific commands:
  - `list pending threats`
  - `approve block for case X`
  - `reject case X`
  - `list blocked IPs`
  - `show last 20 audit events`

### What OpenClaw should NOT do
- Arbitrary shell execution
- Broad file system access
- Unrestricted browsing
- Unrestricted policy editing

> Keep the exposed tool surface minimal and SENTINAL-specific only.

---

## 8. ArmorClaw Strategy

### What ArmorClaw SHOULD verify
- Admin is authorized (intent token)
- Requested action matches active policy
- Cryptographic proof is valid
- Action is within allowed parameters

### What ArmorClaw is NOT
- Not a threat detector
- Not a replacement for SENTINAL's policy.yaml
- Not a Python firewall SDK

> ArmorClaw = authorization + secure execution verification layer only.

---

## 9. Updated policy.yaml Structure

```yaml
# SENTINAL Response Engine — Policy Definition
# Do NOT modify without human review

enforcement_level: SENTINAL-Policy-v1

thresholds:
  auto_execute_confidence: 0.95
  human_review_confidence: 0.70
  default_low_confidence_action: monitor

rules:
  - threat_type: SSH_BRUTE_FORCE
    action: BAN_IP
    auto_execute_if_confidence_gte: 0.98
    review_required_if_confidence_gte: 0.70

  - threat_type: PORT_SCAN
    action: BAN_IP
    requires_human_review: true

  - threat_type: SQLI_ATTEMPT
    action: MONITOR
    requires_human_review: true

  - threat_type: DDOS
    action: RATE_LIMIT
    auto_execute_if_confidence_gte: 0.90

approval:
  timeout_minutes: 30
  timeout_action: skip
  require_armoriq_token: true
```

---

## 10. .env.example Updates

```env
# === Existing ===
OPENAI_API_KEY=your_openai_key

# === ArmorIQ / OpenClaw ===
ARMORIQ_API_KEY=your_armoriq_key_from_platform.armoriq.ai
OPENCLAW_GATEWAY_URL=http://localhost:3000

# === Telegram Bot ===
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_CHAT_ID=your_admin_chat_id

# === Dashboard Auth ===
DASHBOARD_JWT_SECRET=your_jwt_secret_min_32_chars
DASHBOARD_ADMIN_PASSWORD=your_admin_password

# === Policy Thresholds ===
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70

# === IP Enforcement ===
FIREWALL_BACKEND=ufw
# Options: ufw | iptables | noop (noop = dry-run, no real bans)
```

---

## 11. requirements.txt Additions

```txt
# Add to existing requirements.txt
python-telegram-bot==21.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
pydantic==2.6.0
# python-iptables==1.0.1  # uncomment if using iptables directly
```

---

## 12. Implementation Phases

### Phase 1 — Model restructuring (Day 1)
- [ ] Define `ThreatAnalysis` Pydantic model
- [ ] Define `ActionProposal` Pydantic model
- [ ] Define `PendingAction` model with states: PENDING / APPROVED / REJECTED / AUTO_EXECUTED / SKIPPED
- [ ] Update `intent_builder.py` to return structured output
- [ ] Update `runtime.py` with confidence-based routing

### Phase 2 — Core services (Day 1–2)
- [ ] Write `ip_enforcer.py` — wraps ufw/iptables with noop fallback
- [ ] Write `telegram_notifier.py` — formats alerts + inline buttons
- [ ] Write `openclaw_bridge.py` — HTTP bridge to OpenClaw gateway
- [ ] Update `main.py` — add webhook endpoints
- [ ] Update `audit_logger.py` — full lifecycle logging

### Phase 3 — OpenClaw + ArmorClaw integration (Day 2–3)
- [ ] Install OpenClaw: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- [ ] Get ArmorIQ API key from platform.armoriq.ai
- [ ] Create `openclaw/config.yaml`
- [ ] Create `openclaw/sentinal_tools.yaml`
- [ ] Test full flow: fake alert → Telegram message → approve → IP ban

### Phase 4 — Dashboard (Day 3–4)
- [ ] Build FastAPI dashboard with JWT auth
- [ ] Pages: Login, Pending Actions, Blocked IPs, Audit Log
- [ ] Connect to same webhook endpoints

---

## 13. Security Principles

1. Never execute destructive actions directly from raw detection output
2. All non-trivial actions must pass through policy gate
3. Human approval required for ambiguous/medium-confidence cases
4. Keep OpenClaw tool permissions minimal and SENTINAL-specific
5. Log every state transition in audit_logger
6. Admin allowlist for Telegram — only authorized user IDs can approve
7. Approval timeout for stale pending actions (default: 30 minutes)
8. Idempotent action execution — same action_id never executes twice

---

## 14. Definition of Done

The integration is complete when:

- [ ] Fake alert fires from detector
- [ ] SENTINAL analyzes it and creates pending action
- [ ] Telegram message received with approve/reject buttons
- [ ] Admin taps Approve
- [ ] ArmorClaw verifies intent token
- [ ] SENTINAL bans the IP
- [ ] Audit log records: `detection → analysis → approval → execution`
- [ ] Dashboard shows blocked IP in history

---

## 15. References

- OpenClaw docs: https://docs-openclaw.armoriq.ai/docs
- ArmorIQ platform: https://platform.armoriq.ai
- ArmorClaw install: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- ArmorClaw GitHub: https://github.com/armoriq/armorclaw
