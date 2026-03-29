"""
ArmorIQ Intent Builder
----------------------
Translates raw attack context into a list of proposed IntentModels.
One attack → multiple proposed intents (one per candidate action).

Phase 3 upgrade: _derive_actions() is now replaced by _llm_derive_actions()
which calls Gemini Flash (google-generativeai) to reason about the attack
context and propose actions as structured JSON.

Fallback chain:
  1. LLM proposes actions via Gemini Flash     (LLM_ENABLED=true, API key set)
  2. _rule_derive_actions()                    (fallback if LLM fails or disabled)

The output of BOTH paths feeds into openclaw_runtime.evaluate() unchanged —
the policy enforcement layer is never bypassed.
"""

import os
import json
import logging
from models import IntentModel, AttackContext, ProposedAction

logger = logging.getLogger("armoriq.intent_builder")

LLM_ENABLED  = os.getenv("LLM_ENABLED", "true").lower() not in ("false", "0", "no")
GEMINI_KEY   = os.getenv("GEMINI_API_KEY", "")

# Valid action names — LLM output is validated against this set
_VALID_ACTIONS = {
    "send_alert",
    "log_attack",
    "rate_limit_ip",
    "flag_for_review",
    "permanent_ban_ip",
    "shutdown_endpoint",
    "generate_report",
}

_VALID_RISK_LEVELS = {"low", "medium", "high", "critical"}

_SYSTEM_PROMPT = """You are ArmorIQ, an autonomous cybersecurity response agent.
Given an attack context, propose a JSON array of security actions to take.

Each action object MUST have exactly these fields:
  - action     (string) — one of: send_alert, log_attack, rate_limit_ip,
                flag_for_review, permanent_ban_ip, shutdown_endpoint, generate_report
  - target     (string) — IP address or attack ID being acted on
  - reason     (string) — concise explanation of why this action is warranted
  - risk_level (string) — one of: low, medium, high, critical

Rules:
- Always include send_alert and log_attack for any confirmed attack
- Propose rate_limit_ip for medium/high/critical severity
- Propose permanent_ban_ip only for critical severity with confidence >= 0.9
- Propose shutdown_endpoint only for critical attacks that succeeded
- Return ONLY a valid JSON array. No markdown fences. No explanation text."""


def _llm_derive_actions(ctx: AttackContext) -> list[ProposedAction]:
    """
    Call Gemini Flash to reason about the attack context and propose actions.
    Returns a list of validated ProposedAction objects.
    Falls back to _rule_derive_actions() on any failure.
    """
    if not GEMINI_KEY:
        logger.warning("[LLM] GEMINI_API_KEY not set — falling back to rule engine")
        return _rule_derive_actions(ctx)

    try:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_KEY)
        model = genai.GenerativeModel("gemini-1.5-flash")

        user_prompt = f"""Attack context:
- IP: {ctx.ip}
- Attack type: {ctx.attackType}
- Severity: {ctx.severity}
- Confidence: {ctx.confidence:.2f}
- Status: {ctx.status}
- Attack ID: {ctx.attackId}

Propose the appropriate security response actions as a JSON array."""

        response = model.generate_content(_SYSTEM_PROMPT + "\n\n" + user_prompt)
        raw = response.text.strip()

        # Strip markdown code fences if model wraps output despite instructions
        if raw.startswith("```"):
            lines = raw.split("\n")
            raw = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

        items = json.loads(raw)
        if not isinstance(items, list):
            raise ValueError("LLM returned non-list JSON")

        actions = []
        for item in items:
            # Validate each item has required fields and valid values
            if not isinstance(item, dict):
                continue
            action_name = item.get("action", "")
            risk        = item.get("risk_level", "low")
            if action_name not in _VALID_ACTIONS:
                logger.warning(f"[LLM] Ignoring unknown action '{action_name}'")
                continue
            if risk not in _VALID_RISK_LEVELS:
                risk = "low"
            actions.append(ProposedAction(
                action=action_name,
                target=item.get("target", ctx.ip),
                reason=item.get("reason", f"LLM-proposed action for {ctx.attackType}"),
                risk_level=risk,
            ))

        if not actions:
            raise ValueError("LLM returned empty or fully-invalid action list")

        logger.info(
            f"[LLM] Gemini Flash proposed {len(actions)} actions for "
            f"attackId={ctx.attackId} type={ctx.attackType} severity={ctx.severity}"
        )
        return actions

    except Exception as e:
        logger.warning(f"[LLM] Gemini call failed ({type(e).__name__}: {e}) — falling back to rule engine")
        return _rule_derive_actions(ctx)


def _rule_derive_actions(ctx: AttackContext) -> list[ProposedAction]:
    """
    Deterministic fallback — original if/else logic preserved exactly.
    Used when LLM is disabled or fails.
    """
    actions = []

    # Always proposed for any detected attack
    actions.append(ProposedAction(
        action="send_alert",
        target=ctx.ip,
        reason=f"{ctx.attackType.upper()} detected from {ctx.ip} with {ctx.severity} severity",
        risk_level="low",
    ))

    actions.append(ProposedAction(
        action="log_attack",
        target=ctx.attackId,
        reason="Record attack for forensic audit trail",
        risk_level="low",
    ))

    # Rate limit on medium and above
    if ctx.severity in ("medium", "high", "critical"):
        actions.append(ProposedAction(
            action="rate_limit_ip",
            target=ctx.ip,
            reason=f"Repeated {ctx.attackType} activity from this IP",
            risk_level="low",
        ))

    # Flag for review on high/critical
    if ctx.severity in ("high", "critical"):
        actions.append(ProposedAction(
            action="flag_for_review",
            target=ctx.ip,
            reason="High severity attack requires analyst review",
            risk_level="low",
        ))

    # Permanent ban proposed (will be BLOCKED by policy) on critical
    if ctx.severity == "critical" and ctx.confidence >= 0.9:
        actions.append(ProposedAction(
            action="permanent_ban_ip",
            target=ctx.ip,
            reason=f"Critical confidence {ctx.attackType} attack — ban proposed",
            risk_level="high",
        ))

    # Shutdown endpoint proposed (will be BLOCKED) on critical successful attack
    if ctx.severity == "critical" and ctx.status == "successful":
        actions.append(ProposedAction(
            action="shutdown_endpoint",
            target=ctx.ip,
            reason="Critical attack succeeded — endpoint shutdown proposed",
            risk_level="critical",
        ))

    return actions


def build_intents(ctx: AttackContext) -> list[IntentModel]:
    """
    Build a list of IntentModels from an attack context.
    Uses LLM reasoning when enabled, rule engine as fallback.
    Either way, all proposed actions pass through openclaw_runtime.evaluate().
    """
    if LLM_ENABLED:
        proposed_actions = _llm_derive_actions(ctx)
        reasoning_source = "llm" if GEMINI_KEY else "rule_engine (no api key)"
    else:
        proposed_actions = _rule_derive_actions(ctx)
        reasoning_source = "rule_engine (llm_disabled)"

    logger.info(
        f"[INTENT] {len(proposed_actions)} actions proposed via {reasoning_source} "
        f"for attackId={ctx.attackId}"
    )

    intents = []
    for proposed in proposed_actions:
        intents.append(
            IntentModel(
                attack_context=ctx,
                proposed_action=proposed,
                llm_reasoning=reasoning_source,
            )
        )
    return intents
