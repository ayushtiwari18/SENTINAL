"""
OpenClaw Bridge — SENTINAL ↔ OpenClaw Gateway

This module bridges the SENTINAL Python backend with the OpenClaw
Node.js gateway running locally. It sends pending action requests
to the operator channel and receives approve/reject decisions.

OpenClaw docs: https://docs-openclaw.armoriq.ai/docs
ArmorClaw verifies every action before execution.
"""

import os
import httpx
import logging
from typing import Optional

logger = logging.getLogger("sentinal.openclaw_bridge")

OPENCLAW_GATEWAY_URL = os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:3000")
ARMORIQ_API_KEY = os.getenv("ARMORIQ_API_KEY", "")


class OpenClawBridge:
    """
    Bridge between SENTINAL and the OpenClaw gateway.

    Responsibilities:
    - Send approval requests to the operator channel (Telegram/Slack)
    - Receive and forward approve/reject decisions to executor
    - Normalize operator decisions into SENTINAL action states
    """

    def __init__(self):
        self.gateway_url = OPENCLAW_GATEWAY_URL
        self.headers = {
            "Authorization": f"Bearer {ARMORIQ_API_KEY}",
            "Content-Type": "application/json",
        }

    async def send_approval_request(
        self,
        action_id: str,
        ip: str,
        threat_type: str,
        confidence: float,
        severity: str,
        reason: str,
        recommended_action: str,
    ) -> bool:
        """
        Send a pending action to the operator channel via OpenClaw.
        ArmorClaw will verify the action before it is forwarded.

        Returns True if successfully queued, False otherwise.
        """
        payload = {
            "action_id": action_id,
            "ip": ip,
            "threat_type": threat_type,
            "confidence": confidence,
            "severity": severity,
            "reason": reason,
            "recommended_action": recommended_action,
            "sentinal_webhook": {
                "approve": f"{os.getenv('SENTINAL_BASE_URL', 'http://localhost:8004')}/actions/{action_id}/approve",
                "reject": f"{os.getenv('SENTINAL_BASE_URL', 'http://localhost:8004')}/actions/{action_id}/reject",
            },
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.gateway_url}/sentinal/pending-action",
                    headers=self.headers,
                    json=payload,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    logger.info(f"[OPENCLAW] Approval request queued for action {action_id}")
                    return True
                else:
                    logger.error(
                        f"[OPENCLAW] Failed to queue action {action_id}: {response.status_code} {response.text}"
                    )
                    return False
        except httpx.RequestError as e:
            logger.error(f"[OPENCLAW] Gateway unreachable: {e}")
            # Fallback: try direct Telegram notification
            return False

    async def notify_auto_executed(
        self,
        action_id: str,
        ip: str,
        threat_type: str,
        confidence: float,
        action_taken: str,
    ) -> None:
        """
        Notify the operator channel that an action was auto-executed
        (no approval required — high confidence threshold met).
        """
        payload = {
            "type": "auto_executed",
            "action_id": action_id,
            "ip": ip,
            "threat_type": threat_type,
            "confidence": confidence,
            "action_taken": action_taken,
        }

        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.gateway_url}/sentinal/notification",
                    headers=self.headers,
                    json=payload,
                    timeout=10.0,
                )
                logger.info(f"[OPENCLAW] Auto-execution notified for action {action_id}")
        except httpx.RequestError as e:
            logger.warning(f"[OPENCLAW] Could not send auto-execution notification: {e}")


# Singleton instance
openclaw_bridge = OpenClawBridge()
