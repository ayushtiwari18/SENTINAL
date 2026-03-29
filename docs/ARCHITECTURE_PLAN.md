# SENTINAL × OpenClaw × ArmorClaw — Architecture Plan

## Core Design

SENTINAL is the threat detection and response engine.
OpenClaw is the admin operator interface (via Telegram).
ArmorClaw is the authorization and policy verification layer.

## Flow

1. Detection layer fires alert
2. SENTINAL analyzes → produces ThreatAnalysis
3. If confidence >= 0.95 → auto-execute
4. If confidence >= 0.70 → send to Telegram for human approval
5. Admin approves/rejects via OpenClaw bot
6. ArmorClaw verifies the action before execution
7. SENTINAL executes → audit_logger records everything

## Architecture

```
Detection Layer
     │
     ▼
SENTINAL Response Engine (Python)
  - intent_builder.py   → LLM threat analysis
  - runtime.py          → policy + confidence gate
  - executor.py         → runs approved actions
  - audit_logger.py     → full audit trail
     │
     ▼
OpenClaw Gateway (Node.js) + ArmorClaw Plugin
  - Telegram bot interface
  - ArmorClaw intent token verification
  - Policy enforcement before execution
     │
     ▼
Admin (Telegram)
  - Approve / Reject pending actions
```

## Operating Modes

### AUTO (confidence >= 0.95)
- SENTINAL executes immediately
- Telegram notification sent (info only)
- Full audit log recorded

### REVIEW (confidence 0.70–0.95)
- Action held as PENDING
- Telegram alert sent via OpenClaw
- Admin approves or rejects
- ArmorClaw verifies before execution

### MONITOR (confidence < 0.70)
- No action taken
- Event logged only

## New Files Required

```
services/openclaw_bridge.py     - HTTP bridge to OpenClaw gateway
services/telegram_notifier.py   - Telegram alert formatting
services/ip_enforcer.py         - iptables/ufw IP ban execution
models/threat_analysis.py       - Structured threat output model
models/action_proposal.py       - Action proposal model
models/pending_action.py        - Pending action state model
```

## Files to Modify

```
intent_builder.py   - return structured ThreatAnalysis
runtime.py          - confidence-based routing
executor.py         - only run approved actions
audit_logger.py     - full lifecycle logging
main.py             - add /actions/approve and /actions/reject endpoints
policy.yaml         - add confidence thresholds
.env.example        - add new required keys
requirements.txt    - add new dependencies
```

## Required Environment Variables

```
ARMORIQ_API_KEY=
OPENCLAW_GATEWAY_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
DASHBOARD_JWT_SECRET=
AUTO_EXECUTE_CONFIDENCE=0.95
HUMAN_REVIEW_CONFIDENCE=0.70
FIREWALL_BACKEND=ufw
```

## Policy Thresholds (policy.yaml additions)

```yaml
response_policy:
  auto_execute_confidence: 0.95
  human_review_confidence: 0.70
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
```

## Rollout Stages

- Stage 1: Structured models + policy routing
- Stage 2: Telegram notifications
- Stage 3: OpenClaw + ArmorClaw connection
- Stage 4: Dashboard (optional, secondary)

## First Milestone Definition

Done when:
1. Fake alert fires
2. SENTINAL analyzes it
3. Telegram alert sent
4. Admin approves
5. IP gets banned
6. Audit log records full chain
