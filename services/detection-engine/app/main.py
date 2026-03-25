from fastapi import FastAPI

app = FastAPI(title="SENTINEL Detection Engine", version="1.0.0")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "detection-engine",
        "version": "1.0.0"
    }
