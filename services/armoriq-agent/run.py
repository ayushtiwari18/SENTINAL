"""
run.py — Uvicorn launcher for ArmorIQ Agent

Usage:
  python run.py
  # or via PM2 / shell script

Reads ARMORIQ_PORT and HOST from the root .env file.
"""
import os
import uvicorn
from pathlib import Path
from dotenv import load_dotenv

# Load root .env
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("ARMORIQ_PORT", "8004"))
    log_level = os.getenv("LOG_LEVEL", "info").lower()

    print(f"[ARMORIQ] Starting on {host}:{port}")
    print(f"[ARMORIQ] Root .env: {_env_path} (exists={_env_path.exists()})")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=False,
        log_level=log_level
    )
