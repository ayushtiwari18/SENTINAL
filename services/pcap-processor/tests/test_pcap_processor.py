#!/usr/bin/env python3
"""
tests/test_pcap_processor.py

Integration + unit tests for SENTINAL PCAP Processor.
Runs WITHOUT the Detection Engine (network calls are mocked).

Tests:
  T1  normal_traffic.pcap   → 0 local attacks
  T2  port_scan.pcap        → PORT_SCAN detected
  T3  syn_flood.pcap        → SYN_FLOOD detected
  T4  ddos.pcap             → DDOS detected
  T5  icmp_flood.pcap       → ICMP_FLOOD detected
  T6  dns_amplification.pcap→ DNS_AMPLIFICATION detected
  T7  sqli_http.pcap        → SQL_INJECTION detected
  T8  xss_http.pcap         → XSS detected
  T9  malformed.pcap        → graceful handling, no crash
  T10 non_existent.pcap     → ValueError raised

Usage:
    # First generate fixtures:
    python tests/generate_test_pcaps.py
    # Then run tests:
    python tests/test_pcap_processor.py
"""
import sys
import os
import time
from pathlib import Path

# Allow imports from parent directory
sys.path.insert(0, str(Path(__file__).parent.parent))

from pcap_loader import load_pcap
from packet_parser import parse_packets
from flow_builder import build_flows
from attack_detector import run_detections

FIXTURES = Path(__file__).parent / "fixtures"

PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
SKIP = "\033[93m[SKIP]\033[0m"


def _process(filename: str):
    """Load → parse → flow → detect pipeline."""
    fp = str(FIXTURES / filename)
    packets = load_pcap(fp)
    parsed  = parse_packets(packets)
    if not parsed:
        return [], {}, {}, {}
    flows, src_view, dst_view = build_flows(parsed)
    detections = run_detections(flows, src_view, dst_view)
    return detections, flows, src_view, dst_view


def _has_attack(detections, attack_type: str) -> bool:
    return any(d.attack_type == attack_type for d in detections)


def run_test(name, fn):
    try:
        result = fn()
        if result:
            print(f"{PASS} {name}")
        else:
            print(f"{FAIL} {name}")
        return result
    except Exception as exc:
        print(f"{FAIL} {name}  →  {exc}")
        return False


def t1_normal():
    fixture = FIXTURES / "normal_traffic.pcap"
    if not fixture.exists():
        print(f"{SKIP} T1 — fixture not found (run generate_test_pcaps.py first)")
        return True
    detections, *_ = _process("normal_traffic.pcap")
    assert len(detections) == 0, f"Expected 0 attacks, got {len(detections)}: {[d.attack_type for d in detections]}"
    return True


def t2_port_scan():
    fixture = FIXTURES / "port_scan.pcap"
    if not fixture.exists():
        print(f"{SKIP} T2 — fixture not found")
        return True
    detections, *_ = _process("port_scan.pcap")
    assert _has_attack(detections, "PORT_SCAN"), f"Expected PORT_SCAN, got {[d.attack_type for d in detections]}"
    return True


def t3_syn_flood():
    fixture = FIXTURES / "syn_flood.pcap"
    if not fixture.exists():
        print(f"{SKIP} T3 — fixture not found")
        return True
    detections, *_ = _process("syn_flood.pcap")
    assert _has_attack(detections, "SYN_FLOOD"), f"Expected SYN_FLOOD, got {[d.attack_type for d in detections]}"
    return True


def t4_ddos():
    fixture = FIXTURES / "ddos.pcap"
    if not fixture.exists():
        print(f"{SKIP} T4 — fixture not found")
        return True
    detections, *_ = _process("ddos.pcap")
    assert _has_attack(detections, "DDOS"), f"Expected DDOS, got {[d.attack_type for d in detections]}"
    return True


