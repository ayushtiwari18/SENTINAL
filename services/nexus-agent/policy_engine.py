"""
Nexus Agent — Policy Engine
-----------------------------
Pure deterministic function — no I/O, no LLM, no side effects.
Takes an IntentModel, returns a DecisionModel.
Default behaviour: BLOCK (fail-safe).
"""

from models import IntentModel, DecisionModel
from datetime import datetime

ALLOWED_ACTIONS = {
    "send_alert",
    "log_attack",
    "rate_limit_ip",
    "flag_for_review",
    "generate_report",
}

BLOCKED_ACTIONS = {
    "permanent_ban_ip",
    "shutdown_endpoint",
    "purge_all_sessions",
    "modify_firewall_rules",
}

POLICY_RULES = [
    (
        "RULE_001",
        lambda p: p.action in BLOCKED_ACTIONS,
        "BLOCK",
        "Action requires human authorization — it is on the blocked list",
    ),
    (
        "RULE_002",
        lambda p: p.risk_level == "critical",
        "BLOCK",
        "Critical-risk actions are never auto-executed",
    ),
    (
        "RULE_003",
        lambda p: p.risk_level == "high",
        "BLOCK",
        "High-risk actions require human approval",
    ),
    (
        "RULE_004",
        lambda p: p.action in ALLOWED_ACTIONS,
        "ALLOW",
        "Action is in the pre-approved safe list",
    ),
]


def evaluate(intent: IntentModel) -> DecisionModel:
    proposed = intent.proposed_action

    for rule_id, condition, decision, reason in POLICY_RULES:
        try:
            if condition(proposed):
                return DecisionModel(
                    intent_id=intent.intent_id,
                    action=proposed.action,
                    decision=decision,
                    reason=reason,
                    policy_rule_id=rule_id,
                    timestamp=datetime.utcnow().isoformat() + "Z",
                )
        except Exception:
            continue

    return DecisionModel(
        intent_id=intent.intent_id,
        action=proposed.action,
        decision="BLOCK",
        reason="No matching policy rule — default deny",
        policy_rule_id="RULE_DEFAULT",
        timestamp=datetime.utcnow().isoformat() + "Z",
    )
