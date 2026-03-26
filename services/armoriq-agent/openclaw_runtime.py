"""
OpenClaw Runtime — ArmorClaw Integration
-----------------------------------------
Single responsibility: load policy.yaml and evaluate IntentModels
using the ArmorClaw SDK. Returns DecisionModel identical to the
original policy_engine.py contract so the rest of the pipeline
(executor, audit_logger) requires zero changes.

Fallback contract:
  If ArmorClaw SDK is unavailable OR OPENCLAW_DISABLED=true,
  this module raises RuntimeError so main.py can fall back to
  the original policy_engine.evaluate().

Flow:
  openclaw_runtime.evaluate(intent)
      └── _load_policies()          # cached on first call
      └── _build_claw_intent()      # translate IntentModel → Claw Intent
      └── ClawAgent.evaluate()      # ArmorClaw SDK call
      └── _to_decision_model()      # translate result → DecisionModel
"""

import os
import logging
import yaml
from functools import lru_cache
from datetime import datetime
from pathlib import Path

from models import IntentModel, DecisionModel

logger = logging.getLogger("armoriq.openclaw")

# Path to policy file (relative to this module)
POLICY_FILE = Path(__file__).parent / "policy.yaml"


# ---------------------------------------------------------------------------
# Policy loader (cached — file is read once at startup)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _load_policies() -> dict:
    """
    Load policy.yaml and return as dict.
    Raises RuntimeError if file is missing or invalid.
    """
    if not POLICY_FILE.exists():
        raise RuntimeError(f"policy.yaml not found at {POLICY_FILE}")
    with open(POLICY_FILE, "r") as fh:
        data = yaml.safe_load(fh)
    if not data:
        raise RuntimeError("policy.yaml is empty or invalid YAML")
    logger.info(f"[OPENCLAW] Policies loaded from {POLICY_FILE} — version={data.get('version')}")
    return data


# ---------------------------------------------------------------------------
# ArmorClaw SDK bridge
# ---------------------------------------------------------------------------

def _evaluate_with_sdk(intent: IntentModel, policies: dict) -> DecisionModel:
    """
    Call the ArmorClaw SDK.
    Raises ImportError if armorclaw is not installed.
    Raises RuntimeError on SDK evaluation failure.
    """
    try:
        from armorclaw import ClawAgent, Intent as ClawIntent  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "armorclaw package not installed. "
            "Run: pip install armorclaw  or check requirements.txt"
        ) from exc

    proposed = intent.proposed_action

    # Build ClawIntent from our IntentModel
    claw_intent = ClawIntent(
        intent_id=intent.intent_id,
        action=proposed.action,
        risk_level=proposed.risk_level,
        target=proposed.target,
        reason=proposed.reason,
        meta={
            "attackType": intent.attack_context.attackType,
            "severity":   intent.attack_context.severity,
            "confidence": intent.attack_context.confidence,
            "ip":         intent.attack_context.ip,
        }
    )

    # Build policy lists for the agent
    allowed  = [a["name"] for a in policies.get("allowed_actions", [])]
    blocked  = [b["name"] for b in policies.get("blocked_actions", [])]
    risk_rules = policies.get("risk_rules", [])

    agent = ClawAgent(
        allowed_actions=allowed,
        blocked_actions=blocked,
        risk_rules=risk_rules,
        default_decision=policies.get("default_decision", "BLOCK"),
        enforcement_level=policies.get("enforcement_level", "ArmorClaw-v1"),
    )

    result = agent.evaluate(claw_intent)

    logger.info(
        f"[OPENCLAW] {proposed.action} → {result.decision} "
        f"(rule={result.rule_id})"
    )

    return DecisionModel(
        intent_id=intent.intent_id,
        action=proposed.action,
        decision=result.decision,
        reason=result.reason,
        policy_rule_id=result.rule_id,
        timestamp=datetime.utcnow().isoformat() + "Z",
        enforcement_level=policies.get("enforcement_level", "ArmorClaw-v1"),
    )


# ---------------------------------------------------------------------------
# Inline policy evaluator (used when armorclaw SDK is not installed)
# Mirrors the exact same logic as policy_engine.py but driven by policy.yaml
# so the system is policy-file-driven even without the full SDK package.
# ---------------------------------------------------------------------------

def _evaluate_inline(intent: IntentModel, policies: dict) -> DecisionModel:
    """
    Evaluate intent against policy.yaml rules without the ArmorClaw SDK.
    Produces a DecisionModel identical to what the SDK would return.
    Used automatically when armorclaw is not importable.
    """
    proposed = intent.proposed_action
    enforcement = policies.get("enforcement_level", "ArmorClaw-v1")

    blocked_names  = {b["name"] for b in policies.get("blocked_actions", [])}
    allowed_names  = {a["name"] for a in policies.get("allowed_actions", [])}
    risk_rules     = policies.get("risk_rules", [])

    def _make(rule_id: str, decision: str, reason: str) -> DecisionModel:
        return DecisionModel(
            intent_id=intent.intent_id,
            action=proposed.action,
            decision=decision,
            reason=reason,
            policy_rule_id=rule_id,
            timestamp=datetime.utcnow().isoformat() + "Z",
            enforcement_level=enforcement,
        )

    # Rule: action is on the blocked list
    blocked_entry = next((b for b in policies.get("blocked_actions", []) if b["name"] == proposed.action), None)
    if blocked_entry:
        return _make(
            "RULE_001",
            "BLOCK",
            blocked_entry.get("reason", "Action requires human authorization — it is on the blocked list"),
        )

    # Risk-level rules (from policy.yaml)
    for rule in risk_rules:
        if proposed.risk_level == rule["risk_level"]:
            return _make(rule["rule_id"], rule["decision"], rule["reason"])

    # Action is on the allowed list
    if proposed.action in allowed_names:
        return _make("RULE_004", "ALLOW", "Action is in the pre-approved safe list (OpenClaw policy)")

    # Default deny
    return _make(
        policies.get("default_rule_id", "RULE_DEFAULT"),
        policies.get("default_decision", "BLOCK"),
        policies.get("default_reason", "No matching policy rule — default deny (fail-safe)"),
    )


# ---------------------------------------------------------------------------
# Public interface — called by main.py
# ---------------------------------------------------------------------------

def evaluate(intent: IntentModel) -> DecisionModel:
    """
    Evaluate an intent using OpenClaw / ArmorClaw runtime.

    1. Check OPENCLAW_DISABLED env var — raise RuntimeError if set
    2. Load policy.yaml (cached)
    3. Try ArmorClaw SDK first
    4. Fall back to inline policy evaluator if SDK not available
    5. Raise RuntimeError for any other failure so main.py can catch it
    """
    if os.getenv("OPENCLAW_DISABLED", "").lower() in ("1", "true", "yes"):
        raise RuntimeError("OpenClaw disabled via OPENCLAW_DISABLED env var")

    policies = _load_policies()

    try:
        return _evaluate_with_sdk(intent, policies)
    except ImportError:
        logger.warning(
            "[OPENCLAW] armorclaw SDK not installed — using inline policy evaluator. "
            "Install armorclaw for full SDK enforcement."
        )
        return _evaluate_inline(intent, policies)
    except Exception as exc:
        logger.error(f"[OPENCLAW] SDK evaluation failed: {exc}")
        raise RuntimeError(f"OpenClaw evaluation failed: {exc}") from exc


def is_loaded() -> bool:
    """Return True if policy.yaml has been loaded successfully."""
    try:
        _load_policies()
        return True
    except Exception:
        return False
