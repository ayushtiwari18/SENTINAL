"""
telegram_notifier.py
Direct Telegram Bot integration for SENTINAL alerts.

Used as:
1. Primary notification channel when OpenClaw gateway is unavailable
2. Fallback for simple informational alerts
3. Auto-execution confirmation messages

For approval workflows (approve/reject), use openclaw_bridge.py instead —
OpenClaw handles the button callbacks and ArmorClaw token verification.
"""

import os
import logging
import httpx

logger = logging.getLogger("sentinal.telegram_notifier")

BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "")
TELEGRAM_API = f"https://api.telegram.org/bot{BOT_TOKEN}"

SEVERITY_EMOJI = {
    "CRITICAL": "🚨",
    "HIGH": "🔴",
    "MEDIUM": "🟡",
    "LOW": "🟢",
    "INFO": "ℹ️",
}


def _send(text: str, parse_mode: str = "Markdown") -> bool:
    if not BOT_TOKEN or not CHAT_ID:
        logger.warning("[TELEGRAM] BOT_TOKEN or CHAT_ID not set — skipping notification")
        return False

    try:
        resp = httpx.post(
            f"{TELEGRAM_API}/sendMessage",
            json={"chat_id": CHAT_ID, "text": text, "parse_mode": parse_mode},
            timeout=10.0,
        )
        if resp.status_code == 200:
            return True
        else:
            logger.error(f"[TELEGRAM] Send failed: {resp.status_code} {resp.text}")
            return False
    except Exception as e:
        logger.error(f"[TELEGRAM] Error sending message: {e}")
        return False


def send_threat_alert(action_id: str, alert: dict, analysis: dict) -> bool:
    """
    Send a threat alert requiring human approval.
    Note: For full approve/reject button flow, use openclaw_bridge.send_approval_request().
    This is the fallback direct notification.
    """
    severity = analysis.get("severity", "MEDIUM")
    emoji = SEVERITY_EMOJI.get(severity, "⚠️")
    confidence_pct = int(analysis.get("confidence", 0) * 100)

    message = (
        f"{emoji} *SENTINAL Alert*\n"
        f"Case ID: `{action_id}`\n\n"
        f"IP: `{alert.get('ip', 'unknown')}`\n"
        f"Threat: `{analysis.get('threat_type', 'unknown')}`\n"
        f"Confidence: `{confidence_pct}%`\n"
        f"Severity: *{severity}*\n\n"
        f"Reason:\n_{analysis.get('reason', 'No details')}_\n\n"
        f"Proposed Action: *{analysis.get('recommended_action', 'REVIEW')}*\n\n"
        f"⚠️ Login to SENTINAL dashboard to approve or reject."
    )
    return _send(message)


def send_auto_execution_notice(action_id: str, alert: dict, analysis: dict, result: dict) -> bool:
    """
    Notify admin that SENTINAL auto-executed an action (no approval required).
    """
    severity = analysis.get("severity", "HIGH")
    emoji = SEVERITY_EMOJI.get(severity, "🔴")
    confidence_pct = int(analysis.get("confidence", 0) * 100)
    success = result.get("success", False)
    status_emoji = "✅" if success else "❌"

    message = (
        f"{emoji} *SENTINAL Auto-Response*\n"
        f"Case ID: `{action_id}`\n\n"
        f"IP: `{alert.get('ip', 'unknown')}`\n"
        f"Threat: `{analysis.get('threat_type', 'unknown')}`\n"
        f"Confidence: `{confidence_pct}%` _(auto-execute threshold met)_\n\n"
        f"Action: *{analysis.get('recommended_action', 'BAN_IP')}*\n"
        f"Result: {status_emoji} `{result.get('message', 'Executed')}`\n\n"
        f"_Full details in audit log._"
    )
    return _send(message)


def send_approval_result(action_id: str, approved: bool, admin_note: str = "") -> bool:
    """
    Notify that a pending action was approved or rejected.
    """
    if approved:
        message = (
            f"✅ *Action Approved*\n"
            f"Case ID: `{action_id}`\n"
            f"Status: Executing now...\n"
            + (f"Note: _{admin_note}_" if admin_note else "")
        )
    else:
        message = (
            f"❌ *Action Rejected*\n"
            f"Case ID: `{action_id}`\n"
            f"Status: Action cancelled, threat monitored.\n"
            + (f"Note: _{admin_note}_" if admin_note else "")
        )
    return _send(message)


def send_system_alert(message: str) -> bool:
    """Send a generic SENTINAL system alert."""
    return _send(f"🛡️ *SENTINAL System*\n{message}")
