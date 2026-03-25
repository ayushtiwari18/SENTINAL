from fastapi import FastAPI
from app.schemas import AnalyzeRequest
from app.rules import run_rules
from app.classifier import score_request
from app.explainer import explain
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
    # Build combined string for rule scanning
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

    # Run rule engine
    rule_match = run_rules(combined)

    # Run classifier scoring
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
        return {
            "logId":            request.logId,
            "threat_detected":  True,
            "threat_type":      rule_match["threat_type"],
            "rule_id":          rule_match["rule_id"],
            "confidence":       score["confidence"],
            "severity":         score["severity"],
            "explanation":      explanation,
            "message":          f"Rule {rule_match['rule_id']} matched: {rule_match['threat_type']}"
        }

    return {
        "logId":            request.logId,
        "threat_detected":  False,
        "threat_type":      None,
        "rule_id":          None,
        "confidence":       0.0,
        "severity":         "none",
        "explanation":      None,
        "message":          "No threats detected"
    }
