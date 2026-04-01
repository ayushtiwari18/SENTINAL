"""
LLM Reasoning + Policy Enforcement Tests
-----------------------------------------
Proves the complete agent chain:
  1. LLM proposes an action
  2. Policy (openclaw_runtime) intercepts it
  3. Policy blocks or allows it
  4. Execution occurs only if allowed
  5. Audit log records everything

Required tests:
  - test_agent_reasoning          : LLM/rule engine proposes actions
  - test_policy_interception      : openclaw_runtime intercepts every intent
  - test_blocked_action           : permanent_ban_ip is BLOCKED
  - test_allowed_action_execution : rate_limit_ip is ALLOWED → blocklist.txt written
  - test_llm_reasoning_field      : llm_reasoning field is set on IntentModel
  - test_demo_scenario            : shutdown_endpoint proposed → BLOCKED → audit recorded

Run with:
  cd services/sentinal-response-engine
  pytest tests/test_llm_reasoning.py -v
"""

import pytest
import sys
import os
import asyncio
from pathlib import Path
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import AttackContext, ProposedAction, IntentModel, DecisionModel
from intent_builder import build_intents, _rule_derive_actions, _llm_derive_actions
from executor import execute, BLOCKLIST_PATH
import openclaw_runtime


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def critical_ctx():
    return AttackContext(
        attackId="llm-test-001",
        ip="192.168.99.1",
        attackType="brute_force",
        severity="critical",
        confidence=0.97,
        status="successful",
    )


@pytest.fixture
def medium_ctx():
    return AttackContext(
        attackId="llm-test-002",
        ip="10.0.0.55",
        attackType="sql_injection",
        severity="medium",
        confidence=0.82,
        status="attempt",
    )


# ---------------------------------------------------------------------------
# Test 1 — Agent reasoning: build_intents produces valid ProposedActions
# ---------------------------------------------------------------------------

def test_agent_reasoning(critical_ctx):
    """
    Whether via LLM or rule engine, build_intents must return
    a non-empty list of IntentModels with valid ProposedActions.
    """
    with patch("intent_builder.LLM_ENABLED", False):
        intents = build_intents(critical_ctx)

    assert len(intents) >= 2, "Must propose at least 2 actions"
    for intent in intents:
        assert isinstance(intent, IntentModel)
        assert intent.proposed_action.action in {
            "send_alert", "log_attack", "rate_limit_ip",
            "flag_for_review", "permanent_ban_ip", "shutdown_endpoint", "generate_report"
        }
        assert intent.proposed_action.risk_level in ("low", "medium", "high", "critical")
        assert intent.attack_context.ip == critical_ctx.ip


# ---------------------------------------------------------------------------
# Test 2 — Policy interception: openclaw_runtime evaluates EVERY intent
# ---------------------------------------------------------------------------

def test_policy_interception(critical_ctx):
    """
    Every intent built from an attack must pass through openclaw_runtime.
    Verify that a DecisionModel is returned for each intent with correct fields.
    """
    with patch("intent_builder.LLM_ENABLED", False):
        intents = build_intents(critical_ctx)

    for intent in intents:
        decision = openclaw_runtime.evaluate(intent)
        assert isinstance(decision, DecisionModel)
        assert decision.decision in ("ALLOW", "BLOCK")
        assert decision.intent_id == intent.intent_id
        assert decision.policy_rule_id
        assert decision.reason
        assert decision.enforcement_level


# ---------------------------------------------------------------------------
# Test 3 — Blocked action: permanent_ban_ip must always be BLOCKED
# ---------------------------------------------------------------------------

def test_blocked_action(critical_ctx):
    """
    permanent_ban_ip is on the blocked_actions list in policy.yaml.
    openclaw_runtime must return BLOCK with RULE_001.
    This proves PolicyGuard enforcement is working.
    """
    intent = IntentModel(
        attack_context=critical_ctx,
        proposed_action=ProposedAction(
            action="permanent_ban_ip",
            target=critical_ctx.ip,
            reason="LLM proposed ban due to critical brute force",
            risk_level="high",
        ),
        llm_reasoning="llm",
    )
    decision = openclaw_runtime.evaluate(intent)
    assert decision.decision == "BLOCK", (
        f"permanent_ban_ip must be BLOCKED, got {decision.decision}: {decision.reason}"
    )
    assert decision.policy_rule_id in ("RULE_001", "RULE_003")


# ---------------------------------------------------------------------------
# Test 4 — Allowed action execution: rate_limit_ip writes blocklist.txt
# ---------------------------------------------------------------------------

