from fastapi import FastAPI
from app.schemas import AnalyzeRequest
from app.rules import run_rules
import json

app = FastAPI(title="SENTINEL Detection Engine", version="1.0.0")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "detection-engine",
        "version": "1.0.0"
    }

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    # Build a single string from all request fields to scan
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
    match = run_rules(combined)

    if match:
        return {
            "logId": request.logId,
            "threat_detected": True,
            "threat_type": match["threat_type"],
            "rule_id": match["rule_id"],
            "confidence": 0.85,
            "message": f"Rule {match['rule_id']} matched: {match['threat_type']}"
        }

    return {
        "logId": request.logId,
        "threat_detected": False,
        "threat_type": None,
        "rule_id": None,
        "confidence": 0.0,
        "message": "No threats detected"
    }
