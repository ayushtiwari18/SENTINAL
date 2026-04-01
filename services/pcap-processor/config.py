"""
config.py — Central configuration for PCAP Processor Service

dotenv is loaded from the ROOT .env file.
Path resolution: this file is at services/pcap-processor/config.py
Root .env is 2 directories up: Path(__file__).parents[2] / ".env"

Directory structure:
  SENTINAL/                        ← root (parents[2] from config.py)
    services/
      pcap-processor/
        config.py                  ← this file

All environment variables are defined here.
All other pcap-processor modules import from config.py — do NOT call load_dotenv elsewhere.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load root .env FIRST
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=_env_path, override=False)
# override=False: system/shell env vars (e.g. AWS Parameter Store exports) take priority

# ── Detection Engine ────────────────────────────────────────────────────
# Supports both new centralized DETECTION_URL and old DETECTION_ENGINE_URL
DETECTION_ENGINE_URL = (
    os.getenv("DETECTION_URL") or
    os.getenv("DETECTION_ENGINE_URL") or
    "http://localhost:8002"
)
ANALYZE_ENDPOINT = f"{DETECTION_ENGINE_URL}/analyze"

# ── Service ───────────────────────────────────────────────────────────────
SERVICE_HOST = os.getenv("HOST", "0.0.0.0")
# Supports both new centralized PCAP_PORT and old PORT
SERVICE_PORT = int(os.getenv("PCAP_PORT") or os.getenv("PORT") or "8003")

# ── Processing ────────────────────────────────────────────────────────────
BATCH_SIZE           = int(os.getenv("BATCH_SIZE",    "50"))
HTTP_TIMEOUT         = float(os.getenv("HTTP_TIMEOUT", "10.0"))
FLOW_TIMEOUT_SECONDS = int(os.getenv("FLOW_TIMEOUT",  "120"))
MAX_PCAP_SIZE_MB     = int(os.getenv("MAX_PCAP_SIZE_MB", "500"))

# ── Detection thresholds ───────────────────────────────────────────────
PORT_SCAN_THRESHOLD      = int(os.getenv("PORT_SCAN_THRESHOLD",      "15"))
SYN_FLOOD_PPS_THRESHOLD  = int(os.getenv("SYN_FLOOD_PPS_THRESHOLD",  "100"))
DDOS_PPS_THRESHOLD       = int(os.getenv("DDOS_PPS_THRESHOLD",       "500"))
DNS_AMP_RATIO_THRESHOLD  = float(os.getenv("DNS_AMP_RATIO_THRESHOLD", "5.0"))
ICMP_FLOOD_PPS_THRESHOLD = int(os.getenv("ICMP_FLOOD_PPS_THRESHOLD",  "50"))
BRUTE_FORCE_THRESHOLD    = int(os.getenv("BRUTE_FORCE_THRESHOLD",     "10"))

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_DIR   = os.getenv("LOG_DIR",   "logs")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
