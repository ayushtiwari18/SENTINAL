"""
Telegram Notifier
-----------------
Sends formatted SENTINAL alerts to admin via Telegram bot.
Handles both informational notifications and approval prompts.

Note: When OpenClaw is fully configured, this module is used
as a fallback or standalone notifier. OpenClaw itself handles
the inline button callbacks through ArmorClaw verification.
"""

import logging
import httpx
from typing import Optional

log = logging.getLogger("sentinal.telegram_notifier")

SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH": "🟠",
    "MEDIUM": "🟡",
    "LOW": "🟢",
    "INFO": "⚪",
}


class TelegramNotifier:
    def __init__(self, bot_token: str, chat_id: str):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.base_url = f"https://api.telegram.org/bot{bot_token}"

    def _severity_emoji(self, severity: str) -> str:
        return SEVERITY_EMOJI.get(severity.upper(), "⚪")

    async def send_alert(
        self,
        action_id: str,
        source_ip: str,
        threat_type: str,
        confidence: float,
        severity: str,
        reasoning: str,
        recommended_action: str,
        require_approval: bool = True,
    ) -> bool:
        """
        Send a threat alert to the admin Telegram chat.
        If require_approval=True, includes Approve/Reject buttons.
        """
        emoji = self._severity_emoji(severity)
        confidence_pct = int(confidence * 100)

        text = (
            f"🚨 *SENTINAL Alert* `#{action_id}`\n\n"
            f"*IP:* `{source_ip}`\n"
            f"*Threat:* {threat_type.replace('_', ' ').title()}\n"
            f"*Confidence:* {confidence_pct}%\n"
            f"*Severity:* {emoji} {severity}\n\n"
            f"*Reason:*\n{reasoning}\n\n"
            f"*Proposed Action:* `{recommended_action.replace('_', ' ')}`"
        )

        payload: dict = {
            "chat_id": self.chat_id,
            "text": text,
            "parse_mode": "Markdown",
        }

        if require_approval:
            payload["reply_markup"] = {
                "inline_keyboard": [
                    [
                        {"text": "✅ Approve", "callback_data": f"approve:{action_id}"},
                        {"text": "❌ Reject", "callback_data": f"reject:{action_id}"},
                    ],
                    [
                        {"text": "👁 Details", "callback_data": f"details:{action_id}"},
                    ],
                ]
            }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/sendMessage",
                    json=payload,
                )
                resp.raise_for_status()
                log.info(f"[TELEGRAM] Alert sent for action {action_id}")
                return True
        except httpx.HTTPError as e:
            log.error(f"[TELEGRAM] Failed to send alert: {e}")
            return False

    async def send_execution_result(
        self,
        action_id: str,
        source_ip: str,
        action: str,
        status: str,
        approved_by: Optional[str] = None,
    ) -> None:
        """Send post-execution result notification."""
        status_emoji = "✅" if status == "SUCCESS" else "❌"
        approved_line = f"\n*Approved by:* {approved_by}" if approved_by else ""

        text = (
            f"{status_emoji} *Action Executed*\n\n"
            f"*Case:* `#{action_id}`\n"
            f"*IP:* `{source_ip}`\n"
            f"*Action:* {action.replace('_', ' ')}"
            f"{approved_line}\n"
            f"*Result:* {status}"
        )

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": self.chat_id,
                        "text": text,
                        "parse_mode": "Markdown",
                    },
                )
        except httpx.HTTPError as e:
            log.warning(f"[TELEGRAM] Result notification failed: {e}")
