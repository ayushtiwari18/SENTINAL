"""
Telegram Notifier — SENTINAL Alert Delivery

Responsibilities:
- Send formatted threat alerts to admin via Telegram
- Send post-execution notifications
- Send low-priority informational messages

Setup:
1. Create a bot via @BotFather on Telegram
2. Get your bot token
3. Get your chat ID (send a message to @userinfobot)
4. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to .env
"""

import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger("sentinal.telegram")

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API_BASE = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"

SEVERITY_EMOJI = {
    "CRITICAL": "🔴",
    "HIGH": "🟠",
    "MEDIUM": "🟡",
    "LOW": "🟢",
}


class TelegramNotifier:

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
        Send a threat alert with Approve/Reject inline buttons.
        """
        severity_icon = SEVERITY_EMOJI.get(severity, "⚪")
        confidence_pct = int(confidence * 100)

        text = (
            f"🚨 *SENTINAL Threat Alert*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"*Case ID:* `{action_id[:12]}...`\n"
            f"*IP:* `{ip}`\n"
            f"*Threat:* {threat_type.replace('_', ' ').title()}\n"
            f"*Confidence:* {confidence_pct}%\n"
            f"*Severity:* {severity_icon} {severity}\n"
            f"*Reason:* {reason}\n\n"
            f"*Proposed Action:* `{recommended_action.replace('_', ' ')}`\n\n"
            f"_Approval required — action will not execute until authorized._"
        )

        inline_keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Approve", "callback_data": f"approve:{action_id}"},
                    {"text": "❌ Reject", "callback_data": f"reject:{action_id}"},
                ]
            ]
        }

        return await self._send_message(text, reply_markup=inline_keyboard)

    async def send_auto_execution_notice(
        self,
        ip: str,
        threat_type: str,
        confidence: float,
        action: str,
    ) -> None:
        """
        Notify that SENTINAL auto-executed a high-confidence action.
        """
        confidence_pct = int(confidence * 100)
        text = (
            f"⚡ *SENTINAL Auto-Response*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"*IP:* `{ip}`\n"
            f"*Threat:* {threat_type.replace('_', ' ').title()}\n"
            f"*Confidence:* {confidence_pct}% _(above auto-execute threshold)_\n"
            f"*Action Taken:* `{action.replace('_', ' ')}`\n\n"
            f"_No approval was required. Full audit log available on dashboard._"
        )
        await self._send_message(text)

    async def send_execution_result(
        self,
        action_id: str,
        ip: str,
        action: str,
        success: bool,
        approved_by: str = "admin",
    ) -> None:
        """
        Send result after an approved action is executed.
        """
        status = "✅ Executed successfully" if success else "❌ Execution failed"
        text = (
            f"*SENTINAL Action Result*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"*Case:* `{action_id[:12]}...`\n"
            f"*IP:* `{ip}`\n"
            f"*Action:* `{action.replace('_', ' ')}`\n"
            f"*Approved by:* {approved_by}\n"
            f"*Status:* {status}"
        )
        await self._send_message(text)

    async def send_rejection_notice(
        self,
        action_id: str,
        ip: str,
        rejected_by: str = "admin",
    ) -> None:
        """
        Notify that an action was rejected by admin.
        """
        text = (
            f"🚫 *SENTINAL Action Rejected*\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"*Case:* `{action_id[:12]}...`\n"
            f"*IP:* `{ip}`\n"
            f"*Rejected by:* {rejected_by}\n"
            f"_No action was taken. Event logged to audit trail._"
        )
        await self._send_message(text)

    async def _send_message(
        self,
        text: str,
        reply_markup: Optional[dict] = None,
    ) -> bool:
        """
        Internal: POST a message to the Telegram Bot API.
        """
        if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
            logger.warning("[TELEGRAM] Bot token or chat ID not configured — skipping notification")
            return False

        payload = {
            "chat_id": TELEGRAM_CHAT_ID,
            "text": text,
            "parse_mode": "Markdown",
        }
        if reply_markup:
            payload["reply_markup"] = reply_markup

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{TELEGRAM_API_BASE}/sendMessage",
                    json=payload,
                )
                if response.status_code == 200:
                    logger.info("[TELEGRAM] Message sent successfully")
                    return True
                else:
                    logger.error(f"[TELEGRAM] API error {response.status_code}: {response.text}")
                    return False
        except Exception as e:
            logger.error(f"[TELEGRAM] Failed to send message: {e}")
            return False


# Singleton instance
telegram_notifier = TelegramNotifier()
