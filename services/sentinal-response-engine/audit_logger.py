"""
SENTINAL Response Engine — Audit Logger
-----------------------------------------
Writes every policy decision (ALLOW or BLOCK) to Gateway's audit_log
via POST /api/audit/ingest.
Non-blocking: failures are logged but never raise to caller.

Fix: normalise status to uppercase before sending so Gateway enum validation passes.
"""

import httpx
import logging
import os
from models import DecisionModel, IntentModel

logger = logging.getLogger("nexus.audit")

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")


async def log_decision(intent: IntentModel, decision: DecisionModel) -> bool:
    """
    POST audit entry to Gateway /api/audit/ingest.
    Returns True if successfully written, False on any error.
    Uses dot-access on ProposedAction (typed Pydantic model).
    """
    # Normalise: ALLOW → ALLOWED,  BLOCK → BLOCKED
    status_map = {"ALLOW": "ALLOWED", "BLOCK": "BLOCKED"}
    status = status_map.get(decision.decision.upper(), decision.decision.upper())

    payload = {
        "intent_id":          decision.intent_id,
        "action":             decision.action,
        "status":             status,
        "reason":             decision.reason,
        "policy_rule_id":     decision.policy_rule_id,
        "enforcement_level":  decision.enforcement_level,
        "triggeredBy":        "agent",
        "ip":                 intent.attack_context.ip,
        "attackId":           str(intent.attack_context.attackId),
        "meta": {
            "attackType":  intent.attack_context.attackType,
            "severity":    intent.attack_context.severity,
            "confidence":  intent.attack_context.confidence,
            "risk_level":  intent.proposed_action.risk_level,
        }
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{GATEWAY_URL}/api/audit/ingest",
                json=payload
            )
            if resp.status_code in (200, 201):
                logger.info(
                    f"[AUDIT] {decision.action} → {status} "
                    f"(rule={decision.policy_rule_id}) ✔ logged"
                )
                return True
            else:
                logger.warning(
                    f"[AUDIT] Gateway returned {resp.status_code}: {resp.text}"
                )
                return False
    except Exception as e:
        logger.warning(f"[AUDIT] Failed to post audit entry: {e}")
        return False
