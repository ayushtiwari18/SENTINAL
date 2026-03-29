"""
Threat Analysis Model
---------------------
Structured output from intent_builder.py LLM analysis.
"""

from pydantic import BaseModel, Field
from typing import Literal, Optional
from enum import Enum


class ThreatType(str, Enum):
    SSH_BRUTE_FORCE = "SSH_BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    DDOS = "DDOS"
    SQLI_ATTEMPT = "SQLI_ATTEMPT"
    XSS_ATTEMPT = "XSS_ATTEMPT"
    MALWARE_BEACON = "MALWARE_BEACON"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    UNKNOWN = "UNKNOWN"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class RecommendedAction(str, Enum):
    BAN_IP = "BAN_IP"
    RATE_LIMIT = "RATE_LIMIT"
    MONITOR = "MONITOR"
    ALERT_ONLY = "ALERT_ONLY"
    SHUTDOWN_ENDPOINT = "SHUTDOWN_ENDPOINT"


class ResponseMode(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    MONITOR_ONLY = "MONITOR_ONLY"


class ThreatAnalysis(BaseModel):
    threat_type: ThreatType
    confidence: float = Field(ge=0.0, le=1.0)
    severity: Severity
    recommended_action: RecommendedAction
    reasoning: str
    response_mode: ResponseMode
    ioc: Optional[list[str]] = None  # indicators of compromise
    raw_llm_output: Optional[str] = None
