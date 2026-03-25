from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import AnalyzeRequest
from app.rules import run_rules
from app.classifier import score_request
from app.explainer import explain
import json
import logging
import time

# Logger setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("detection-engine")

app = FastAPI(title="SENTINEL Detection Engine", version="1.0.0")

# CORS — allow Gateway and Dashboard
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
        rule_match = run_rules(combined)

        request_data = {
            "method": request.method,
            "body": request.body
        }
        score = score_request(request_data, rule_match)

        if rule_match:
            explanation = explain(
                threat_type = rule_match["threat_type"],
                rule_id     = rule_match["rule_id"],
                severity    = score["severity"],
                ip          = request.ip or "unknown"
            )
            logger.warning(f"THREAT DETECTED: {rule_match['threat_type']} from {request.ip} confidence={score['confidence']}")
            return {
                "logId":           request.logId,
                "threat_detected": True,
                "threat_type":     rule_match["threat_type"],
                "rule_id":         rule_match["rule_id"],
                "confidence":      score["confidence"],
                "severity":        score["severity"],
                "explanation":     explanation,
                "message":         f"Rule {rule_match['rule_id']} matched: {rule_match['threat_type']}"
            }

        return {
            "logId":           request.logId,
            "threat_detected": False,
            "threat_type":     None,
            "rule_id":         None,
            "confidence":      0.0,
            "severity":        "none",
            "explanation":     None,
            "message":         "No threats detected"
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
            "explanation":     None,
            "message":         "Analysis error — request logged"
        }
