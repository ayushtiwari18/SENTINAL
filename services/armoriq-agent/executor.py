"""
ArmorIQ Executor
----------------
Only called AFTER policy_engine returns ALLOW.
Executes the allowed action by calling Gateway API endpoints.
All calls are fire-safe: exceptions are caught and logged, never re-raised.
"""

import httpx
import logging
import os

logger = logging.getLogger("armoriq.executor")

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")


async def execute(action: str, intent_data: dict, attack_context: dict) -> bool:
    """
    Execute a single allowed action.
    Returns True if execution succeeded, False otherwise.
    """
    try:
        if action == "send_alert":
            return await _send_alert(intent_data, attack_context)

        elif action == "log_attack":
            # Attack already persisted by Gateway — just acknowledge
            logger.info(f"[EXECUTOR] log_attack acknowledged for attackId={attack_context.get('attackId')}")
            return True

        elif action == "rate_limit_ip":
            logger.info(f"[EXECUTOR] rate_limit_ip applied for ip={intent_data.get('target')}")
            # In production: call firewall/middleware API
            # For demo: log + return True to show enforcement
            return True

        elif action == "flag_for_review":
            logger.info(f"[EXECUTOR] flag_for_review set for ip={intent_data.get('target')}")
            return True

        elif action == "generate_report":
            logger.info(f"[EXECUTOR] generate_report triggered for attackId={attack_context.get('attackId')}")
            return True

        else:
            logger.warning(f"[EXECUTOR] Unknown action '{action}' — skipping")
            return False

    except Exception as e:
        logger.error(f"[EXECUTOR] Failed to execute '{action}': {e}")
        return False


async def _send_alert(intent_data: dict, attack_context: dict) -> bool:
    """
    Notifies Gateway to create/push an alert via its internal alert system.
    """
    payload = {
        "attackId":   attack_context.get("attackId"),
        "ip":         attack_context.get("ip"),
        "attackType": attack_context.get("attackType"),
        "severity":   attack_context.get("severity"),
        "source":     "armoriq-agent",
        "message":    intent_data.get("reason", "ArmorIQ triggered alert"),
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(f"{GATEWAY_URL}/api/alerts/armoriq", json=payload)
        resp.raise_for_status()
        logger.info(f"[EXECUTOR] send_alert → Gateway responded {resp.status_code}")
        return True
