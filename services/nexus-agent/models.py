from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class AttackContext(BaseModel):
    attackId: str
    ip: str
    attackType: str
    severity: str
    confidence: float
    status: str


class RespondRequest(BaseModel):
    attackId: str
    ip: str
    attackType: str
    severity: str
    status: str
    confidence: float


class ProposedAction(BaseModel):
    action:     str
    target:     str
    reason:     str
    risk_level: str


class IntentModel(BaseModel):
    intent_id:       str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp:       str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    attack_context:  AttackContext
    proposed_action: ProposedAction
    llm_reasoning:   Optional[str] = None


class DecisionModel(BaseModel):
    intent_id: str
    action: str
    decision: str
    reason: str
    policy_rule_id: str
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    enforcement_level: str = "Nexus-Policy-v1"


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
