# ArmorIQ Agent — SENTINEL Intent Enforcement Service

**Port:** `8004`  
**Language:** Python 3.11+ / FastAPI  
**Role:** Policy-based runtime enforcement of autonomous agent actions

---

## What ArmorIQ Does

- Receives confirmed attack context from Gateway after every `AttackEvent` is saved
- Builds structured `Intent` objects for each proposed response action
- Evaluates every intent through a **deterministic policy engine** (no LLM, no ML)
- **Allows** low-risk actions immediately (send_alert, log_attack, rate_limit_ip)
- **Blocks** high/critical-risk actions and queues them for human review
- Logs every decision to `audit_log` via Gateway for full traceability

## What ArmorIQ Does NOT Do

- Parse packets or analyze traffic
- Run ML/rule detection
- Store `AttackEvent` records (Gateway does that)
- Render UI
- Make irreversible decisions autonomously

---

## Start

```bash
cd services/armoriq-agent
pip install -r requirements.txt
cp .env.example .env
uvicorn main:app --port 8004 --reload
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/respond` | Main enforcement endpoint (called by Gateway) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_URL` | `http://localhost:3000` | Gateway API base URL |
| `ARMORIQ_PORT` | `8004` | Port to serve on |

---

## Policy Rules

| Rule ID | Condition | Decision |
|---------|-----------|----------|
| RULE_001 | action in BLOCKED_ACTIONS | BLOCK |
| RULE_002 | risk_level == "critical" | BLOCK |
| RULE_003 | risk_level == "high" | BLOCK |
| RULE_004 | action in ALLOWED_ACTIONS | ALLOW |
| RULE_DEFAULT | no rule matches | BLOCK |

## Allowed vs Blocked Actions

**Auto-executed (ALLOW):**
`send_alert` · `log_attack` · `rate_limit_ip` · `flag_for_review` · `generate_report`

**Queued for human approval (BLOCK):**
`permanent_ban_ip` · `shutdown_endpoint` · `purge_all_sessions` · `modify_firewall_rules`

---

## Demo Scenario

1. Send a critical SQLi attack via `POST /api/logs/ingest`
2. Detection Engine detects it → Gateway saves AttackEvent
3. Gateway calls ArmorIQ `POST /respond` (non-blocking)
4. ArmorIQ proposes: `send_alert` (ALLOW) + `shutdown_endpoint` (BLOCK)
5. `send_alert` executes → alert appears on Dashboard
6. `shutdown_endpoint` queued → `PendingActionCard` appears on `/action-queue`
7. Audit log at `/audit` shows both decisions with policy rule IDs
8. Judge clicks APPROVE → action status updates, audit log records human decision
