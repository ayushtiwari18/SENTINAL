# SYSTEM BUG REPORT
> Phase 2 — Broken Logic Identification  
> Date: 2026-03-26

---

## BUG-001 — Custom Policy Engine Instead of OpenClaw

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/policy_engine.py` |
| **Function** | `evaluate()` |
| **Root Cause** | Policy enforcement uses a hand-written Python lambda rule list instead of the OpenClaw/ArmorClaw SDK runtime. |
| **Risk Level** | CRITICAL |
| **Impact** | Sponsor track (Claw & Shield) non-compliance. System cannot demonstrate OpenClaw enforcement. |
| **Fix Strategy** | Create `openclaw_runtime.py` wrapping ArmorClaw SDK. Replace `policy_engine.evaluate()` call in `main.py` with `openclaw_runtime.evaluate()`. Keep `policy_engine.py` as fallback. |

---

## BUG-002 — No policy.yaml — Policies Hard-Coded

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/policy_engine.py` |
| **Function** | Module-level sets `ALLOWED_ACTIONS`, `BLOCKED_ACTIONS`, `POLICY_RULES` |
| **Root Cause** | Policy definitions are embedded in Python source code, not in an external declarative file. |
| **Risk Level** | HIGH |
| **Impact** | Cannot change policies without redeploying code. Cannot pass policies to OpenClaw at runtime. |
| **Fix Strategy** | Create `services/armoriq-agent/policy.yaml`. Load it in `openclaw_runtime.py` at startup. |

---

## BUG-003 — Missing openclaw_runtime.py Module

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/` (missing) |
| **Function** | N/A — file does not exist |
| **Root Cause** | OpenClaw integration module was never created. |
| **Risk Level** | CRITICAL |
| **Impact** | There is no OpenClaw bridge. The agent cannot use ArmorClaw at all. |
| **Fix Strategy** | Create `services/armoriq-agent/openclaw_runtime.py` with full ArmorClaw integration (load policy, evaluate intent, return DecisionModel). |

---

## BUG-004 — armorclaw Not in requirements.txt

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/requirements.txt` |
| **Function** | N/A — dependency declaration |
| **Root Cause** | `armorclaw` package is not listed. No OpenClaw SDK will be installed in the container. |
| **Risk Level** | CRITICAL |
| **Impact** | `openclaw_runtime.py` will fail to import at startup. |
| **Fix Strategy** | Add `armorclaw` to `requirements.txt`. Add `pyyaml` for policy file loading. |

---

## BUG-005 — No Integration Tests

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/` (missing test files) |
| **Function** | N/A |
| **Root Cause** | No automated test suite exists for the ArmorIQ enforcement pipeline. |
| **Risk Level** | HIGH |
| **Impact** | Cannot prove allowed/blocked/approval scenarios work correctly. Required by sponsor track. |
| **Fix Strategy** | Create `services/armoriq-agent/tests/test_enforcement.py` covering all 4 scenarios. |

---

## BUG-006 — No Fallback on OpenClaw Crash

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/main.py` |
| **Function** | `respond()` |
| **Root Cause** | If policy evaluation raises an exception, the exception propagates up and returns HTTP 500. No fail-safe fallback. |
| **Risk Level** | HIGH |
| **Impact** | Any OpenClaw crash breaks the entire `/respond` endpoint, leaving the system unguarded. |
| **Fix Strategy** | Wrap `evaluate()` call in try/except. On failure, fall back to `policy_engine.evaluate()` (original engine) and log the fallback event. |

---

## BUG-007 — health Endpoint Does Not Reflect OpenClaw State

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/main.py` |
| **Function** | `health()` |
| **Root Cause** | `enforcement` field is hardcoded as `"ArmorIQ-Policy-v1"`. After OpenClaw integration it should reflect OpenClaw runtime state. |
| **Risk Level** | LOW |
| **Impact** | Misleading health information for operators. |
| **Fix Strategy** | Update health response to include `openclaw_loaded: true/false` and actual policy source. |

---

## BUG-008 — Executor 5s Timeout Blocks Main Loop

| Field | Value |
|-------|-------|
| **File** | `services/armoriq-agent/executor.py` |
| **Function** | `_send_alert()` |
| **Root Cause** | `httpx.AsyncClient(timeout=5.0)` in a synchronous-appearing loop means slow Gateway responses block the respond() handler. |
| **Risk Level** | MEDIUM |
| **Impact** | Under load, the /respond endpoint may time out for callers. |
| **Fix Strategy** | Wrap executor calls in `asyncio.create_task()` for fire-and-forget. Return response immediately, execute in background. |

---

## Summary Table

| Bug ID | Severity | Status | Action Required |
|--------|----------|--------|----------------|
| BUG-001 | CRITICAL | Open | Replace with OpenClaw |
| BUG-002 | HIGH | Open | Create policy.yaml |
| BUG-003 | CRITICAL | Open | Create openclaw_runtime.py |
| BUG-004 | CRITICAL | Open | Update requirements.txt |
| BUG-005 | HIGH | Open | Create integration tests |
| BUG-006 | HIGH | Open | Add try/except fallback |
| BUG-007 | LOW | Open | Update health endpoint |
| BUG-008 | MEDIUM | Open | Async executor calls |
