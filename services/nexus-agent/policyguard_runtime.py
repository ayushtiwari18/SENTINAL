"""
Nexus Agent — PolicyGuard Runtime
-----------------------------------
Implements the PolicyGuard intent-boundary enforcement pattern.

Architecture:
  Intent Model → PolicyGuard Runtime → Decision → Executor → Audit Logger
"""

import os
import logging
import yaml
from functools import lru_cache
from datetime import datetime
from pathlib import Path

from models import IntentModel, DecisionModel

logger = logging.getLogger("nexus.policy_guard")

POLICY_FILE = Path(__file__).parent / "policy.yaml"


@lru_cache(maxsize=1)
def _load_policies() -> dict:
    if not POLICY_FILE.exists():
        raise RuntimeError(f"[POLICY_GUARD] policy.yaml not found at {POLICY_FILE}")
    with open(POLICY_FILE, "r") as fh:
        data = yaml.safe_load(fh)
    if not data:
        raise RuntimeError("[POLICY_GUARD] policy.yaml is empty or invalid YAML")
    logger.info(
        f"[POLICY_GUARD] Policies loaded — version={data.get('version')} "
        f"enforcement={data.get('enforcement_level')}"
    )
    return data


def _make_decision(intent, rule_id, decision, reason, enforcement):
    return DecisionModel(
        intent_id=intent.intent_id,
        action=intent.proposed_action.action,
        decision=decision,
        reason=reason,
        policy_rule_id=rule_id,
        timestamp=datetime.utcnow().isoformat() + "Z",
        enforcement_level=enforcement,
    )


def evaluate(intent: IntentModel) -> DecisionModel:
    if os.getenv("POLICY_GUARD_DISABLED", "").lower() in ("1", "true", "yes"):
        raise RuntimeError("[POLICY_GUARD] Disabled via POLICY_GUARD_DISABLED env var")

    policies = _load_policies()

    proposed     = intent.proposed_action
    enforcement  = policies.get("enforcement_level", "PolicyGuard-v1")

    blocked_list = policies.get("blocked_actions", [])
    allowed_list = policies.get("allowed_actions", [])
    risk_rules   = policies.get("risk_rules", [])

    blocked_names = {b["name"] for b in blocked_list}
    allowed_names = {a["name"] for a in allowed_list}

    if proposed.action in blocked_names:
        blocked_entry = next(b for b in blocked_list if b["name"] == proposed.action)
        reason = blocked_entry.get(
            "reason", "Action requires human authorization — it is on the blocked list"
        )
        logger.info(f"[POLICY_GUARD] {proposed.action} → BLOCK (RULE_001)")
        return _make_decision(intent, "RULE_001", "BLOCK", reason, enforcement)

    for rule in risk_rules:
        if proposed.risk_level == rule["risk_level"]:
            logger.info(
                f"[POLICY_GUARD] {proposed.action} → {rule['decision']} "
                f"({rule['rule_id']}) risk={proposed.risk_level}"
            )
            return _make_decision(
                intent, rule["rule_id"], rule["decision"], rule["reason"], enforcement,
            )

    if proposed.action in allowed_names:
        logger.info(f"[POLICY_GUARD] {proposed.action} → ALLOW (RULE_004)")
        return _make_decision(
            intent, "RULE_004", "ALLOW",
            "Action is in the pre-approved safe list (PolicyGuard policy.yaml)",
            enforcement,
        )

    logger.warning(f"[POLICY_GUARD] {proposed.action} → BLOCK (RULE_DEFAULT) — no rule matched")
    return _make_decision(
        intent,
        policies.get("default_rule_id", "RULE_DEFAULT"),
        policies.get("default_decision", "BLOCK"),
        policies.get("default_reason", "No matching policy rule — default deny (fail-safe)"),
        enforcement,
    )


def is_loaded() -> bool:
    try:
        _load_policies()
        return True
    except Exception:
        return False
