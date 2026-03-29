"""
Action Proposal Model
---------------------
Represents a proposed action before it is approved or executed.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from enum import Enum


class ActionStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    AUTO_EXECUTED = "AUTO_EXECUTED"
    SKIPPED = "SKIPPED"
    EXPIRED = "EXPIRED"


class ActionProposal(BaseModel):
    id: str                          # unique action ID (from alert ID)
    alert_id: str
    source_ip: str
    action: str                      # BAN_IP, RATE_LIMIT, etc.
    status: ActionStatus = ActionStatus.PENDING
    confidence: float
    severity: str
    reasoning: str
    created_at: datetime
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    armoriq_token: Optional[str] = None
    execution_result: Optional[str] = None
