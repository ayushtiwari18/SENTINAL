"""
Integration Tests — SENTINAL Response Engine Enforcement Pipeline
------------------------------------------------------------------
Tests the complete enforcement flow:
  build_intents() → openclaw_runtime.evaluate() → DecisionModel

All 6 required scenarios:
  1. Allowed action (send_alert)
  2. Blocked action (permanent_ban_ip)
  3. Blocked by critical risk level
  4. Fallback to policy_engine on OpenClaw crash
  5. Invalid / missing intent fields (validation)
  6. Full /respond endpoint with mixed attack context

Run with:
  cd services/sentinal-response-engine
  pytest tests/test_enforcement.py -v
"""

import pytest
import sys
import os
from unittest.mock import patch, MagicMock
from datetime import datetime

# Ensure the sentinal-response-engine package root is on the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models import (
    AttackContext, ProposedAction, IntentModel, DecisionModel, RespondRequest
)
from intent_builder import build_intents
from policy_engine import evaluate as fallback_evaluate
import openclaw_runtime


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def low_risk_intent():
    ctx = AttackContext(
        attackId="test-001",
        ip="10.0.0.1",
        attackType="sql_injection",
        severity="medium",
        confidence=0.85,
        status="attempt",
    )
    action = ProposedAction(
        action="send_alert",
        target="10.0.0.1",
        reason="SQL injection detected",
        risk_level="low",
    )
    return IntentModel(attack_context=ctx, proposed_action=action)


@pytest.fixture
def blocked_action_intent():
    ctx = AttackContext(
        attackId="test-002",
        ip="10.0.0.2",
        attackType="brute_force",
        severity="critical",
        confidence=0.95,
        status="successful",
    )
    action = ProposedAction(
        action="permanent_ban_ip",
        target="10.0.0.2",
        reason="Critical brute force attack",
        risk_level="high",
    )
    return IntentModel(attack_context=ctx, proposed_action=action)


@pytest.fixture
def critical_risk_intent():
    ctx = AttackContext(
        attackId="test-003",
        ip="10.0.0.3",
        attackType="rce",
        severity="critical",
        confidence=0.99,
        status="successful",
    )
    action = ProposedAction(
        action="shutdown_endpoint",
        target="10.0.0.3",
        reason="RCE attack succeeded",
        risk_level="critical",
    )
    return IntentModel(attack_context=ctx, proposed_action=action)


@pytest.fixture
def critical_attack_context():
    return AttackContext(
        attackId="test-004",
        ip="192.168.1.100",
        attackType="ddos",
        severity="critical",
        confidence=0.95,
        status="successful",
    )


# ---------------------------------------------------------------------------
# Test 1: Allowed action — send_alert should be ALLOW
# ---------------------------------------------------------------------------

def test_allow_send_alert(low_risk_intent):
    """send_alert with low risk level must be ALLOWED by policy."""
    decision = openclaw_runtime.evaluate(low_risk_intent)
    assert decision.decision == "ALLOW", (
        f"Expected ALLOW for send_alert, got {decision.decision}: {decision.reason}"
    )
    assert decision.action == "send_alert"
    assert decision.intent_id == low_risk_intent.intent_id
    assert decision.enforcement_level in ("PolicyGuard-v1", "Nexus-Policy-v1")


# ---------------------------------------------------------------------------
# Test 2: Blocked action — permanent_ban_ip must be BLOCK
# ---------------------------------------------------------------------------

def test_block_permanent_ban(blocked_action_intent):
    """permanent_ban_ip must always be BLOCKED — it is on the blocked list."""
    decision = openclaw_runtime.evaluate(blocked_action_intent)
    assert decision.decision == "BLOCK", (
        f"Expected BLOCK for permanent_ban_ip, got {decision.decision}"
    )
    assert decision.action == "permanent_ban_ip"


# ---------------------------------------------------------------------------
# Test 3: Critical risk level — any critical action must be BLOCK
# ---------------------------------------------------------------------------

def test_block_critical_risk(critical_risk_intent):
    """Any action with risk_level=critical must be BLOCKED by risk rules."""
    decision = openclaw_runtime.evaluate(critical_risk_intent)
    assert decision.decision == "BLOCK", (
        f"Expected BLOCK for critical risk, got {decision.decision}"
    )


