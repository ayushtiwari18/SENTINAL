"""
ArmorIQ Intent Builder
----------------------
Translates raw attack context into a list of proposed IntentModels.
One attack → multiple proposed intents (one per candidate action).
"""

from models import IntentModel, AttackContext


def _derive_actions(ctx: AttackContext) -> list[dict]:
    """
    Derive candidate actions from attack context.
    Returns list of proposed_action dicts.
    """
    actions = []

    # Always proposed for any detected attack
    actions.append({
        "action": "send_alert",
        "target": ctx.ip,
        "reason": f"{ctx.attackType.upper()} detected from {ctx.ip} with {ctx.severity} severity",
        "risk_level": "low",
    })

    actions.append({
        "action": "log_attack",
        "target": ctx.attackId,
        "reason": "Record attack for forensic audit trail",
        "risk_level": "low",
    })

    # Rate limit on medium and above
    if ctx.severity in ("medium", "high", "critical"):
        actions.append({
            "action": "rate_limit_ip",
            "target": ctx.ip,
            "reason": f"Repeated {ctx.attackType} activity from this IP",
            "risk_level": "low",
        })

    # Flag for review on high/critical
    if ctx.severity in ("high", "critical"):
        actions.append({
            "action": "flag_for_review",
            "target": ctx.ip,
            "reason": f"High severity attack requires analyst review",
            "risk_level": "low",
        })

    # Permanent ban proposed (will be BLOCKED by policy) on critical
    if ctx.severity == "critical" and ctx.confidence >= 0.9:
        actions.append({
            "action": "permanent_ban_ip",
            "target": ctx.ip,
            "reason": f"Critical confidence {ctx.attackType} attack — ban proposed",
            "risk_level": "high",
        })

    # Shutdown endpoint proposed (will be BLOCKED) on critical successful attack
    if ctx.severity == "critical" and ctx.status == "successful":
        actions.append({
            "action": "shutdown_endpoint",
            "target": ctx.ip,
            "reason": "Critical attack succeeded — endpoint shutdown proposed",
            "risk_level": "critical",
        })

    return actions


def build_intents(ctx: AttackContext) -> list[IntentModel]:
    """
    Build a list of IntentModels from an attack context.
    """
    proposed_actions = _derive_actions(ctx)
    intents = []
    for proposed in proposed_actions:
        intents.append(
            IntentModel(
                attack_context=ctx,
                proposed_action=proposed,
            )
        )
    return intents
