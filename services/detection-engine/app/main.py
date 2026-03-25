from fastapi import FastAPI
from app.schemas import AnalyzeRequest

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
    return {
        "logId": request.logId,
        "threat_detected": False,
        "threat_type": None,
        "confidence": 0.0,
        "message": "Analysis pending — rule engine not yet loaded"
    }
