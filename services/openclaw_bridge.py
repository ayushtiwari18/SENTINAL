"""
openclaw_bridge.py
HTTP bridge between SENTINAL Response Engine and the OpenClaw Gateway.

This module is the adapter layer. When ArmorIQ publishes SDK updates,
only this file needs to change — the rest of SENTINAL stays untouched.

OpenClaw Gateway runs locally at OPENCLAW_GATEWAY_URL (default: http://localhost:3000)
Install it first: curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("sentinal.openclaw_bridge")

GATEWAY_URL = os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:3000")
ARMORIQ_API_KEY = os.getenv("ARMORIQ_API_KEY", "")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {ARMORIQ_API_KEY}",
        "Content-Type": "application/json",
        "X-Source": "sentinal-response-engine",
    }


def send_approval_request(action_id: str, alert: dict, analysis: dict) -> bool:
    """
    Send a pending action to the OpenClaw gateway for admin review.
    OpenClaw will route this to the configured chat platform (Telegram/Slack).

    Returns True if successfully queued, False on failure.
    """
    payload = {
        "action_id": action_id,
        "source": "sentinal",
        "alert": alert,
        "analysis": analysis,
        "webhook_approve": f"{os.getenv('SENTINAL_BASE_URL', 'http://localhost:8004')}/webhook/approve",
        "webhook_reject": f"{os.getenv('SENTINAL_BASE_URL', 'http://localhost:8004')}/webhook/reject",
    }

    try:
        resp = httpx.post(
            f"{GATEWAY_URL}/sentinal/approval-request",
            json=payload,
            headers=_headers(),
            timeout=10.0,
        )
        if resp.status_code == 200:
            logger.info(f"[OPENCLAW] Approval request queued: {action_id}")
            return True
        else:
            logger.error(f"[OPENCLAW] Failed to queue approval: {resp.status_code} {resp.text}")
            return False
    except httpx.ConnectError:
        logger.warning(
            "[OPENCLAW] Gateway unreachable — falling back to direct Telegram notification. "
            "Is OpenClaw running? Run: curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash"
        )
        return False
    except Exception as e:
        logger.error(f"[OPENCLAW] Unexpected error: {e}")
        return False


def notify_auto_execution(action_id: str, alert: dict, analysis: dict, result: dict) -> None:
    """
    Notify OpenClaw that SENTINAL auto-executed an action (no approval needed).
    This creates an audit record in ArmorIQ and sends a Telegram notification.
    """
    payload = {
        "action_id": action_id,
        "source": "sentinal",
        "execution_type": "AUTO_EXECUTED",
        "alert": alert,
        "analysis": analysis,
        "result": result,
    }

    try:
        httpx.post(
            f"{GATEWAY_URL}/sentinal/auto-execution",
            json=payload,
            headers=_headers(),
            timeout=5.0,
        )
        logger.info(f"[OPENCLAW] Auto-execution notified: {action_id}")
    except Exception as e:
        logger.warning(f"[OPENCLAW] Could not notify auto-execution (non-critical): {e}")


def verify_armoriq_token(token: str, action_id: str) -> bool:
    """
    Verify an ArmorClaw intent token before executing an approved action.
    This calls the ArmorIQ Intent Access Proxy (IAP) to validate the token.

    CRITICAL: Always call this before executing a human-approved action.
    """
    if not token:
        logger.error(f"[OPENCLAW] No intent token provided for action {action_id}")
        return False

    try:
        resp = httpx.post(
            f"{GATEWAY_URL}/armoriq/verify-token",
            json={"token": token, "action_id": action_id},
            headers=_headers(),
            timeout=5.0,
        )
        if resp.status_code == 200 and resp.json().get("valid"):
            logger.info(f"[OPENCLAW] Intent token verified for action {action_id}")
            return True
        else:
            logger.warning(f"[OPENCLAW] Token verification failed for {action_id}: {resp.text}")
            return False
    except Exception as e:
        logger.error(f"[OPENCLAW] Token verification error: {e}")
        return False


def is_gateway_healthy() -> bool:
    """Check if the OpenClaw gateway is running."""
    try:
        resp = httpx.get(f"{GATEWAY_URL}/health", timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False
