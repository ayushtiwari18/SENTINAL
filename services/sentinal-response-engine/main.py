"""
SENTINAL Response Engine — FastAPI Microservice

dotenv is loaded from the ROOT .env file at startup.
Path resolution: this file is at services/sentinal-response-engine/main.py
Root .env is 2 directories up: Path(__file__).parents[2] / ".env"

Directory structure:
  SENTINAL/                        ← root (parents[2] from main.py)
    services/
      sentinal-response-engine/
        main.py                    ← this file
"""
from pathlib import Path
from dotenv import load_dotenv
import os
import time

# Load root .env FIRST — before any other imports
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

# Capture start time immediately after env load
_start_time = time.time()

import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from models import RespondRequest, RespondResponse, AttackContext, ActionResult
from intent_builder import build_intents
import openclaw_runtime
from policy_engine import evaluate as _fallback_evaluate
from executor import execute
from audit_logger import log_decision

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s"
)
logger = logging.getLogger("sentinal.response_engine")

logger.info(f"[SENTINAL] Loading env from: {_env_path}")
logger.info(f"[SENTINAL] .env found: {_env_path.exists()}")
logger.info(f"[SENTINAL] GATEWAY_URL:  {os.getenv('GATEWAY_URL', 'http://localhost:3000')}")
logger.info(f"[SENTINAL] ARMORIQ_PORT: {os.getenv('ARMORIQ_PORT', '8004')}")

app = FastAPI(
    title="SENTINAL Response Engine",
    description="Intent-boundary enforcement for SENTINAL. Policy-based runtime with ArmorClaw enforcement layer.",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _evaluate_with_fallback(intent):
    """
    Evaluate intent via the primary policy runtime.
    Falls back to policy_engine.evaluate() if the runtime is unavailable.
    NEVER raises — always returns a DecisionModel.
    """
    try:
        return openclaw_runtime.evaluate(intent)
    except Exception as exc:
        logger.error(f"[POLICY] Runtime error: {exc} — falling back to policy_engine")
        return _fallback_evaluate(intent)


@app.get("/health")
def health():
    """Standard SENTINAL health probe. Used by Gateway serviceHealthService."""
    policy_ok = openclaw_runtime.is_loaded()
    return {
        "status":      "ok",
        "service":     "sentinal-response-engine",
        "version":     "2.0.0",
        "uptime":      int(time.time() - _start_time),   # seconds since process start
        "port":        int(os.getenv("ARMORIQ_PORT", "8004")),
        "environment": os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
        "timestamp":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "enforcement": "SENTINAL-Policy-v1" if policy_ok else "SENTINAL-Policy-v1 (fallback)",
        "policy_loaded": policy_ok,
        "gateway_url": os.getenv("GATEWAY_URL", "http://localhost:3000")
    }


@app.post("/respond", response_model=RespondResponse)
async def respond(body: RespondRequest):
    """
    Main enforcement endpoint.
    Called by Gateway after every confirmed attack.
    """
    logger.info(
        f"[SENTINAL] respond called — attackId={body.attackId} "
        f"ip={body.ip} type={body.attackType} severity={body.severity}"
    )

    ctx = AttackContext(
        attackId=body.attackId,
        ip=body.ip,
        attackType=body.attackType,
        severity=body.severity,
        confidence=body.confidence,
        status=body.status,
    )

    intents = build_intents(ctx)
    logger.info(f"[SENTINAL] Built {len(intents)} intents for attackId={body.attackId}")

    actions_executed = []
    actions_queued   = []
    audit_count      = 0

    for intent in intents:
        action   = intent.proposed_action.action
        decision = _evaluate_with_fallback(intent)

        logger.info(
            f"[POLICY] {action} → {decision.decision} "
            f"(rule={decision.policy_rule_id} enforcement={decision.enforcement_level})"
        )

        logged = await log_decision(intent, decision)
        if logged:
            audit_count += 1

        if decision.decision == "ALLOW":
            ok = await execute(
                action=action,
                intent_data=intent.proposed_action.model_dump(),
                attack_context=ctx.model_dump(),
            )
            if ok:
                actions_executed.append(action)
                logger.info(f"[SENTINAL] EXECUTED: {action}")
            else:
                logger.warning(f"[SENTINAL] Execution of '{action}' failed — see executor log")
        else:
            actions_queued.append(
                ActionResult(
                    action=action,
                    decision="BLOCK",
                    reason=decision.reason,
                    agentReason=intent.proposed_action.reason,
                    blockedReason=decision.reason,
                )
            )
            logger.info(f"[SENTINAL] BLOCKED (queued): {action} — {decision.reason}")

    logger.info(
        f"[SENTINAL] Complete — executed={actions_executed} "
        f"queued={[a.action for a in actions_queued]} "
        f"audit_entries={audit_count}"
    )

    return RespondResponse(
        attackId=body.attackId,
        actionsExecuted=actions_executed,
        actionsQueued=actions_queued,
        auditEntries=audit_count,
    )
