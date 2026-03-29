"""
OpenClaw Bridge — SENTINAL → OpenClaw Gateway

Responsibilities:
- Send pending action approval requests to the OpenClaw gateway
- Receive approve/reject decisions from OpenClaw callback
- Normalize operator decisions into SENTINAL action updates

The OpenClaw gateway runs locally (Node.js) after installing ArmorClaw.
Installation: curl -fsSL https://armoriq.ai/install-armorclaw.sh | bash
Docs: https://docs-openclaw.armoriq.ai
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("sentinal.openclaw_bridge")

OPENCLAW_GATEWAY_URL = os.getenv("OPENCLAW_GATEWAY_URL", "http://localhost:3000")
ARMORIQ_API_KEY = os.getenv("ARMORIQ_API_KEY", "")


class OpenClawBridge:
    """
    Adapter between SENTINAL's Python backend and the OpenClaw Node.js gateway.
    
    When ArmorIQ releases official Python SDK, replace the HTTP calls
    in this file only — no changes needed elsewhere.
    """

    def __init__(self):
        self.gateway_url = OPENCLAW_GATEWAY_URL
        self.headers = {
            "Authorization": f"Bearer {ARMORIQ_API_KEY}",
            "Content-Type": "application/json",
        }

    async def send_for_approval(
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
        Send a pending action to OpenClaw gateway for admin approval via Telegram.
        Returns True if successfully queued, False on failure.
        """
        payload = {
            "action_id": action_id,
            "ip": ip,
            "threat_type": threat_type,
            "confidence": confidence,
            "severity": severity,
            "reason": reason,
            "recommended_action": recommended_action,
            "callback_approve": f"/webhook/approve?action_id={action_id}",
            "callback_reject": f"/webhook/reject?action_id={action_id}",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self.gateway_url}/sentinal/approval-request",
                    json=payload,
                    headers=self.headers,
                )
                if response.status_code == 200:
                    logger.info(f"[OPENCLAW] Approval request sent for action {action_id}")
                    return True
                else:
                    logger.error(f"[OPENCLAW] Gateway returned {response.status_code}: {response.text}")
                    return False
        except httpx.ConnectError:
            logger.error(
                "[OPENCLAW] Cannot connect to OpenClaw gateway. "
                "Is it running? Start with: cd openclaw && npm start"
            )
            return False
        except Exception as e:
            logger.error(f"[OPENCLAW] Unexpected error: {e}")
            return False

    async def notify_execution(
        self,
        action_id: str,
        ip: str,
        action: str,
        success: bool,
        message: str,
    ) -> None:
        """
        Notify OpenClaw gateway that an action has been executed.
        This updates the Telegram message with the result.
        """
        payload = {
            "action_id": action_id,
            "ip": ip,
            "action": action,
            "success": success,
            "message": message,
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{self.gateway_url}/sentinal/execution-result",
                    json=payload,
                    headers=self.headers,
                )
                logger.info(f"[OPENCLAW] Execution result sent for action {action_id}")
        except Exception as e:
            logger.warning(f"[OPENCLAW] Could not send execution result: {e}")


# Singleton instance
openclaw_bridge = OpenClawBridge()
