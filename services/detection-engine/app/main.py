from pathlib import Path
from dotenv import load_dotenv
import os
import time
import json
import logging

_env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)
_start_time = time.time()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import AnalyzeRequest
from app.rules import run_rules
from app.classifier import score_request
from app.explainer import explain
from app.decoder import decode_and_scan
from app.features import extract_features
from app.webhook_router import router as webhook_router, fire_alert_background

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("detection-engine")

app = FastAPI(title="SENTINAL Detection Engine", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(webhook_router)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration}ms")
    return response

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "detection-engine",
        "version": "1.1.0",
        "uptime": int(time.time() - _start_time),
        "port": int(os.getenv("DETECTION_PORT", "8002")),
        "environment": os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

def safe_string(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, default=str)
    return str(value)

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        url = request.url or ""
        parts = [
            safe_string(url),
            safe_string(request.body),
            safe_string(request.headers),
        ]
        if request.queryParams:
            parts.append(safe_string(request.queryParams))

        combined = " ".join(p for p in parts if p)

        scan_result = decode_and_scan(combined, run_rules)
        rule_match = scan_result.get("match")
        adversarial_decoded = scan_result.get("adversarial_decoded", False)

        features = extract_features(url)

        request_data = {
            "method": request.method or "",
            "body": request.body,
        }

        score = score_request(request_data, rule_match, url=url)
        attack_status = "unknown"

        is_attack = rule_match is not None or score.get("severity") != "none"

        if is_attack:
            threat_type = rule_match["threat_type"] if rule_match else "ml_detected"
            rule_id = rule_match["rule_id"] if rule_match else "ML"

            explanation = explain(
                threat_type=threat_type,
                rule_id=rule_id,
                severity=score.get("severity", "unknown"),
                ip=request.ip or "unknown",
                url=url,
            )

            result = {
                "logId": request.logId,
                "threat_detected": True,
                "threat_type": threat_type,
                "rule_id": rule_id,
                "confidence": score.get("confidence", 0.0),
                "severity": score.get("severity", "unknown"),
                "scored_by": score.get("scored_by", "unknown"),
                "status": attack_status,
                "adversarial_decoded": adversarial_decoded,
                "features": features,
                "explanation": explanation,
                "message": (
                    f"Rule {rule_id} matched: {threat_type}"
                    if rule_match else
                    f"ML model flagged request (confidence={score.get('confidence', 0.0)})"
                )
            }

            fire_alert_background(None, {
                "logId": request.logId,
                "ip": request.ip,
                "threat_type": threat_type,
                "rule_id": rule_id,
                "confidence": score.get("confidence", 0.0),
                "severity": score.get("severity", "unknown"),
                "status": attack_status,
                "adversarial_decoded": adversarial_decoded,
            })

            return result

        return {
            "logId": request.logId,
            "threat_detected": False,
            "threat_type": None,
            "rule_id": None,
            "confidence": score.get("confidence", 0.0),
            "severity": "none",
            "scored_by": score.get("scored_by", "unknown"),
            "status": attack_status,
            "adversarial_decoded": False,
            "features": features,
            "explanation": None,
            "message": "No threats detected"
        }

    except Exception as e:
        logger.exception(f"Analysis failed: {str(e)}")
        return {
            "logId": getattr(request, "logId", None),
            "threat_detected": False,
            "threat_type": None,
            "rule_id": None,
            "confidence": 0.0,
            "severity": "none",
            "scored_by": "error",
            "status": "unknown",
            "explanation": None,
            "message": "Analysis error — request logged"
        }