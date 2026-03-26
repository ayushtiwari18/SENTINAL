"""
ArmorIQ Policy Engine
---------------------
Pure deterministic function — no I/O, no LLM, no side effects.
Takes an intent dict, returns a DecisionModel.
Default behaviour: BLOCK (fail-safe).
"""

from models import IntentModel, DecisionModel
from datetime import datetime

# Actions that ArmorIQ may execute autonomously (low-risk, reversible)
ALLOWED_ACTIONS = {
    "send_alert",
    "log_attack",
    "rate_limit_ip",
    "flag_for_review",
    "generate_report",
}

# Actions that MUST wait for human approval (high-risk / irreversible)
BLOCKED_ACTIONS = {
    "permanent_ban_ip",
    "shutdown_endpoint",
    "purge_all_sessions",
    "modify_firewall_rules",
}

# Ordered rules: (id, condition, decision, reason)
POLICY_RULES = [
    (
        "RULE_001",
        lambda intent: intent["action"] in BLOCKED_ACTIONS,
        "BLOCK",
        "Action requires human authorization — it is on the blocked list",
    ),
    (
        "RULE_002",
        lambda intent: intent["risk_level"] == "critical",
        "BLOCK",
        "Critical-risk actions are never auto-executed",
    ),
    (
        "RULE_003",
        lambda intent: intent["risk_level"] == "high",
        "BLOCK",
        "High-risk actions require human approval",
    ),
    (
        "RULE_004",
        lambda intent: intent["action"] in ALLOWED_ACTIONS,
        "ALLOW",
        "Action is in the pre-approved safe list",
    ),
]


def evaluate(intent: IntentModel) -> DecisionModel:
    """
    Evaluate a single intent against all policy rules.
    First matching rule wins. Falls back to BLOCK if nothing matches.
    """
    proposed = intent.proposed_action

    for rule_id, condition, decision, reason in POLICY_RULES:
        try:
            if condition(proposed):
                return DecisionModel(
                    intent_id=intent.intent_id,
                    action=proposed["action"],
                    decision=decision,
                    reason=reason,
                    policy_rule_id=rule_id,
                    timestamp=datetime.utcnow().isoformat() + "Z",
                )
        except Exception:
            continue

    # Fail-safe default
    return DecisionModel(
        intent_id=intent.intent_id,
        action=proposed.get("action", "unknown"),
        decision="BLOCK",
        reason="No matching policy rule — default deny",
        policy_rule_id="RULE_DEFAULT",
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
