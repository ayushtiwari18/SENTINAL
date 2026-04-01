"""
SENTINAL Detection Engine — OpenClaw Webhook Router
----------------------------------------------------
Exposes POST /webhook/alert — called internally by main.py after a confirmed
threat detection. Fires a structured natural-language alert to the OpenClaw
inject endpoint so the LLM (Gemini 2.5 Flash) can reason about the threat
and route it through PolicyGuard enforcement.

Design constraints:
  - NEVER blocks the detection pipeline (called via asyncio background task)
  - Fails silently and logs — detection continues on any network error
  - Retry logic: 2 attempts with a 1-second backoff
  - Timeout: 4 seconds per attempt (8 seconds total max)
  - No circular imports: imports only stdlib + httpx + fastapi

This file does NOT modify any existing detection logic.
It only adds the outbound alerting capability that was previously missing.
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger("detection-engine.webhook")

# ---------------------------------------------------------------------------
# Configuration — resolved from environment, safe defaults for local dev
# ---------------------------------------------------------------------------
OPENCLAW_INJECT_URL = os.getenv(
    "OPENCLAW_INJECT_URL",
    "http://localhost:9000/inject"   # default OpenClaw inject port
)
WEBHOOK_TIMEOUT_SEC  = float(os.getenv("WEBHOOK_TIMEOUT_SEC", "4.0"))
WEBHOOK_MAX_RETRIES  = int(os.getenv("WEBHOOK_MAX_RETRIES", "2"))
WEBHOOK_ENABLED      = os.getenv("WEBHOOK_ENABLED", "true").lower() not in ("false", "0", "no")

router = APIRouter()


# ---------------------------------------------------------------------------
# Internal schema — mirrors the fields emitted by /analyze
# ---------------------------------------------------------------------------
class ThreatAlert(BaseModel):
    logId:           str | None = None
    ip:              str | None = None
    threat_type:     str
    rule_id:         str
    confidence:      float
    severity:        str
    status:          str
    adversarial_decoded: bool = False
    timestamp:       str | None = None


# ---------------------------------------------------------------------------
# Natural-language alert builder
# The LLM reads this text — it must be unambiguous and complete.
# ---------------------------------------------------------------------------
def _build_alert_text(alert: ThreatAlert) -> str:
    ts = alert.timestamp or datetime.now(timezone.utc).isoformat()
    decoded_note = " (adversarial encoding detected and decoded)" if alert.adversarial_decoded else ""
    return (
        f"[SENTINAL SECURITY ALERT]\n"
        f"Timestamp : {ts}\n"
        f"Log ID    : {alert.logId or 'N/A'}\n"
        f"Source IP : {alert.ip or 'unknown'}\n"
        f"Threat    : {alert.threat_type}{decoded_note}\n"
        f"Rule      : {alert.rule_id}\n"
        f"Severity  : {alert.severity.upper()}\n"
        f"Confidence: {alert.confidence:.0%}\n"
        f"Status    : {alert.status}\n"
        f"\n"
        f"The SENTINAL detection engine has confirmed a {alert.threat_type} attack "
        f"from IP {alert.ip or 'unknown'} with {alert.severity} severity and "
        f"{alert.confidence:.0%} confidence. "
        f"Please evaluate this threat using the sentinal-security skill and "
        f"propose appropriate PolicyGuard-authorized response actions."
    )


# ---------------------------------------------------------------------------
# Core delivery function — async, non-blocking, retrying
# ---------------------------------------------------------------------------
async def _deliver_to_openclaw(alert: ThreatAlert) -> None:
    """
    Attempts to POST the alert text to OpenClaw's inject endpoint.
    Retries up to WEBHOOK_MAX_RETRIES times with 1-second backoff.
    Never raises — detection pipeline is never disrupted.
    """
    if not WEBHOOK_ENABLED:
        logger.info("[WEBHOOK] WEBHOOK_ENABLED=false — skipping OpenClaw delivery")
        return

    alert_text = _build_alert_text(alert)
    payload    = {"message": alert_text, "source": "sentinal-detection-engine"}

    for attempt in range(1, WEBHOOK_MAX_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=WEBHOOK_TIMEOUT_SEC) as client:
                resp = await client.post(OPENCLAW_INJECT_URL, json=payload)
                if resp.status_code in (200, 201, 202):
                    logger.info(
                        f"[WEBHOOK] Alert delivered to OpenClaw (attempt {attempt}) "
                        f"logId={alert.logId} threat={alert.threat_type} "
                        f"severity={alert.severity} → HTTP {resp.status_code}"
                    )
                    return
                else:
                    logger.warning(
                        f"[WEBHOOK] OpenClaw returned HTTP {resp.status_code} "
                        f"(attempt {attempt}/{WEBHOOK_MAX_RETRIES}) "
                        f"logId={alert.logId}"
                    )
        except httpx.TimeoutException:
            logger.warning(
                f"[WEBHOOK] Timeout after {WEBHOOK_TIMEOUT_SEC}s "
                f"(attempt {attempt}/{WEBHOOK_MAX_RETRIES}) "
                f"logId={alert.logId} url={OPENCLAW_INJECT_URL}"
            )
        except httpx.ConnectError:
            logger.warning(
                f"[WEBHOOK] OpenClaw unreachable at {OPENCLAW_INJECT_URL} "
                f"(attempt {attempt}/{WEBHOOK_MAX_RETRIES}) — "
                f"detection continues normally"
            )
        except Exception as exc:
            logger.error(
                f"[WEBHOOK] Unexpected error on attempt {attempt}: "
                f"{type(exc).__name__}: {exc}"
            )

        if attempt < WEBHOOK_MAX_RETRIES:
            await asyncio.sleep(1.0)

    logger.error(
        f"[WEBHOOK] All {WEBHOOK_MAX_RETRIES} delivery attempts failed for "
        f"logId={alert.logId} threat={alert.threat_type}. "
        f"Detection result was still returned to caller. "
        f"OpenClaw response path is degraded."
    )


# ---------------------------------------------------------------------------
# FastAPI endpoint — POST /webhook/alert
# This endpoint is called by main.py's /analyze handler via background task.
# It is also callable directly for testing.
# ---------------------------------------------------------------------------
@router.post("/webhook/alert", status_code=202)
async def webhook_alert(alert: ThreatAlert):
    """
    Receives a confirmed threat detection and fires it to OpenClaw.
    Returns 202 Accepted immediately — delivery is async.
    The response to the original /analyze caller is never delayed.
    """
    logger.info(
        f"[WEBHOOK] Received confirmed threat: "
        f"type={alert.threat_type} severity={alert.severity} "
        f"ip={alert.ip} logId={alert.logId}"
    )
    # Fire-and-forget: OpenClaw delivery does not block response
    asyncio.create_task(_deliver_to_openclaw(alert))
    return {
        "accepted":    True,
        "logId":       alert.logId,
        "threat_type": alert.threat_type,
        "severity":    alert.severity,
        "message":     "Alert queued for OpenClaw delivery"
    }


# ---------------------------------------------------------------------------
# Public helper — called directly from main.py analyze() handler
# This fires without going through HTTP so there is no loopback overhead.
# ---------------------------------------------------------------------------
def fire_alert_background(app_state, alert_data: dict) -> None:
    """
    Convenience function called from /analyze when threat_detected=True.
    Creates an asyncio background task — never blocks the caller.

    Usage in main.py:
        from app.webhook_router import fire_alert_background, ThreatAlert
        # inside analyze(), after threat confirmed:
        fire_alert_background(request, ThreatAlert(**alert_fields))
    """
    alert = ThreatAlert(**alert_data)
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(_deliver_to_openclaw(alert))
        else:
            logger.warning("[WEBHOOK] No running event loop — skipping async delivery")
    except Exception as exc:
        logger.error(f"[WEBHOOK] fire_alert_background failed: {exc} — detection unaffected")
