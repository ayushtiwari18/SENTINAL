"""
config.py — Central configuration for PCAP Processor Service
All environment variables and constants are defined here.
"""
import os
from dotenv import load_dotenv

load_dotenv()

# ── Detection Engine ──────────────────────────────────────────────────────────
DETECTION_ENGINE_URL = os.getenv("DETECTION_ENGINE_URL", "http://localhost:8002")
ANALYZE_ENDPOINT     = f"{DETECTION_ENGINE_URL}/analyze"

# ── Service ───────────────────────────────────────────────────────────────────
SERVICE_HOST = os.getenv("HOST", "0.0.0.0")
SERVICE_PORT = int(os.getenv("PORT", "8003"))

# ── Processing ────────────────────────────────────────────────────────────────
BATCH_SIZE            = int(os.getenv("BATCH_SIZE", "50"))
HTTP_TIMEOUT          = float(os.getenv("HTTP_TIMEOUT", "10.0"))
FLOW_TIMEOUT_SECONDS  = int(os.getenv("FLOW_TIMEOUT", "120"))   # seconds before flow expires
MAX_PCAP_SIZE_MB      = int(os.getenv("MAX_PCAP_SIZE_MB", "500"))

# ── Detection thresholds ─────────────────────────────────────────────────────
# Port scan: unique destination ports from a single source within a flow window
PORT_SCAN_THRESHOLD        = int(os.getenv("PORT_SCAN_THRESHOLD",        "15"))
# SYN flood: SYN packets per second from a single source
SYN_FLOOD_PPS_THRESHOLD    = int(os.getenv("SYN_FLOOD_PPS_THRESHOLD",   "100"))
# DDoS: total packets per second across all sources to a single destination
DDOS_PPS_THRESHOLD         = int(os.getenv("DDOS_PPS_THRESHOLD",        "500"))
# DNS amplification: response/request byte ratio
DNS_AMP_RATIO_THRESHOLD    = float(os.getenv("DNS_AMP_RATIO_THRESHOLD",  "5.0"))
# ICMP flood: ICMP packets per second from a single source
ICMP_FLOOD_PPS_THRESHOLD   = int(os.getenv("ICMP_FLOOD_PPS_THRESHOLD",  "50"))
# Brute-force: failed login attempts (4xx on POST /login paths) per source IP
BRUTE_FORCE_THRESHOLD      = int(os.getenv("BRUTE_FORCE_THRESHOLD",     "10"))

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_DIR   = os.getenv("LOG_DIR",   "logs")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
