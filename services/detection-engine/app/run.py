"""
run.py — Uvicorn launcher for Detection Engine

Usage:
  python run.py
  # or via PM2 / shell script

Reads DETECTION_PORT and HOST from the root .env file (loaded in main.py).
"""
import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load root .env before reading any env vars
_env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("DETECTION_PORT", "8002"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    print(f"[DETECTION-ENGINE] Starting on {host}:{port}")
    print(f"[DETECTION-ENGINE] Root .env: {_env_path} (exists={_env_path.exists()})")

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level=log_level
    )