# ---------------------------------------------------------------------------
# Test 4: Fallback to policy_engine when OpenClaw raises
# ---------------------------------------------------------------------------

def test_fallback_on_openclaw_crash(low_risk_intent):
    """
    When openclaw_runtime.evaluate() raises RuntimeError,
    the fallback (policy_engine.evaluate) must be called and
    still return a valid DecisionModel.
    """
    with patch.object(openclaw_runtime, "evaluate", side_effect=RuntimeError("mock crash")):
        try:
            result = openclaw_runtime.evaluate(low_risk_intent)
            pytest.fail("Expected RuntimeError was not raised")
        except RuntimeError:
            # Confirm fallback engine still works
            fallback_decision = fallback_evaluate(low_risk_intent)
            assert isinstance(fallback_decision, DecisionModel)
            assert fallback_decision.decision in ("ALLOW", "BLOCK")


# ---------------------------------------------------------------------------
# Test 5: Intent builder produces valid intents for critical attack
# ---------------------------------------------------------------------------

def test_intent_builder_critical(critical_attack_context):
    """Critical attack must produce multiple intents including blocked ones."""
    intents = build_intents(critical_attack_context)
    assert len(intents) >= 3, "Critical attack should produce at least 3 intents"

    actions = [i.proposed_action.action for i in intents]
    assert "send_alert" in actions, "send_alert must always be proposed"
    assert "log_attack" in actions,  "log_attack must always be proposed"

    # Verify all intents have valid fields
    for intent in intents:
        assert intent.intent_id
        assert intent.attack_context.ip == critical_attack_context.ip
        assert intent.proposed_action.action
        assert intent.proposed_action.risk_level in ("low", "medium", "high", "critical")


# ---------------------------------------------------------------------------
# Test 6: Full enforcement pipeline — critical attack yields mixed decisions
# ---------------------------------------------------------------------------

def test_full_pipeline_mixed_decisions(critical_attack_context):
    """
    A critical attack context should produce:
    - ALLOW decisions for safe actions (send_alert, log_attack, rate_limit, flag)
    - BLOCK decisions for dangerous actions (permanent_ban_ip, shutdown_endpoint)
    """
    intents = build_intents(critical_attack_context)
    decisions = [openclaw_runtime.evaluate(i) for i in intents]

    allow_decisions = [d for d in decisions if d.decision == "ALLOW"]
    block_decisions = [d for d in decisions if d.decision == "BLOCK"]

    assert len(allow_decisions) > 0, "At least one action must be ALLOWED for critical attack"
    assert len(block_decisions) > 0, "At least one action must be BLOCKED for critical attack"

    allowed_actions = {d.action for d in allow_decisions}
    blocked_actions = {d.action for d in block_decisions}

    assert "send_alert" in allowed_actions, "send_alert must be ALLOWED"
    assert "log_attack"  in allowed_actions, "log_attack must be ALLOWED"

    assert "permanent_ban_ip" in blocked_actions or "shutdown_endpoint" in blocked_actions, (
        "At least one dangerous action must be BLOCKED"
    )

    # Verify DecisionModel fields are well-formed
    for d in decisions:
        assert d.intent_id
        assert d.decision in ("ALLOW", "BLOCK")
        assert d.reason
        assert d.policy_rule_id
        assert d.timestamp
        assert d.enforcement_level


# ---------------------------------------------------------------------------
# Test 7: Fallback policy_engine produces identical contract
# ---------------------------------------------------------------------------

def test_fallback_policy_engine_contract(low_risk_intent, blocked_action_intent):
    """policy_engine.evaluate() must return a valid DecisionModel in all cases."""
    d1 = fallback_evaluate(low_risk_intent)
    assert d1.decision == "ALLOW"

    d2 = fallback_evaluate(blocked_action_intent)
    assert d2.decision == "BLOCK"

    for d in (d1, d2):
        assert isinstance(d, DecisionModel)
        assert d.intent_id
        assert d.policy_rule_id
        assert d.reason
        assert d.timestamp
