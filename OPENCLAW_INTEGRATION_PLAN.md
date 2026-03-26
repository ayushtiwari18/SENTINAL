# OPENCLAW INTEGRATION PLAN
> Phase 3 — Integration Design  
> Date: 2026-03-26

---

## 1. Objective

Replace the custom `policy_engine.py` evaluation logic with the **ArmorClaw (OpenClaw) runtime** while:
- Preserving all existing API contracts
- Keeping `executor.py` and `audit_logger.py` unchanged
- Maintaining fail-safe BLOCK default
- Adding backward-compatible fallback to `policy_engine.py` on OpenClaw crash

---

## 2. Target Architecture

```
POST /respond
      │
      ▼
┌─────────────────────┐
│   Intent Builder    │   intent_builder.py (UNCHANGED)
│  build_intents(ctx) │
└────────┬────────────┘
         │  list[IntentModel]
         ▼
┌─────────────────────────┐
│  OpenClaw Runtime       │   openclaw_runtime.py  (NEW)
│  evaluate(intent)       │
│  ┌───────────────────┐  │
│  │  Load policy.yaml │  │   policy.yaml  (NEW)
│  │  ArmorClaw SDK    │  │
│  │  Return decision  │  │
│  └───────────────────┘  │
│  Fallback: policy_engine│   policy_engine.py  (PRESERVED)
└────────┬────────────────┘
         │  DecisionModel
         ▼
┌─────────────────────┐
│   Executor          │   executor.py (UNCHANGED)
│  execute(action)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Audit Logger      │   audit_logger.py (UNCHANGED)
│  log_decision()     │
└─────────────────────┘
         │
         ▼
   Gateway /api/audit/ingest
```

---

## 3. New Files to Create

| File | Location | Purpose |
|------|----------|---------|
| `openclaw_runtime.py` | `services/armoriq-agent/` | OpenClaw SDK wrapper, policy loader, evaluator |
| `policy.yaml` | `services/armoriq-agent/` | Externalized policy definitions |
| `tests/test_enforcement.py` | `services/armoriq-agent/tests/` | Integration test suite |
| `tests/__init__.py` | `services/armoriq-agent/tests/` | Python package marker |

---

## 4. Files to Modify

| File | Change | Risk |
|------|--------|------|
| `services/armoriq-agent/main.py` | Import `openclaw_runtime` instead of `policy_engine`; add try/except fallback; update health endpoint | LOW — same interface |
| `services/armoriq-agent/requirements.txt` | Add `armorclaw`, `pyyaml` | LOW — additive only |

---

## 5. Files to Preserve Unchanged

- `services/armoriq-agent/executor.py` — NO CHANGES
- `services/armoriq-agent/audit_logger.py` — NO CHANGES
- `services/armoriq-agent/intent_builder.py` — NO CHANGES
- `services/armoriq-agent/models.py` — NO CHANGES
- `services/armoriq-agent/policy_engine.py` — KEPT as fallback
- All `backend/` files — NO CHANGES
- All `services/detection-engine/` files — NO CHANGES

---

## 6. openclaw_runtime.py — Design Spec

```python
# Responsibilities:
# 1. Load policy.yaml at module init (cached)
# 2. Provide evaluate(intent: IntentModel) -> DecisionModel
# 3. Wrap ArmorClaw SDK evaluation call
# 4. Return DecisionModel with same fields as policy_engine.py
# 5. On any exception: raise RuntimeError so main.py can fall back

# ArmorClaw SDK expected interface:
# from armorclaw import ClawAgent, Intent, Policy
# agent = ClawAgent(policies=[...])
# result = agent.evaluate(Intent(action=..., risk_level=..., ...))
# result.decision  → "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL"
# result.rule_id   → str
# result.reason    → str
```

---

## 7. policy.yaml — Design Spec

```yaml
# Externalized policy for OpenClaw runtime

version: "1.0"
enforcement_level: "ArmorClaw-v1"

allowed_actions:
  - send_alert
  - log_attack
  - rate_limit_ip
  - flag_for_review
  - generate_report

blocked_actions:
  - permanent_ban_ip
  - shutdown_endpoint
  - purge_all_sessions
  - modify_firewall_rules

risk_rules:
  - risk_level: critical
    decision: BLOCK
    reason: "Critical-risk actions are never auto-executed"
  - risk_level: high
    decision: BLOCK
    reason: "High-risk actions require human approval"

default_decision: BLOCK
default_reason: "No matching policy rule — default deny (fail-safe)"
```

---

## 8. main.py Changes — Design Spec

```python
# BEFORE:
from policy_engine import evaluate

# AFTER:
from openclaw_runtime import evaluate as openclaw_evaluate
from policy_engine import evaluate as fallback_evaluate

def evaluate_with_fallback(intent):
    try:
        return openclaw_evaluate(intent)
    except Exception as e:
        logger.error(f"[OPENCLAW] Runtime error: {e} — falling back to policy_engine")
        return fallback_evaluate(intent)
```

---

## 9. Integration Test Plan

| Test | Scenario | Expected Decision |
|------|----------|-------------------|
| `test_allow_send_alert` | action=send_alert, risk=low | ALLOW |
| `test_block_permanent_ban` | action=permanent_ban_ip, risk=high | BLOCK |
| `test_block_critical_risk` | action=any, risk=critical | BLOCK |
| `test_fallback_on_openclaw_crash` | OpenClaw raises, fallback fires | BLOCK (via policy_engine) |
| `test_invalid_intent` | missing fields | HTTP 422 |
| `test_respond_endpoint_full` | POST /respond with critical attack | mixed ALLOW+BLOCK |

---

## 10. Rollback Strategy

If OpenClaw integration fails in production:
1. Set env var `OPENCLAW_DISABLED=true`
2. `openclaw_runtime.py` detects this and raises immediately → falls back to `policy_engine.py`
3. System continues operating with original deterministic engine
4. Zero API contract changes required

---

## 11. Phased Rollout

| Phase | Action | Risk |
|-------|--------|------|
| 4a | Create `policy.yaml` | None — new file |
| 4b | Create `openclaw_runtime.py` | None — new file, not yet wired |
| 4c | Update `requirements.txt` | Low — additive |
| 4d | Wire `main.py` with fallback | Low — fallback guards it |
| 4e | Update health endpoint | Cosmetic |
| 4f | Create integration tests | None — test only |
