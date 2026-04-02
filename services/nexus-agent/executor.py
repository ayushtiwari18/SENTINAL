"""
Nexus Agent — Executor
-----------------------
Only called AFTER policy_engine returns ALLOW.
Executes the allowed action by calling Gateway API endpoints.
All calls are fire-safe: exceptions are caught and logged, never re-raised.

IPs are stored in MongoDB via Gateway /api/blocklist.
The local blocklist.txt is NO LONGER USED — IPs are enforced in real-time
by the SENTINAL Express middleware via MongoDB.

Flow:
  POST to Gateway /api/blocklist  (MongoDB enforcement by middleware)
"""

import httpx
import logging
import os
from datetime import datetime

logger = logging.getLogger("nexus.executor")

GATEWAY_URL = os.getenv("GATEWAY_URL", "http://localhost:3000")

# How long to block a rate-limited IP (in minutes). 0 = permanent.
BLOCK_DURATION_MINUTES = int(os.getenv("BLOCK_DURATION_MINUTES", "60"))


async def execute(action: str, intent_data: dict, attack_context: dict) -> bool:
    """
    Execute a single allowed action.
    Returns True if execution succeeded, False otherwise.
    """
    try:
        if action == "send_alert":
            return await _send_alert(intent_data, attack_context)

        elif action == "log_attack":
            logger.info(f"[EXECUTOR] log_attack acknowledged for attackId={attack_context.get('attackId')}")
            return True

        elif action == "rate_limit_ip":
            return await _block_ip(intent_data, attack_context)

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


async def _block_ip(intent_data: dict, attack_context: dict) -> bool:
    """
    Block an IP by POSTing to Gateway /api/blocklist (MongoDB).
    Enforced in real-time by Express middleware.
    Returns True if MongoDB write succeeded.
    """
    ip          = intent_data.get("target", attack_context.get("ip", "unknown"))
    attack_type = attack_context.get("attackType", "unknown")
    attack_id   = attack_context.get("attackId", "unknown")
    reason      = intent_data.get("reason", f"rate_limit_ip triggered for {attack_type}")

    try:
        payload = {
            "ip":              ip,
            "reason":          reason,
            "attackType":      attack_type,
            "attackId":        attack_id,
            "durationMinutes": BLOCK_DURATION_MINUTES if BLOCK_DURATION_MINUTES > 0 else None,
            "blockedBy":       "nexus-agent",
        }
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{GATEWAY_URL}/api/blocklist",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code in (200, 201):
            logger.info(
                f"[EXECUTOR] rate_limit_ip: {ip} saved to MongoDB blocklist "
                f"(duration={BLOCK_DURATION_MINUTES}min attack={attack_type})"
            )
            return True
        else:
            logger.warning(
                f"[EXECUTOR] Gateway /api/blocklist returned HTTP {resp.status_code} for ip={ip}: {resp.text}"
            )
            return False

    except Exception as e:
        logger.error(f"[EXECUTOR] MongoDB blocklist POST failed for ip={ip}: {e}")
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
        "source":     "nexus-agent",
        "message":    intent_data.get("reason", "NEXUS triggered alert"),
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(f"{GATEWAY_URL}/api/alerts/nexus", json=payload)
        if resp.status_code in (200, 201):
            logger.info(f"[EXECUTOR] send_alert → Gateway responded {resp.status_code}")
            return True
        else:
            logger.warning(
                f"[EXECUTOR] send_alert → Gateway HTTP {resp.status_code}: {resp.text}"
            )
            return False
