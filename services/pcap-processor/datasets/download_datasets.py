#!/usr/bin/env python3
"""
datasets/download_datasets.py

Downloads real-world PCAP samples for testing the SENTINAL PCAP Processor.

Sources used (all publicly available, no login required):
  1. Wireshark sample captures (wiki.wireshark.org/SampleCaptures)
  2. Malware Traffic Analysis sample PCAPs
  3. MAWI Working Group backbone traffic

Usage:
    python datasets/download_datasets.py

Files are saved to datasets/samples/
"""
import os
import sys
import urllib.request
from pathlib import Path

SAMPLES_DIR = Path(__file__).parent / "samples"
SAMPLES_DIR.mkdir(parents=True, exist_ok=True)

# ── Sample PCAP download list ──────────────────────────────────────────────────
# Format: (filename, url, description)
DATASETS = [
    # Wireshark sample — HTTP GET
    (
        "http_get.pcap",
        "https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/http.cap",
        "Wireshark HTTP sample (normal GET traffic)",
    ),
    # Wireshark sample — DNS
    (
        "dns_sample.pcap",
        "https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/dns.cap",
        "Wireshark DNS sample",
    ),
    # Wireshark sample — ICMP
    (
        "icmp_sample.pcap",
        "https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/icmp.pcap",
        "Wireshark ICMP sample",
    ),
    # Wireshark sample — Telnet (clear-text credentials)
    (
        "telnet_sample.pcap",
        "https://wiki.wireshark.org/uploads/__moin_import__/attachments/SampleCaptures/telnet-cooked.pcap",
        "Telnet clear-text session",
    ),
    # Netresec — port scan example (nmap)
    (
        "nmap_scan.pcap",
        "https://www.netresec.com/files/PcapFiles/nmap.pcap",
        "Nmap port scan capture",
    ),
]


def download(filename: str, url: str, description: str):
    dest = SAMPLES_DIR / filename
    if dest.exists():
        print(f"  [SKIP] {filename} already exists")
        return
    print(f"  [DL]   {filename}  ({description})")
    try:
        urllib.request.urlretrieve(url, dest)
        size_kb = dest.stat().st_size / 1024
        print(f"         Saved {size_kb:.1f} KB → {dest}")
    except Exception as exc:
        print(f"         ERROR: {exc}")
        if dest.exists():
            dest.unlink()  # remove partial download


def main():
    print(f"Downloading PCAP samples to {SAMPLES_DIR}\n")
    for entry in DATASETS:
        download(*entry)
    print("\nDone. Run tests with:")
    print("  python tests/test_pcap_processor.py")


if __name__ == "__main__":
    main()
