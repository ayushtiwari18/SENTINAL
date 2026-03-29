# SENTINAL × OpenClaw × ArmorClaw — Complete Architecture & Implementation Plan

> Last updated: 2026-03-29

---

## 1. What OpenClaw & ArmorClaw Actually Are

After reading the official docs at [docs-openclaw.armoriq.ai](https://docs-openclaw.armoriq.ai):

| Component | What it actually is |
|---|---|
| **OpenClaw** | A Node.js AI agent framework that works inside Telegram, Slack, Discord — it browses the web, runs commands, manages files |
| **ArmorClaw** | A security plugin for OpenClaw — verifies every action the agent takes using cryptographic intent tokens and policy enforcement before execution |
| **ArmorIQ IAP** | The cloud backend that issues/validates intent tokens and stores audit logs |

**Key insight:** OpenClaw is NOT a cybersecurity threat analysis engine. It is a general-purpose secured AI agent. The correct integration is:
- SENTINAL = threat detection + response brain
- OpenClaw = admin/operator interface (Telegram bot)
- ArmorClaw = authorization layer for admin-triggered actions

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────┐
│                 DETECTION LAYER                     │
│        (Snort / Suricata / custom IDS)              │
│   Detects anomaly → fires structured JSON alert     │
└──────────────────────┬──────────────────────────────┘
                       │  Alert
                       ▼
┌─────────────────────────────────────────────────────┐
│          SENTINAL Response Engine (Python)          │
│                                                     │
│  intent_builder.py  → LLM threat analysis           │
│  runtime.py         → policy routing                │
│  executor.py        → action runner                 │
│  audit_logger.py    → full audit trail              │
└────────────┬──────────────────────────┬─────────────┘
             │ AUTO-EXECUTE             │ NEEDS REVIEW
             ▼                         ▼
┌────────────────────┐    ┌────────────────────────────┐
│  ip_enforcer.py    │    │  openclaw_bridge.py         │
│  (iptables / ufw)  │    │  sends to OpenClaw gateway  │
└────────────────────┘    └────────────┬───────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────┐
│           OpenClaw Gateway (Node.js)                │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  ArmorIQ Plugin (ArmorClaw)                 │   │
│  │  • Captures action intent                   │   │
│  │  • Requests cryptographic token from IAP    │   │
│  │  • Verifies policy before execution         │   │
│  └─────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Telegram Bot (Admin Interface)         │
│                                                     │
│  🚨 Alert: SSH Brute Force from 103.45.67.89        │
│  Confidence: 91% | Severity: HIGH                  │
│  Proposed: BAN IP                                  │
│                                                     │
│  [ ✅ Approve ]  [ ❌ Reject ]  [ 👁 Details ]       │
└──────────────────────┬──────────────────────────────┘
                       │  Admin decision
                       ▼
┌─────────────────────────────────────────────────────┐
│  ArmorClaw verifies intent → SENTINAL executes      │
│  audit_logger.py records full chain                 │
└─────────────────────────────────────────────────────┘
```

---

## 3. Response Modes

### Mode A — Auto Execute
Triggered when confidence exceeds auto-execute threshold.

```
Detection → Analysis (conf ≥ 0.95) → Auto ban → Telegram notify → Audit log
```

### Mode B — Human Review Required
Triggered when confidence is moderate.

```
Detection → Analysis (0.70 ≤ conf < 0.95) → OpenClaw/Telegram alert
         → Admin approves → ArmorClaw verifies → SENTINAL executes → Audit log
```

### Mode C — Monitor Only
Triggered when confidence is low.

```
Detection → Analysis (conf < 0.70) → Log only → Optional Telegram info
```

---

## 4. Data Flow — Step by Step

**Step 1: Detection Layer fires alert**
```json
{
  "id": "alert-1024",
  "source_ip": "103.45.67.89",
  "type": "brute_force",
  "attempts": 147,
  "window_seconds": 90,
  "timestamp": "2026-03-29T17:30:00Z"
}
```

**Step 2: intent_builder.py produces ThreatAnalysis**
```json
{
  "threat_type": "SSH_BRUTE_FORCE",
  "confidence": 0.91,
  "severity": "HIGH",
  "recommended_action": "BAN_IP",
  "reasoning": "147 failed SSH attempts in 90 seconds from single IP",
  "response_mode": "REVIEW_REQUIRED"
}
```

**Step 3: runtime.py routes the decision**
```python
if confidence >= AUTO_EXECUTE_THRESHOLD:   # 0.95
    executor.execute(action)
elif confidence >= REVIEW_THRESHOLD:       # 0.70
    openclaw_bridge.send_for_approval(alert, analysis)
else:
    audit_logger.log("monitor_only", alert)
```

**Step 4: Telegram alert sent via OpenClaw**
```
🚨 SENTINAL Alert #alert-1024

IP: 103.45.67.89
Threat: SSH Brute Force
Confidence: 91% | Severity: 🔴 HIGH

Reason:
147 failed login attempts in 90 seconds

Proposed Action: BAN IP

[ ✅ Approve ]  [ ❌ Reject ]
```

**Step 5: Admin taps Approve**
- OpenClaw receives callback
- ArmorClaw verifies: is this admin authorized? does policy allow this?
- Sends `POST /webhook/approve?action_id=alert-1024` to SENTINAL
- executor.py calls ip_enforcer.ban(ip)
- audit_logger.py records full chain

---

## 5. Files to Create

```
sentinal-response-engine/
├── services/
│   ├── openclaw_bridge.py       ← Bridge between SENTINAL and OpenClaw gateway
│   ├── telegram_notifier.py     ← Format + send Telegram alerts
│   └── ip_enforcer.py           ← Execute IP bans via iptables/ufw
│
├── models/
│   ├── threat_analysis.py       ← Pydantic model for LLM output
│   ├── action_proposal.py       ← Pydantic model for proposed actions
│   └── pending_action.py        ← Pydantic model for approval queue
│
├── dashboard/
│   ├── __init__.py
│   ├── auth.py                  ← JWT login for dashboard
│   ├── routes.py                ← FastAPI dashboard routes
│   └── models.py                ← Dashboard Pydantic models
│
├── openclaw/
│   ├── config.yaml              ← OpenClaw bot configuration
│   └── sentinal_tools.yaml      ← Custom SENTINAL tool definitions
│
├── .env.example                 ← Updated with new keys
└── requirements.txt             ← Updated dependencies
```

---

## 6. Files to Modify

| File | Change |
|---|---|
| `intent_builder.py` | Return structured `ThreatAnalysis` Pydantic model instead of raw dict |
| `runtime.py` | Add confidence-based routing: auto / review / monitor |
| `executor.py` | Only execute actions with status `APPROVED` or `AUTO_APPROVED` |
| `audit_logger.py` | Add fields: `approval_status`, `approved_by`, `armoriq_token` |
| `main.py` | Add `/webhook/approve`, `/webhook/reject`, `/actions/pending` endpoints |
| `policy.yaml` | Add confidence thresholds and per-threat-type rules |
| `.env.example` | Add `ARMORIQ_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, etc. |
| `requirements.txt` | Add `python-telegram-bot`, `python-jose`, `httpx`, `pydantic` |

---

## 7. New .env.example Keys

```env
# Existing
OPENAI_API_KEY=your_openai_key

# ArmorIQ / OpenClaw (from platform.armoriq.ai)
ARMORIQ_API_KEY=your_armoriq_key
OPENCLAW_GATEWAY_URL=http://localhost:3000

# Telegram Bot (from @BotFather)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_admin_chat_id

# Dashboard Auth
DASHBOARD_JWT_SECRET=your_jwt_secret_min_32_chars
DASHBOARD_ADMIN_PASSWORD=your_admin_password

# Policy Thresholds
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70

# Firewall Backend
FIREWALL_BACKEND=ufw   # options: ufw | iptables | noop
```

---

## 8. Updated policy.yaml Structure

```yaml
# SENTINAL Policy Definition
enforcement_level: SENTINAL-Policy-v1

thresholds:
  auto_execute: 0.95
  human_review: 0.70
  monitor_only_below: 0.70

rules:
  - threat_type: SSH_BRUTE_FORCE
    recommended_action: BAN_IP
    auto_execute_if_confidence_gte: 0.98
    review_if_confidence_gte: 0.70

  - threat_type: PORT_SCAN
    recommended_action: BAN_IP
    requires_human_review: true

  - threat_type: SQLI_ATTEMPT
    recommended_action: MONITOR
    requires_human_review: true

  - threat_type: DDOS
    recommended_action: RATE_LIMIT
    auto_execute_if_confidence_gte: 0.95

approval:
  timeout_minutes: 30
  default_on_timeout: REJECT
  allowed_telegram_user_ids:
    - YOUR_ADMIN_TELEGRAM_USER_ID

audit:
  log_all_detections: true
  log_all_decisions: true
  retention_days: 90
```

---

## 9. New Dependencies

```
# requirements.txt additions
python-telegram-bot==21.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.27.0
pydantic==2.6.0
```

---

## 10. OpenClaw Setup

### Install
```bash
curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
```

### Configure
After installation, add to OpenClaw config:
- `ARMORIQ_API_KEY` from [platform.armoriq.ai](https://platform.armoriq.ai)
- `OPENAI_API_KEY` or `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`

### SENTINAL-specific tools to expose in OpenClaw
```yaml
# openclaw/sentinal_tools.yaml
tools:
  - name: list_pending_threats
    description: Show all pending SENTINAL actions awaiting approval
    endpoint: GET http://localhost:8004/actions/pending

  - name: approve_action
    description: Approve a pending SENTINAL action by ID
    endpoint: POST http://localhost:8004/webhook/approve
    params:
      - action_id: string

  - name: reject_action
    description: Reject a pending SENTINAL action by ID
    endpoint: POST http://localhost:8004/webhook/reject
    params:
      - action_id: string

  - name: get_audit_log
    description: Retrieve recent SENTINAL audit events
    endpoint: GET http://localhost:8004/audit
    params:
      - hours: integer (default 24)

  - name: list_blocked_ips
    description: List all currently blocked IPs
    endpoint: GET http://localhost:8004/blocked-ips
```

**Important:** Do NOT expose unrestricted shell commands or file access. Only SENTINAL-specific operations.

---

## 11. Security Principles

- Never execute a destructive action directly from raw detection output
- All non-trivial actions must pass through policy routing
- Human approval required for ambiguous confidence scores
- OpenClaw tool permissions must be minimal and SENTINAL-specific
- Log every state transition: detection → analysis → decision → execution
- JWT auth required for dashboard access
- Admin Telegram user ID allowlist enforced
- Approval timeout with configurable default action
- Idempotent action execution (same action_id = same result)

---

## 12. Implementation Phases

### Phase 1 — Internal restructuring (Day 1)
- [ ] Define `ThreatAnalysis`, `ActionProposal`, `PendingAction` Pydantic models
- [ ] Add approval states: `PENDING | APPROVED | REJECTED | AUTO_EXECUTED | SKIPPED`
- [ ] Update `intent_builder.py` to return structured output
- [ ] Update `runtime.py` with confidence-based routing
- [ ] Update `audit_logger.py` with full lifecycle fields

### Phase 2 — Telegram integration (Day 1-2)
- [ ] Write `telegram_notifier.py`
- [ ] Write `ip_enforcer.py`
- [ ] Add `/webhook/approve` and `/webhook/reject` to `main.py`
- [ ] Test: fake alert → Telegram message → approve → IP ban

### Phase 3 — OpenClaw bridge (Day 2-3)
- [ ] Install OpenClaw: `curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash`
- [ ] Get ArmorIQ API key from [platform.armoriq.ai](https://platform.armoriq.ai)
- [ ] Write `openclaw_bridge.py`
- [ ] Create `openclaw/config.yaml` and `openclaw/sentinal_tools.yaml`
- [ ] Test full approval flow through OpenClaw

### Phase 4 — Dashboard (Day 3-4)
- [ ] Write `dashboard/auth.py` (JWT)
- [ ] Write `dashboard/routes.py` (pending, audit, blocked IPs)
- [ ] Test dashboard approval as backup to Telegram

---

## 13. Definition of Done

The integration is complete when this full flow works end-to-end:

1. `detector.py` fires a fake brute-force alert
2. SENTINAL analyzes it → confidence 0.91 → `REVIEW_REQUIRED`
3. Telegram message arrives with Approve/Reject buttons
4. Admin taps **Approve**
5. ArmorClaw verifies the intent token
6. `ip_enforcer.py` bans the IP
7. Audit log shows: `detection → analysis → pending → approved → executed`
8. Dashboard confirms the block in history

---

## 14. References

- OpenClaw docs: [docs-openclaw.armoriq.ai](https://docs-openclaw.armoriq.ai)
- ArmorIQ platform: [platform.armoriq.ai](https://platform.armoriq.ai)
- GitHub issues: [github.com/armoriq/armorclaw/issues](https://github.com/armoriq/armorclaw/issues)
- Support: license@armoriq.io
