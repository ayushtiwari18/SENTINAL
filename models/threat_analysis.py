from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from datetime import datetime


class ThreatType(str, Enum):
    SSH_BRUTE_FORCE = "SSH_BRUTE_FORCE"
    PORT_SCAN = "PORT_SCAN"
    SQLI_ATTEMPT = "SQLI_ATTEMPT"
    DDOS = "DDOS"
    MALWARE_CALLBACK = "MALWARE_CALLBACK"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    CREDENTIAL_STUFFING = "CREDENTIAL_STUFFING"
    UNKNOWN = "UNKNOWN"


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class ResponseMode(str, Enum):
    AUTO_EXECUTE = "AUTO_EXECUTE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    MONITOR_ONLY = "MONITOR_ONLY"


class RecommendedAction(str, Enum):
    BAN_IP = "BAN_IP"
    RATE_LIMIT = "RATE_LIMIT"
    MONITOR = "MONITOR"
    ALERT_ONLY = "ALERT_ONLY"
    QUARANTINE = "QUARANTINE"


class ThreatAnalysis(BaseModel):
    alert_id: str
    source_ip: str
    threat_type: ThreatType
    confidence: float = Field(ge=0.0, le=1.0)
    severity: Severity
    recommended_action: RecommendedAction
    reason: str
    response_mode: ResponseMode
    raw_payload: Optional[dict] = None
    analyzed_at: datetime = Field(default_factory=datetime.utcnow)

    @property
    def confidence_pct(self) -> int:
        return int(self.confidence * 100)

    class Config:
        use_enum_values = True
