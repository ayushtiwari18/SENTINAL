"""
logger.py — Structured logging setup for PCAP Processor Service.

Provides:
  - Console handler with ISO-8601 timestamps
  - Optional file handler (writes to logs/ directory)
  - Configurable log level via LOG_LEVEL env var
"""
import logging
import os
import sys
from pathlib import Path

_INITIALIZED = False


def _init_logging():
    global _INITIALIZED
    if _INITIALIZED:
        return

    try:
        from config import LOG_DIR, LOG_LEVEL
    except ImportError:
        LOG_DIR   = "logs"
        LOG_LEVEL = "INFO"

    level = getattr(logging, LOG_LEVEL.upper(), logging.INFO)

    fmt = logging.Formatter(
        fmt="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )

    root = logging.getLogger()
    root.setLevel(level)

    # Console
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(fmt)
    root.addHandler(ch)

    # File (best-effort)
    try:
        log_path = Path(LOG_DIR)
        log_path.mkdir(parents=True, exist_ok=True)
        fh = logging.FileHandler(log_path / "pcap_processor.log", encoding="utf-8")
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except Exception as e:
        root.warning("Could not create file log handler: %s", e)

    _INITIALIZED = True


def get_logger(name: str) -> logging.Logger:
    _init_logging()
    return logging.getLogger(name)
