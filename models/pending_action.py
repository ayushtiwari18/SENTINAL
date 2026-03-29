from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime
from models.threat_analysis import ThreatAnalysis, RecommendedAction


class ApprovalStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    AUTO_EXECUTED = "AUTO_EXECUTED"
    SKIPPED = "SKIPPED"
    EXPIRED = "EXPIRED"


class PendingAction(BaseModel):
    action_id: str
    alert_id: str
    source_ip: str
    proposed_action: RecommendedAction
    threat_analysis: ThreatAnalysis
    status: ApprovalStatus = ApprovalStatus.PENDING
    approved_by: Optional[str] = None
    armoriq_token: Optional[str] = None
    execution_result: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    def approve(self, admin_id: str, token: Optional[str] = None):
        self.status = ApprovalStatus.APPROVED
        self.approved_by = admin_id
        self.armoriq_token = token
        self.decided_at = datetime.utcnow()

    def reject(self, admin_id: str):
        self.status = ApprovalStatus.REJECTED
        self.approved_by = admin_id
        self.decided_at = datetime.utcnow()

    def mark_executed(self, result: str):
        self.execution_result = result
        self.executed_at = datetime.utcnow()

    class Config:
        use_enum_values = True
