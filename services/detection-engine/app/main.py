"""
SENTINAL Detection Engine — FastAPI Entry Point

dotenv is loaded from the ROOT .env file at startup.
Path resolution: this file is at services/detection-engine/app/main.py
Root .env is 3 directories up: Path(__file__).parents[3] / ".env"

Directory structure:
  SENTINAL/                        ← root (parents[3] from app/main.py)
    services/
      detection-engine/
        app/
          main.py                  ← this file
"""
from pathlib import Path
from dotenv import load_dotenv
import os
import time

# Load root .env FIRST — before any other imports
_env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

# Capture start time immediately after env load
_start_time = time.time()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import AnalyzeRequest
from app.rules import run_rules
from app.classifier import score_request
from app.explainer import explain
from app.decoder import decode_and_scan
from app.features import extract_features
# ── NEW: OpenClaw webhook router ──────────────────────────────────────────────
from app.webhook_router import router as webhook_router, fire_alert_background
# ─────────────────────────────────────────────────────────────────────────────
import json
import logging

LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("detection-engine")

logger.info(f"[DETECTION-ENGINE] Loading env from: {_env_path}")
logger.info(f"[DETECTION-ENGINE] .env found: {_env_path.exists()}")
logger.info(f"[DETECTION-ENGINE] Port: {os.getenv('DETECTION_PORT', '8002')}")

app = FastAPI(title="SENTINAL Detection Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ── NEW: Register webhook router (adds POST /webhook/alert) ───────────────────
app.include_router(webhook_router)
# ─────────────────────────────────────────────────────────────────────────────


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000, 2)
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration}ms")
    return response


@app.get("/health")
def health():
    """Standard SENTINAL health probe. Used by Gateway serviceHealthService."""
    return {
        "status":      "ok",
        "service":     "detection-engine",
        "version":     "1.0.0",
        "uptime":      int(time.time() - _start_time),   # seconds since process start
        "port":        int(os.getenv("DETECTION_PORT", "8002")),
        "environment": os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development")),
        "timestamp":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        parts = []
        if request.url:
            parts.append(request.url)
        if request.queryParams:
            parts.append(json.dumps(request.queryParams))
        if request.body:
            parts.append(json.dumps(request.body))
        if request.headers:
            parts.append(json.dumps(request.headers))

        combined = " ".join(parts)

        scan_result = decode_and_scan(combined, run_rules)
        rule_match = scan_result["match"]
        adversarial_decoded = scan_result["adversarial_decoded"]

        features = extract_features(request.url or "")

        response_code = request.queryParams.get("responseCode") if request.queryParams else None
        if isinstance(response_code, str):
            response_code = int(response_code) if response_code.isdigit() else None

        if response_code and 200 <= response_code <= 302:
            attack_status = "successful"
        elif response_code and response_code in [403, 404, 500]:
            attack_status = "blocked"
        else:
            attack_status = "unknown"

        request_data = {"method": request.method, "body": request.body}
        score = score_request(request_data, rule_match)

        if rule_match:
            explanation = explain(
                threat_type=rule_match["threat_type"],
                rule_id=rule_match["rule_id"],
                severity=score["severity"],
                ip=request.ip or "unknown"
            )
            logger.warning(
                f"THREAT: {rule_match['threat_type']} from {request.ip} "
                f"confidence={score['confidence']} encoded={adversarial_decoded}"
            )

            result = {
                "logId":               request.logId,
                "threat_detected":     True,
                "threat_type":         rule_match["threat_type"],
                "rule_id":             rule_match["rule_id"],
                "confidence":          score["confidence"],
                "severity":            score["severity"],
                "status":              attack_status,
                "adversarial_decoded": adversarial_decoded,
                "features":            features,
                "explanation":         explanation,
                "message":             f"Rule {rule_match['rule_id']} matched: {rule_match['threat_type']}"
            }

            # ── NEW: Fire confirmed threat to OpenClaw (background, non-blocking) ──
            fire_alert_background(None, {
                "logId":               request.logId,
                "ip":                  request.ip,
                "threat_type":         rule_match["threat_type"],
                "rule_id":             rule_match["rule_id"],
                "confidence":          score["confidence"],
                "severity":            score["severity"],
                "status":              attack_status,
                "adversarial_decoded": adversarial_decoded,
            })
            # ─────────────────────────────────────────────────────────────────────

            return result

        return {
            "logId":               request.logId,
            "threat_detected":     False,
            "threat_type":         None,
            "rule_id":             None,
            "confidence":          0.0,
            "severity":            "none",
            "status":              attack_status,
            "adversarial_decoded": False,
            "features":            features,
            "explanation":         None,
            "message":             "No threats detected"
        }

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        return {
            "logId":           request.logId,
            "threat_detected": False,
            "threat_type":     None,
            "rule_id":         None,
            "confidence":      0.0,
            "severity":        "none",
            "status":          "unknown",
            "explanation":     None,
            "message":         "Analysis error — request logged"
        }
