"""
PendingAction — Tracks actions awaiting human approval

Status lifecycle:
  PENDING → APPROVED → EXECUTED
  PENDING → REJECTED
  PENDING → EXPIRED (if admin doesn't respond in time)
  AUTO_EXECUTED (bypasses PENDING for high-confidence auto-actions)
"""

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class ActionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXECUTED = "EXECUTED"
    EXECUTION_FAILED = "EXECUTION_FAILED"
    AUTO_EXECUTED = "AUTO_EXECUTED"
    EXPIRED = "EXPIRED"


class PendingAction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    alert_id: str
    ip: str
    threat_type: str
    confidence: float
    severity: str
    reason: str
    recommended_action: str
    status: ActionStatus = ActionStatus.PENDING
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    decided_by: Optional[str] = None
    execution_result: Optional[str] = None
    armoriq_token: Optional[str] = None  # ArmorClaw intent token for audit

    def approve(self, decided_by: str = "admin", token: Optional[str] = None) -> None:
        self.status = ActionStatus.APPROVED
        self.decided_at = datetime.utcnow()
        self.decided_by = decided_by
        self.armoriq_token = token

    def reject(self, decided_by: str = "admin") -> None:
        self.status = ActionStatus.REJECTED
        self.decided_at = datetime.utcnow()
        self.decided_by = decided_by

    def mark_executed(self, result: str) -> None:
        self.status = ActionStatus.EXECUTED
        self.executed_at = datetime.utcnow()
        self.execution_result = result

    def mark_failed(self, result: str) -> None:
        self.status = ActionStatus.EXECUTION_FAILED
        self.executed_at = datetime.utcnow()
        self.execution_result = result

    class Config:
        use_enum_values = True
