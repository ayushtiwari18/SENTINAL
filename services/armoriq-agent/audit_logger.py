"""
ArmorIQ Audit Logger
--------------------
Writes every policy decision (ALLOW or BLOCK) to Gateway's audit_log
via POST /api/audit/ingest.
Non-blocking: failures are logged but never raise to caller.
"""

import httpx
import logging
import os
from models import DecisionModel, IntentModel

logger = logging.getLogger("armoriq.audit")

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")


async def log_decision(intent: IntentModel, decision: DecisionModel) -> bool:
    """
    POST audit entry to Gateway.
    """
    payload = {
        "intent_id":          decision.intent_id,
        "timestamp":          decision.timestamp,
        "action":             decision.action,
        "status":             decision.decision,       # ALLOWED | BLOCKED
        "reason":             decision.reason,
        "policy_rule_id":     decision.policy_rule_id,
        "enforcement_level":  decision.enforcement_level,
        "triggeredBy":        "agent",
        "ip":                 intent.attack_context.ip,
        "attackId":           intent.attack_context.attackId,
        "meta": {
            "attackType":  intent.attack_context.attackType,
            "severity":    intent.attack_context.severity,
            "confidence":  intent.attack_context.confidence,
            "risk_level":  intent.proposed_action.get("risk_level"),
        }
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(f"{GATEWAY_URL}/api/audit/ingest", json=payload)
            resp.raise_for_status()
            logger.info(
                f"[AUDIT] {decision.action} → {decision.decision} "
                f"(rule={decision.policy_rule_id}) logged"
            )
            return True
    except Exception as e:
        logger.warning(f"[AUDIT] Failed to post audit entry: {e}")
        return False
