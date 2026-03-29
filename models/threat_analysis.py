"""
ThreatAnalysis — Structured output from intent_builder.py

This model is the contract between threat detection and policy enforcement.
All fields are required. intent_builder.py must produce this exact shape.
"""

from enum import Enum
from pydantic import BaseModel, Field


class ThreatType(str, Enum):
    SSH_BRUTE_FORCE = "SSH_BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    DDOS = "DDOS"
    SQLI_ATTEMPT = "SQLI_ATTEMPT"
    XSS_ATTEMPT = "XSS_ATTEMPT"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    RANSOMWARE_INDICATOR = "RANSOMWARE_INDICATOR"
    UNKNOWN = "UNKNOWN"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RecommendedAction(str, Enum):
    BAN_IP = "BAN_IP"
    THROTTLE_IP = "THROTTLE_IP"
    MONITOR = "MONITOR"
    ALERT_ONLY = "ALERT_ONLY"
    SHUTDOWN_ENDPOINT = "SHUTDOWN_ENDPOINT"


class ResponseMode(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"        # confidence >= 0.95, execute immediately
    REVIEW_REQUIRED = "REVIEW_REQUIRED"  # 0.70 <= confidence < 0.95, wait for human
    MONITOR_ONLY = "MONITOR_ONLY"        # confidence < 0.70, log only


class ThreatAnalysis(BaseModel):
    threat_type: ThreatType = Field(..., description="Classified threat category")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    severity: Severity = Field(..., description="Threat severity level")
    recommended_action: RecommendedAction = Field(..., description="Suggested response action")
    reason: str = Field(..., description="Human-readable explanation of the threat")
    response_mode: ResponseMode = Field(..., description="How SENTINAL should handle this")
    raw_indicators: dict = Field(default_factory=dict, description="Raw alert data used in analysis")

    class Config:
        use_enum_values = True
