"""
pcap_loader.py — Safely loads a PCAP/PCAPng file using Scapy.

Responsibilities:
  - Validate file exists and is non-empty
  - Enforce configurable size limits
  - Detect pcapng vs pcap format automatically
  - Return a Scapy PacketList or raise informative errors
"""
import os
from pathlib import Path

from scapy.all import rdpcap, PcapNgReader
from scapy.error import Scapy_Exception

from config import MAX_PCAP_SIZE_MB
from logger import get_logger

log = get_logger(__name__)

MAX_BYTES = MAX_PCAP_SIZE_MB * 1024 * 1024


def load_pcap(filepath: str):
    """
    Load a .pcap or .pcapng file.
    Returns a Scapy PacketList.
    Raises ValueError for bad inputs, RuntimeError for parse failures.
    """
    path = Path(filepath)

    if not path.exists():
        raise ValueError(f"File not found: {filepath}")

    if not path.is_file():
        raise ValueError(f"Path is not a file: {filepath}")

    file_size = path.stat().st_size
    if file_size == 0:
        raise ValueError(f"File is empty: {filepath}")

    if file_size > MAX_BYTES:
        raise ValueError(
            f"File exceeds size limit ({file_size / 1024**2:.1f} MB > {MAX_PCAP_SIZE_MB} MB): {filepath}"
        )

    suffix = path.suffix.lower()
    log.info("Loading PCAP file: %s (%.2f MB, format=%s)", filepath, file_size / 1024**2, suffix)

    try:
        # pcapng files need explicit reader; rdpcap handles both but PcapNgReader
        # is more robust for ng format.
        if suffix == ".pcapng":
            with PcapNgReader(filepath) as reader:
                packets = reader.read_all()
        else:
            packets = rdpcap(filepath)
    except Scapy_Exception as exc:
        raise RuntimeError(f"Scapy failed to parse file '{filepath}': {exc}") from exc
    except Exception as exc:
        raise RuntimeError(f"Unexpected error loading '{filepath}': {exc}") from exc

    log.info("Loaded %d packets from %s", len(packets), filepath)
    return packets
