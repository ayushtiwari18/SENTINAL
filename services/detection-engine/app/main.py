from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import AnalyzeRequest
from app.rules import run_rules
from app.classifier import score_request
from app.explainer import explain
from app.decoder import decode_and_scan
from app.features import extract_features
import json
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detection-engine")

app = FastAPI(title="SENTINEL Detection Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

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
        "version": "1.0.0"
    }

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        # Build combined string
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

        # Layer 3 — Adversarial decoder + Layer 1 rules
        scan_result = decode_and_scan(combined, run_rules)
        rule_match = scan_result["match"]
        adversarial_decoded = scan_result["adversarial_decoded"]

        # Layer 2 — Feature extraction (ready for ML model)
        features = extract_features(request.url or "")

        # Layer 4 — Success determination
        response_code = request.queryParams.get("responseCode") if request.queryParams else None
        if isinstance(response_code, str):
            response_code = int(response_code) if response_code.isdigit() else None

        if response_code and 200 <= response_code <= 302:
            attack_status = "successful"
        elif response_code and response_code in [403, 404, 500]:
            attack_status = "blocked"
        else:
            attack_status = "unknown"

        # Layer 6 — Scoring
        request_data = {
            "method": request.method,
            "body": request.body
        }
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
            return {
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
