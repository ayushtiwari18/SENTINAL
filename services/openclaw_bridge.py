"""
OpenClaw Bridge
---------------
Bridges SENTINAL and the OpenClaw gateway.
Sends approval requests and receives admin decisions.
"""

import httpx
import logging
from typing import Optional
from models.pending_action import PendingAction
from models.threat_analysis import ThreatAnalysis

log = logging.getLogger("sentinal.openclaw_bridge")


class OpenClawBridge:
    """
    Sends structured action proposals to OpenClaw gateway
    and exposes a webhook receiver for admin decisions.
    """

    def __init__(self, gateway_url: str, armoriq_api_key: str):
        self.gateway_url = gateway_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {armoriq_api_key}",
            "Content-Type": "application/json",
        }

    async def send_for_approval(
        self,
        alert: dict,
        analysis: ThreatAnalysis,
        action: PendingAction,
    ) -> bool:
        """
        Forward a pending action to OpenClaw for human review via Telegram.
        Returns True if successfully queued.
        """
        payload = {
            "action_id": action.id,
            "source_ip": alert.get("source_ip"),
            "threat_type": analysis.threat_type,
            "confidence": analysis.confidence,
            "severity": analysis.severity,
            "reasoning": analysis.reasoning,
            "recommended_action": analysis.recommended_action,
            "callback_approve": f"/webhook/approve?action_id={action.id}",
            "callback_reject": f"/webhook/reject?action_id={action.id}",
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.gateway_url}/sentinal/request-approval",
                    json=payload,
                    headers=self.headers,
                )
                resp.raise_for_status()
                log.info(f"[OPENCLAW] Approval request queued: {action.id}")
                return True
        except httpx.HTTPError as e:
            log.error(f"[OPENCLAW] Failed to send approval request: {e}")
            return False

    async def notify_execution(
        self,
        action_id: str,
        result: str,
        ip: str,
    ) -> None:
        """Send post-execution notification back through OpenClaw/Telegram."""
        payload = {
            "action_id": action_id,
            "result": result,
            "ip": ip,
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{self.gateway_url}/sentinal/notify",
                    json=payload,
                    headers=self.headers,
                )
        except httpx.HTTPError as e:
            log.warning(f"[OPENCLAW] Post-execution notify failed: {e}")
