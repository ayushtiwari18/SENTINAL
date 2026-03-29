"""
threat_analysis.py
Pydantic models for structured threat analysis output.

All threat data flowing through SENTINAL uses these models.
This ensures type safety and consistent structure across all components.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum


class ThreatType(str, Enum):
    SSH_BRUTE_FORCE = "SSH_BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    DDOS = "DDOS"
    SQLI_ATTEMPT = "SQLI_ATTEMPT"
    XSS_ATTEMPT = "XSS_ATTEMPT"
    MALWARE_C2 = "MALWARE_C2"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    UNKNOWN = "UNKNOWN"


class SeverityLevel(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class RecommendedAction(str, Enum):
    BAN_IP = "BAN_IP"
    RATE_LIMIT = "RATE_LIMIT"
    MONITOR = "MONITOR"
    QUARANTINE = "QUARANTINE"
    ALERT_ONLY = "ALERT_ONLY"


class ResponseMode(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"       # High confidence — execute immediately
    REVIEW_REQUIRED = "REVIEW_REQUIRED"  # Medium confidence — need human approval
    MONITOR_ONLY = "MONITOR_ONLY"        # Low confidence — log and watch


class ThreatAnalysis(BaseModel):
    alert_id: str = Field(..., description="ID of the originating alert")
    threat_type: ThreatType = Field(..., description="Classified threat type")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    severity: SeverityLevel = Field(..., description="Severity level")
    recommended_action: RecommendedAction = Field(..., description="What SENTINAL should do")
    reason: str = Field(..., description="Human-readable explanation")
    response_mode: ResponseMode = Field(..., description="Auto-execute, review, or monitor")
    source_ip: Optional[str] = Field(None, description="Source IP address")
    additional_context: Optional[dict] = Field(None, description="Extra metadata")

    class Config:
        use_enum_values = True
