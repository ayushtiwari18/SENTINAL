from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class AttackContext(BaseModel):
    attackId: str
    ip: str
    attackType: str
    severity: str          # low | medium | high | critical
    confidence: float
    status: str            # attempt | successful | blocked


class RespondRequest(BaseModel):
    attackId: str
    ip: str
    attackType: str
    severity: str
    status: str
    confidence: float


class ProposedAction(BaseModel):
    """Typed schema for ArmorIQ proposed actions — replaces untyped dict."""
    action:     str
    target:     str
    reason:     str
    risk_level: str   # low | medium | high | critical


class IntentModel(BaseModel):
    intent_id:       str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp:       str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    attack_context:  AttackContext
    proposed_action: ProposedAction   # typed — was: dict
    llm_reasoning:   Optional[str] = None  # "llm" | "rule_engine" | reason for fallback


class DecisionModel(BaseModel):
    intent_id: str
    action: str
    decision: str           # ALLOW | BLOCK
    reason: str
    policy_rule_id: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    enforcement_level: str = "ArmorIQ-Policy-v1"


class ActionResult(BaseModel):
    action: str
    decision: str
    reason: str
    agentReason: Optional[str] = None
    blockedReason: Optional[str] = None


class RespondResponse(BaseModel):
    attackId: str
    actionsExecuted: list[str]
    actionsQueued: list[ActionResult]
    auditEntries: int
