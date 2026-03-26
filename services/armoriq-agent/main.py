"""
ArmorIQ Agent — FastAPI Microservice
Port: 8004

Responsibilities:
  1. Receive attack context from Gateway (POST /respond)
  2. Build structured intents via intent_builder
  3. Evaluate each intent via policy_engine (deterministic, no LLM)
  4. Execute ALLOWED actions via executor
  5. Return BLOCKED actions as actionsQueued for human review
  6. Log every decision to audit_log via audit_logger

ArmorIQ does NOT: detect attacks, parse packets, store AttackEvents,
or render UI. It only enforces intent boundaries.
"""

import logging
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from models import RespondRequest, RespondResponse, AttackContext, ActionResult
from intent_builder import build_intents
from policy_engine import evaluate
from executor import execute
from audit_logger import log_decision

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s"
)
logger = logging.getLogger("armoriq")

app = FastAPI(
    title="ArmorIQ Agent",
    description="Intent-boundary enforcement for SENTINEL. Policy-based runtime control.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "armoriq-agent",
        "version": "1.0.0",
        "enforcement": "ArmorIQ-Policy-v1"
    }


@app.post("/respond", response_model=RespondResponse)
async def respond(body: RespondRequest):
    """
    Main enforcement endpoint.
    Called by Gateway after every confirmed attack.
    """
    logger.info(
        f"[ARMORIQ] respond called — attackId={body.attackId} "
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

    # Step 1: Build intents from attack context
    intents = build_intents(ctx)
    logger.info(f"[ARMORIQ] Built {len(intents)} intents for attackId={body.attackId}")

    actions_executed = []
    actions_queued   = []
    audit_count      = 0

    for intent in intents:
        action = intent.proposed_action.action  # dot-access on typed ProposedAction

        # Step 2: Policy evaluation — deterministic, no LLM
        decision = evaluate(intent)

        logger.info(
            f"[POLICY] {action} → {decision.decision} "
            f"(rule={decision.policy_rule_id})"
        )

        # Step 3: Audit every decision regardless of outcome
        logged = await log_decision(intent, decision)
        if logged:
            audit_count += 1

        if decision.decision == "ALLOW":
            # Step 4: Execute allowed action
            ok = await execute(
                action=action,
                intent_data=intent.proposed_action.model_dump(),
                attack_context=ctx.model_dump(),
            )
            if ok:
                actions_executed.append(action)
                logger.info(f"[ARMORIQ] EXECUTED: {action}")
            else:
                logger.warning(f"[ARMORIQ] Execution of '{action}' failed — see executor log")

        else:  # BLOCK
            # Step 5: Return blocked action for human review
            actions_queued.append(
                ActionResult(
                    action=action,
                    decision="BLOCK",
                    reason=decision.reason,
                    agentReason=intent.proposed_action.reason,
                    blockedReason=decision.reason,
                )
            )
            logger.info(f"[ARMORIQ] BLOCKED (queued): {action} — {decision.reason}")

    logger.info(
        f"[ARMORIQ] Complete — executed={actions_executed} "
        f"queued={[a.action for a in actions_queued]} "
        f"audit_entries={audit_count}"
    )

    return RespondResponse(
        attackId=body.attackId,
        actionsExecuted=actions_executed,
        actionsQueued=actions_queued,
        auditEntries=audit_count,
    )
