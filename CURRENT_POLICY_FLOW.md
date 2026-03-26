# CURRENT POLICY FLOW
> Phase 1 — Policy Engine Identification  
> Date: 2026-03-26

---

## Where Decisions Are Made

**File:** `services/armoriq-agent/policy_engine.py`  
**Function:** `evaluate(intent: IntentModel) -> DecisionModel`

This is the **sole policy evaluation point**. It is a pure Python function with no external runtime, no YAML policy file, no OpenClaw.

---

## Current Policy Flow Diagram

```
POST /respond  (ArmorIQ Agent)
        │
        ▼
  build_intents(ctx)          ← intent_builder.py
        │  returns list[IntentModel]
        │
   for each intent:
        │
        ▼
  policy_engine.evaluate(intent)   ← policy_engine.py
        │  walks POLICY_RULES list (lambda conditions)
        │  first match wins → DecisionModel
        │  fallback: BLOCK (fail-safe)
        │
        ▼
  audit_logger.log_decision()       ← audit_logger.py
        │  POST /api/audit/ingest → Gateway
        │
        ├── if ALLOW ──► executor.execute()  ← executor.py
        │                    │  dispatches by action name
        │                    │  _send_alert() → Gateway
        │                    │  rate_limit_ip, flag_for_review, etc.
        │
        └── if BLOCK ──► ActionResult appended to actionsQueued
                             returned in RespondResponse
```

---

## Where Actions Are Executed

**File:** `services/armoriq-agent/executor.py`  
**Function:** `execute(action, intent_data, attack_context) -> bool`

Called **only** after `evaluate()` returns `decision="ALLOW"`. The executor dispatches on the action string and performs HTTP calls back to the Gateway. It is correctly gated — it never executes blocked actions.

---

## Where Approvals Are Handled

Blocked/queued actions are returned in `actionsQueued` list inside `RespondResponse`. The **Gateway** (`backend/src/routes/actions.js`) stores these and exposes:
- `POST /api/actions/:id/approve`
- `POST /api/actions/:id/reject`

Human operators interact via the dashboard.

---

## Where Logging Happens

**File:** `services/armoriq-agent/audit_logger.py`  
**Function:** `log_decision(intent, decision) -> bool`

Called for **every** intent — ALLOW and BLOCK both get logged. Posts to `POST /api/audit/ingest` on the Gateway, which persists to MongoDB `AuditLog` collection.

---

## Current Policy Rules (Hard-Coded)

| Rule ID | Condition | Decision | Reason |
|---------|-----------|----------|--------|
| RULE_001 | action in BLOCKED_ACTIONS set | BLOCK | Human authorization required |
| RULE_002 | risk_level == "critical" | BLOCK | Never auto-execute |
| RULE_003 | risk_level == "high" | BLOCK | Requires approval |
| RULE_004 | action in ALLOWED_ACTIONS set | ALLOW | Pre-approved safe list |
| RULE_DEFAULT | (no match) | BLOCK | Default deny (fail-safe) |

---

## Problem Statement

The policy engine is **fully custom Python** — hand-written lambdas over hard-coded sets. It does not use the **OpenClaw / ArmorClaw** runtime required by the Claw & Shield sponsor track. This causes:

1. **Sponsor non-compliance** — ArmorClaw must be the policy runtime
2. **Policies are not externalized** — no `policy.yaml`, no hot-reload
3. **No OpenClaw audit trail** — enforcement decisions are not OpenClaw-native
4. **Architecture mismatch** — the intent/runtime/decision separation is not formally OpenClaw-structured

---

## Target Flow (After OpenClaw Integration)

```
build_intents()
      │
      ▼
openclaw_runtime.evaluate(intent)   ← NEW FILE
      │  loads policy.yaml
      │  calls ArmorClaw SDK
      │  returns DecisionModel
      ▼
executor.execute()   (UNCHANGED)
      ▼
audit_logger.log_decision()   (UNCHANGED)
```
