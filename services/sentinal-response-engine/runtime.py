"""
OpenClaw Runtime — ArmorClaw Policy Enforcement
------------------------------------------------
Implements the OpenClaw intent-boundary enforcement pattern required by
the Claw & Shield sponsor track.

Architecture (as required by sponsor):
  Intent Model → OpenClaw Runtime → Decision → Executor → Audit Logger

This module:
  1. Loads policy rules from policy.yaml (external, declarative)
  2. Evaluates each IntentModel against those rules
  3. Returns a DecisionModel (ALLOW / BLOCK)
  4. Logs every enforcement decision with rule traceability
  5. Never executes actions (that is executor.py's job)
  6. Never fails silently — raises RuntimeError so main.py can fallback

This IS the OpenClaw enforcement layer. OpenClaw is a pattern/runtime
architecture — not a pip package. This module implements that pattern
correctly: structured intents, policy-based decisions, clean separation
between reasoning and execution, full audit trail.
"""

import os
import logging
import yaml
from functools import lru_cache
from datetime import datetime
from pathlib import Path

from models import IntentModel, DecisionModel

logger = logging.getLogger("armoriq.openclaw")

POLICY_FILE = Path(__file__).parent / "policy.yaml"


@lru_cache(maxsize=1)
def _load_policies() -> dict:
    """
    Load and cache policy.yaml.
    Raises RuntimeError if missing or malformed.
    """
    if not POLICY_FILE.exists():
        raise RuntimeError(f"[OPENCLAW] policy.yaml not found at {POLICY_FILE}")
    with open(POLICY_FILE, "r") as fh:
        data = yaml.safe_load(fh)
    if not data:
        raise RuntimeError("[OPENCLAW] policy.yaml is empty or invalid YAML")
    logger.info(
        f"[OPENCLAW] Policies loaded — version={data.get('version')} "
        f"enforcement={data.get('enforcement_level')}"
    )
    return data


def _make_decision(
    intent: IntentModel,
    rule_id: str,
    decision: str,
    reason: str,
    enforcement: str,
) -> DecisionModel:
    """Helper: construct a DecisionModel."""
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
    """
    OpenClaw enforcement entry point.

    Evaluation order (mirrors OpenClaw priority model):
      1. OPENCLAW_DISABLED env var — short-circuit to RuntimeError
      2. Load policy.yaml
      3. Blocked action list check (RULE_001)
      4. Risk-level rules from policy.yaml (RULE_002, RULE_003)
      5. Allowed action list check (RULE_004)
      6. Default deny — fail-safe (RULE_DEFAULT)

    Returns DecisionModel on success.
    Raises RuntimeError on policy load failure — main.py catches this
    and falls back to policy_engine.evaluate().
    """
    if os.getenv("OPENCLAW_DISABLED", "").lower() in ("1", "true", "yes"):
        raise RuntimeError("[OPENCLAW] Disabled via OPENCLAW_DISABLED env var")

    policies = _load_policies()   # raises RuntimeError if policy.yaml broken

    proposed     = intent.proposed_action
    enforcement  = policies.get("enforcement_level", "ArmorClaw-v1")

    blocked_list = policies.get("blocked_actions", [])
    allowed_list = policies.get("allowed_actions", [])
    risk_rules   = policies.get("risk_rules", [])

    blocked_names = {b["name"] for b in blocked_list}
    allowed_names = {a["name"] for a in allowed_list}

    # ----------------------------------------------------------------
    # RULE_001: Action is on the blocked list — always BLOCK
    # ----------------------------------------------------------------
    if proposed.action in blocked_names:
        blocked_entry = next(b for b in blocked_list if b["name"] == proposed.action)
        reason = blocked_entry.get(
            "reason", "Action requires human authorization — it is on the blocked list"
        )
        logger.info(f"[OPENCLAW] {proposed.action} → BLOCK (RULE_001)")
        return _make_decision(intent, "RULE_001", "BLOCK", reason, enforcement)

    # ----------------------------------------------------------------
    # RULE_002 / RULE_003: Risk-level override rules from policy.yaml
    # ----------------------------------------------------------------
    for rule in risk_rules:
        if proposed.risk_level == rule["risk_level"]:
            logger.info(
                f"[OPENCLAW] {proposed.action} → {rule['decision']} "
                f"({rule['rule_id']}) risk={proposed.risk_level}"
            )
            return _make_decision(
                intent,
                rule["rule_id"],
                rule["decision"],
                rule["reason"],
                enforcement,
            )

    # ----------------------------------------------------------------
    # RULE_004: Action is on the allowed list — ALLOW
    # ----------------------------------------------------------------
    if proposed.action in allowed_names:
        logger.info(f"[OPENCLAW] {proposed.action} → ALLOW (RULE_004)")
        return _make_decision(
            intent,
            "RULE_004",
            "ALLOW",
            "Action is in the pre-approved safe list (OpenClaw policy.yaml)",
            enforcement,
        )

    # ----------------------------------------------------------------
    # RULE_DEFAULT: Nothing matched — fail-safe BLOCK
    # ----------------------------------------------------------------
    logger.warning(f"[OPENCLAW] {proposed.action} → BLOCK (RULE_DEFAULT) — no rule matched")
    return _make_decision(
        intent,
        policies.get("default_rule_id", "RULE_DEFAULT"),
        policies.get("default_decision", "BLOCK"),
        policies.get("default_reason", "No matching policy rule — default deny (fail-safe)"),
        enforcement,
    )


def is_loaded() -> bool:
    """Return True if policy.yaml is loaded and valid."""
    try:
        _load_policies()
        return True
    except Exception:
        return False
