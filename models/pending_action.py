"""
pending_action.py
Pydantic model for actions awaiting human approval.

The lifecycle of a pending action:
  PENDING → APPROVED → EXECUTED
  PENDING → REJECTED
  PENDING → TIMEOUT (if admin doesn't respond within timeout window)
  HIGH_CONFIDENCE → AUTO_EXECUTED (bypasses PENDING entirely)
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class ActionStatus(str, Enum):
    PENDING = "PENDING"               # Waiting for human decision
    APPROVED = "APPROVED"             # Admin approved, ready to execute
    REJECTED = "REJECTED"             # Admin rejected
    AUTO_EXECUTED = "AUTO_EXECUTED"   # High confidence auto-execution
    EXECUTED = "EXECUTED"             # Successfully executed
    FAILED = "FAILED"                 # Execution failed
    TIMEOUT = "TIMEOUT"               # Approval window expired
    SKIPPED = "SKIPPED"               # Low confidence, no action taken


class PendingAction(BaseModel):
    action_id: str = Field(..., description="Unique action identifier")
    alert_id: str = Field(..., description="Source alert ID")
    ip: str = Field(..., description="Target IP address")
    action_type: str = Field(..., description="e.g. BAN_IP, RATE_LIMIT")
    threat_type: str = Field(..., description="Classified threat type")
    confidence: float = Field(..., ge=0.0, le=1.0)
    severity: str = Field(...)
    reason: str = Field(...)
    status: ActionStatus = Field(default=ActionStatus.PENDING)
    armoriq_token: Optional[str] = Field(None, description="ArmorClaw intent token")
    approved_by: Optional[str] = Field(None, description="Admin who approved/rejected")
    execution_result: Optional[dict] = Field(None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = Field(None)
    executed_at: Optional[datetime] = Field(None)

    class Config:
        use_enum_values = True
