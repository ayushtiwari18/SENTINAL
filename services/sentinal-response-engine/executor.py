"""
SENTINAL Response Engine — Executor
-------------------------------------
Only called AFTER policy_engine returns ALLOW.
Executes the allowed action by calling Gateway API endpoints.
All calls are fire-safe: exceptions are caught and logged, never re-raised.

Phase 4 upgrade: rate_limit_ip now writes a real entry to blocklist.txt
on disk — a provable real-world side effect that is observable (cat the file)
and reversible (delete the line or the file).

Fix: replaced raise_for_status() with explicit status check in _send_alert
so HTTP errors are clearly logged rather than silently swallowed.
"""

import httpx
import logging
import os
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("sentinal.executor")

GATEWAY_URL    = os.getenv("GATEWAY_URL", "http://localhost:3000")
BLOCKLIST_PATH = Path(__file__).parent / "blocklist.txt"


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
            return _write_blocklist(intent_data, attack_context)

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


def _write_blocklist(intent_data: dict, attack_context: dict) -> bool:
    """
    Write the rate-limited IP to blocklist.txt with a timestamp.
    Format: <ip>\t<timestamp>\t<attack_type>\t<attackId>
    This is a REAL side effect: the file is written to disk and can be
    read by any process (nginx, iptables script, etc.).
    Observable with: cat services/sentinal-response-engine/blocklist.txt
    Reversible: delete the line or rm the file.
    """
    ip          = intent_data.get("target", attack_context.get("ip", "unknown"))
    attack_type = attack_context.get("attackType", "unknown")
    attack_id   = attack_context.get("attackId", "unknown")
    timestamp   = datetime.utcnow().isoformat() + "Z"

    entry = f"{ip}\t{timestamp}\t{attack_type}\t{attack_id}\n"

    try:
        with open(BLOCKLIST_PATH, "a") as fh:
            fh.write(entry)
        logger.info(
            f"[EXECUTOR] rate_limit_ip: {ip} written to blocklist.txt "
            f"(attack={attack_type} id={attack_id})"
        )
        return True
    except Exception as e:
        logger.error(f"[EXECUTOR] blocklist write failed for ip={ip}: {e}")
        return False


async def _send_alert(intent_data: dict, attack_context: dict) -> bool:
    """
    Notifies Gateway to create/push an alert via its internal alert system.
    Uses explicit status check instead of raise_for_status() so HTTP errors
    are clearly logged rather than propagated as exceptions.
    """
    payload = {
        "attackId":   attack_context.get("attackId"),
        "ip":         attack_context.get("ip"),
        "attackType": attack_context.get("attackType"),
        "severity":   attack_context.get("severity"),
        "source":     "sentinal-response-engine",
        "message":    intent_data.get("reason", "SENTINAL Response Engine triggered alert"),
    }
    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.post(f"{GATEWAY_URL}/api/alerts/armoriq", json=payload)
        if resp.status_code in (200, 201):
            logger.info(f"[EXECUTOR] send_alert \u2192 Gateway responded {resp.status_code}")
            return True
        else:
            logger.warning(
                f"[EXECUTOR] send_alert \u2192 Gateway HTTP {resp.status_code}: {resp.text}"
            )
            return False