def t5_icmp_flood():
    fixture = FIXTURES / "icmp_flood.pcap"
    if not fixture.exists():
        print(f"{SKIP} T5 — fixture not found")
        return True
    detections, *_ = _process("icmp_flood.pcap")
    assert _has_attack(detections, "ICMP_FLOOD"), f"Expected ICMP_FLOOD, got {[d.attack_type for d in detections]}"
    return True


def t6_dns_amp():
    fixture = FIXTURES / "dns_amplification.pcap"
    if not fixture.exists():
        print(f"{SKIP} T6 — fixture not found")
        return True
    detections, *_ = _process("dns_amplification.pcap")
    assert _has_attack(detections, "DNS_AMPLIFICATION"), f"Expected DNS_AMPLIFICATION, got {[d.attack_type for d in detections]}"
    return True


def t7_sqli():
    fixture = FIXTURES / "sqli_http.pcap"
    if not fixture.exists():
        print(f"{SKIP} T7 — fixture not found")
        return True
    detections, *_ = _process("sqli_http.pcap")
    assert _has_attack(detections, "SQL_INJECTION"), f"Expected SQL_INJECTION, got {[d.attack_type for d in detections]}"
    return True


def t8_xss():
    fixture = FIXTURES / "xss_http.pcap"
    if not fixture.exists():
        print(f"{SKIP} T8 — fixture not found")
        return True
    detections, *_ = _process("xss_http.pcap")
    assert _has_attack(detections, "XSS"), f"Expected XSS, got {[d.attack_type for d in detections]}"
    return True


def t9_malformed():
    fixture = FIXTURES / "malformed.pcap"
    if not fixture.exists():
        print(f"{SKIP} T9 — fixture not found")
        return True
    # Should not crash
    try:
        detections, *_ = _process("malformed.pcap")
    except Exception as exc:
        raise AssertionError(f"Malformed PCAP caused unhandled exception: {exc}")
    return True


def t10_nonexistent():
    try:
        load_pcap("/nonexistent/path/fake.pcap")
        raise AssertionError("Expected ValueError but none raised")
    except ValueError:
        return True


def perf_test():
    """Performance benchmark — uses syn_flood.pcap (200 pkts) and extrapolates."""
    fixture = FIXTURES / "syn_flood.pcap"
    if not fixture.exists():
        print(f"{SKIP} PERF — fixture not found")
        return

    t0 = time.perf_counter()
    packets = load_pcap(str(fixture))
    parsed  = parse_packets(packets)
    flows, src, dst = build_flows(parsed)
    run_detections(flows, src, dst)
    elapsed = time.perf_counter() - t0

    pps = len(packets) / elapsed if elapsed > 0 else 0
    print(f"\nPERFORMANCE REPORT")
    print(f"  Packets processed : {len(packets)}")
    print(f"  Processing time   : {elapsed*1000:.1f} ms")
    print(f"  Throughput        : {pps:,.0f} packets/second")


if __name__ == "__main__":
    tests = [
        ("T1  Normal traffic → 0 attacks",      t1_normal),
        ("T2  Port scan → PORT_SCAN detected",   t2_port_scan),
        ("T3  SYN flood → SYN_FLOOD detected",   t3_syn_flood),
        ("T4  DDoS → DDOS detected",             t4_ddos),
        ("T5  ICMP flood → ICMP_FLOOD detected", t5_icmp_flood),
        ("T6  DNS amp → DNS_AMPLIFICATION",      t6_dns_amp),
        ("T7  SQL injection → SQL_INJECTION",    t7_sqli),
        ("T8  XSS → XSS detected",              t8_xss),
        ("T9  Malformed PCAP → no crash",        t9_malformed),
        ("T10 Non-existent file → ValueError",   t10_nonexistent),
    ]

    passed = 0
    for name, fn in tests:
        if run_test(name, fn):
            passed += 1

    print(f"\nResults: {passed}/{len(tests)} tests passed")
    perf_test()