def test_allowed_action_execution(critical_ctx, tmp_path, monkeypatch):
    """
    rate_limit_ip must be ALLOWED by policy and write a real entry
    to blocklist.txt — proving real-world execution, not simulation.
    """
    # Redirect blocklist to a temp file for test isolation
    test_blocklist = tmp_path / "blocklist.txt"
    import executor as executor_module
    monkeypatch.setattr(executor_module, "BLOCKLIST_PATH", test_blocklist)

    intent = IntentModel(
        attack_context=critical_ctx,
        proposed_action=ProposedAction(
            action="rate_limit_ip",
            target=critical_ctx.ip,
            reason="Brute force detected — rate limit applied",
            risk_level="low",
        ),
        llm_reasoning="llm",
    )

    # 1. Policy must ALLOW it
    decision = openclaw_runtime.evaluate(intent)
    assert decision.decision == "ALLOW", (
        f"rate_limit_ip must be ALLOWED, got {decision.decision}"
    )

    # 2. Executor must write to blocklist.txt
    result = asyncio.get_event_loop().run_until_complete(
        execute(
            action="rate_limit_ip",
            intent_data=intent.proposed_action.model_dump(),
            attack_context=critical_ctx.model_dump(),
        )
    )
    assert result is True, "Executor must return True for rate_limit_ip"

    # 3. Verify the file was actually written
    assert test_blocklist.exists(), "blocklist.txt must be created on disk"
    content = test_blocklist.read_text()
    assert critical_ctx.ip in content, f"IP {critical_ctx.ip} must appear in blocklist.txt"
    assert critical_ctx.attackType in content, "Attack type must appear in blocklist entry"
    assert critical_ctx.attackId in content, "Attack ID must appear in blocklist entry"


# ---------------------------------------------------------------------------
# Test 5 — llm_reasoning field captured on IntentModel
# ---------------------------------------------------------------------------

def test_llm_reasoning_field(medium_ctx):
    """
    IntentModel.llm_reasoning must be set to a non-empty string
    so the audit trail records whether LLM or rule engine proposed the action.
    """
    with patch("intent_builder.LLM_ENABLED", False):
        intents = build_intents(medium_ctx)

    for intent in intents:
        assert intent.llm_reasoning is not None, "llm_reasoning field must be set"
        assert len(intent.llm_reasoning) > 0, "llm_reasoning must not be empty string"


# ---------------------------------------------------------------------------
# Test 6 — LLM fallback: when Gemini call fails, rule engine takes over
# ---------------------------------------------------------------------------

def test_llm_fallback_on_api_failure(critical_ctx):
    """
    If the LLM API call raises an exception, _llm_derive_actions must
    silently fall back to _rule_derive_actions and still return valid actions.
    """
    with patch("intent_builder.GEMINI_KEY", "fake-key-to-trigger-import"):
        with patch("intent_builder.json.loads", side_effect=Exception("mock api failure")):
            actions = _llm_derive_actions(critical_ctx)

    # Fallback must produce valid actions
    assert len(actions) >= 2
    action_names = [a.action for a in actions]
    assert "send_alert" in action_names
    assert "log_attack" in action_names


# ---------------------------------------------------------------------------
# Test 7 — Demo scenario: shutdown_endpoint BLOCKED, audit trail complete
# ---------------------------------------------------------------------------

def test_demo_scenario(critical_ctx):
    """
    THE DEMO SCENARIO:
    Attack detected → LLM proposes shutdown_endpoint
    → Policy BLOCKS it (RULE_002: critical risk)
    → Audit log entry has all required fields

    This is the exact Nexus sponsor track narrative.
    """
    # Simulate what LLM would propose for a critical successful attack
    shutdown_intent = IntentModel(
        attack_context=critical_ctx,
        proposed_action=ProposedAction(
            action="shutdown_endpoint",
            target=critical_ctx.ip,
            reason="LLM: Critical brute_force succeeded — endpoint shutdown warranted",
            risk_level="critical",
        ),
        llm_reasoning="llm",
    )

    # Policy MUST block it
    decision = openclaw_runtime.evaluate(shutdown_intent)
    assert decision.decision == "BLOCK", (
        "DEMO FAILED: shutdown_endpoint must be BLOCKED by PolicyGuard"
    )

    # The decision must have full audit fields
    assert decision.intent_id == shutdown_intent.intent_id
    assert decision.action == "shutdown_endpoint"
    assert decision.policy_rule_id  # RULE_001 or RULE_002
    assert decision.reason
    assert decision.enforcement_level
    assert decision.timestamp

    # llm_reasoning must be recorded on the intent (for audit trail)
    assert shutdown_intent.llm_reasoning == "llm"

    print(f"\n[DEMO] Attack: {critical_ctx.attackType} from {critical_ctx.ip}")
    print(f"[DEMO] LLM proposed: shutdown_endpoint (risk=critical)")
    print(f"[DEMO] PolicyGuard decision: {decision.decision} (rule={decision.policy_rule_id})")
    print(f"[DEMO] Reason: {decision.reason}")
    print(f"[DEMO] Audit: intent_id={decision.intent_id[:8]}... enforcement={decision.enforcement_level}")
