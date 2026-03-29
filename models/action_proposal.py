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


class ActionProposal(BaseModel):
    action_id: str
    alert_id: str
    source_ip: str
    action: RecommendedAction
    analysis: ThreatAnalysis
    status: ApprovalStatus = ApprovalStatus.PENDING
    approved_by: Optional[str] = None
    rejected_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    execution_result: Optional[str] = None
    armoriq_token: Optional[str] = None
