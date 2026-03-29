"""
Telegram Notifier — SENTINAL Alert Delivery

Sends formatted threat alerts to the admin's Telegram chat.
Used as a fallback when OpenClaw gateway is unavailable,
or for direct notification when OpenClaw is not configured.

Requires:
  TELEGRAM_BOT_TOKEN — from @BotFather
  TELEGRAM_CHAT_ID   — your admin chat ID
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("sentinal.telegram_notifier")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
SENTINAL_BASE_URL = os.getenv("SENTINAL_BASE_URL", "http://localhost:8004")

SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH": "🟠",
    "MEDIUM": "🟡",
    "LOW": "🟢",
    "INFO": "⚪",
}


class TelegramNotifier:
    """
    Formats and sends SENTINAL alerts to a Telegram chat.
    Supports inline approval buttons for pending actions.
    """

    def __init__(self):
        self.token = TELEGRAM_BOT_TOKEN
        self.chat_id = TELEGRAM_CHAT_ID
        self.api_base = f"https://api.telegram.org/bot{self.token}"

    def _is_configured(self) -> bool:
        return bool(self.token and self.chat_id)

    async def send_pending_approval(
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
        Send an alert with Approve / Reject inline buttons.
        Admin taps a button → webhook fires → SENTINAL acts.
        """
        if not self._is_configured():
            logger.warning("[TELEGRAM] Not configured — skipping notification")
            return False

        severity_icon = SEVERITY_EMOJI.get(severity, "⚪")
        confidence_pct = int(confidence * 100)

        text = (
            f"🚨 *SENTINAL Alert*\n"
            f"`Case: {action_id}`\n\n"
            f"*IP:* `{ip}`\n"
            f"*Threat:* `{threat_type}`\n"
            f"*Confidence:* `{confidence_pct}%`\n"
            f"*Severity:* {severity_icon} `{severity}`\n\n"
            f"*Reason:*\n{reason}\n\n"
            f"*Proposed Action:* `{recommended_action}`\n\n"
            f"_Decision required — please approve or reject._"
        )

        approve_url = f"{SENTINAL_BASE_URL}/actions/{action_id}/approve"
        reject_url = f"{SENTINAL_BASE_URL}/actions/{action_id}/reject"

        keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Approve", "url": approve_url},
                    {"text": "❌ Reject", "url": reject_url},
                ]
            ]
        }

        return await self._send_message(text, reply_markup=keyboard)

    async def send_auto_executed(
        self,
        ip: str,
        threat_type: str,
        confidence: float,
        action_taken: str,
    ) -> bool:
        """
        Inform admin that an action was auto-executed (high confidence).
        No approval needed — notification only.
        """
        if not self._is_configured():
            return False

        confidence_pct = int(confidence * 100)
        text = (
            f"✅ *SENTINAL Auto-Executed*\n\n"
            f"*IP:* `{ip}`\n"
            f"*Threat:* `{threat_type}`\n"
            f"*Confidence:* `{confidence_pct}%` _(above auto-execute threshold)_\n"
            f"*Action Taken:* `{action_taken}`\n\n"
            f"_No approval was required. Full record in audit log._"
        )
        return await self._send_message(text)

    async def send_action_result(
        self,
        action_id: str,
        ip: str,
        action: str,
        status: str,
        decided_by: Optional[str] = None,
    ) -> bool:
        """
        Notify admin of the final result after approval/rejection.
        """
        if not self._is_configured():
            return False

        icon = "✅" if status == "EXECUTED" else "❌"
        decider = f"by `{decided_by}`" if decided_by else ""
        text = (
            f"{icon} *Action {status}* {decider}\n\n"
            f"*Case:* `{action_id}`\n"
            f"*IP:* `{ip}`\n"
            f"*Action:* `{action}`"
        )
        return await self._send_message(text)

    async def _send_message(
        self,
        text: str,
        reply_markup: Optional[dict] = None,
    ) -> bool:
        """
        Core method — sends a message to the configured Telegram chat.
        """
        payload: dict = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }
        if reply_markup:
            import json
            payload["reply_markup"] = json.dumps(reply_markup)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.api_base}/sendMessage",
                    json=payload,
                    timeout=10.0,
                )
                if response.status_code == 200:
                    logger.info("[TELEGRAM] Message sent successfully")
                    return True
                else:
                    logger.error(f"[TELEGRAM] Send failed: {response.status_code} {response.text}")
                    return False
        except httpx.RequestError as e:
            logger.error(f"[TELEGRAM] Request error: {e}")
            return False


# Singleton instance
telegram_notifier = TelegramNotifier()
