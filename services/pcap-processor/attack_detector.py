"""
attack_detector.py — Rule-based attack detection engine for PCAP processor.

Detects:
  1. Port Scan          — single source touching many destination ports
  2. SYN Flood          — high SYN rate from a single source
  3. DDoS               — many sources hammering a single destination at high pps
  4. ICMP Flood         — high ICMP packet rate from a single source
  5. DNS Amplification  — large DNS responses relative to query size
  6. Brute Force (HTTP) — repeated POST to login-like endpoints with 4xx responses
  7. SQL Injection hint — SQL keywords in HTTP query params or body (pre-send to Detection Engine)
  8. XSS hint           — script tags / JS event handlers in HTTP params

Note: HTTP-layer attacks (SQLi, XSS, etc.) are also forwarded to the Detection Engine
for deep ML/rule scoring. The local rules here catch network-layer threats independently.
"""
import re
from typing import List, Dict, Tuple

from config import (
    PORT_SCAN_THRESHOLD,
    SYN_FLOOD_PPS_THRESHOLD,
    DDOS_PPS_THRESHOLD,
    DNS_AMP_RATIO_THRESHOLD,
    ICMP_FLOOD_PPS_THRESHOLD,
    BRUTE_FORCE_THRESHOLD,
)
from logger import get_logger

log = get_logger(__name__)

# ── SQL Injection patterns ────────────────────────────────────────────────────
_SQLI_PATTERNS = re.compile(
    r"(\b(select|union|insert|update|delete|drop|truncate|exec|execute|xp_|sp_)\b"
    r"|--|;\s*--|'\s*or\s*'1'\s*=\s*'1|\bor\b.+?=.+?|sleep\s*\(|benchmark\s*\()",
    re.IGNORECASE,
)

# ── XSS patterns ─────────────────────────────────────────────────────────────
_XSS_PATTERNS = re.compile(
    r"(<\s*script|javascript:|on\w+\s*=|<\s*img[^>]+onerror|<\s*iframe|alert\s*\()",
    re.IGNORECASE,
)

# ── Login URL heuristic ───────────────────────────────────────────────────────
_LOGIN_PATH = re.compile(r"/(login|signin|auth|session|token|admin)", re.IGNORECASE)


class Detection:
    """Represents a single detected attack event."""
    __slots__ = ("attack_type", "severity", "src_ip", "dst_ip", "description", "evidence")

    def __init__(self, attack_type: str, severity: str, src_ip: str = "",
                 dst_ip: str = "", description: str = "", evidence: dict = None):
        self.attack_type = attack_type
        self.severity    = severity
        self.src_ip      = src_ip
        self.dst_ip      = dst_ip
        self.description = description
        self.evidence    = evidence or {}

    def to_dict(self) -> dict:
        return {
            "attack_type":  self.attack_type,
            "severity":     self.severity,
            "src_ip":       self.src_ip,
            "dst_ip":       self.dst_ip,
            "description":  self.description,
            "evidence":     self.evidence,
        }


def run_detections(
    flows: Dict[str, dict],
    src_view: Dict[str, dict],
    dst_view: Dict[str, dict],
) -> List[Detection]:
    """
    Run all network-layer detection rules.
    Returns a list of Detection objects.
    """
    detections: List[Detection] = []

    detections.extend(_detect_port_scan(src_view))
    detections.extend(_detect_syn_flood(src_view))
    detections.extend(_detect_ddos(dst_view))
    detections.extend(_detect_icmp_flood(src_view, flows))
    detections.extend(_detect_dns_amplification(flows))
    detections.extend(_detect_http_layer(flows))

    log.info("Detection engine found %d attack signals", len(detections))
    return detections


# ── Detection rules ────────────────────────────────────────────────────────────

def _detect_port_scan(src_view: Dict[str, dict]) -> List[Detection]:
    detections = []
    for ip, s in src_view.items():
        unique_ports = len(s["unique_dst_ports"])
        if unique_ports >= PORT_SCAN_THRESHOLD:
            severity = "HIGH" if unique_ports >= PORT_SCAN_THRESHOLD * 3 else "MEDIUM"
            detections.append(Detection(
                attack_type="PORT_SCAN",
                severity=severity,
                src_ip=ip,
                description=(
                    f"Source {ip} contacted {unique_ports} unique destination ports "
                    f"(threshold: {PORT_SCAN_THRESHOLD})"
                ),
                evidence={
                    "unique_dst_ports": unique_ports,
                    "sample_ports": s["unique_dst_ports"][:20],
                    "total_packets": s["total_packets"],
                },
            ))
    return detections


def _detect_syn_flood(src_view: Dict[str, dict]) -> List[Detection]:
    detections = []
    for ip, s in src_view.items():
        dur = s["end_time"] - s["start_time"]
        syn_pps = s["syn_count"] / dur if dur > 0 else s["syn_count"]
        if syn_pps >= SYN_FLOOD_PPS_THRESHOLD:
            detections.append(Detection(
                attack_type="SYN_FLOOD",
                severity="CRITICAL",
                src_ip=ip,
                description=(
                    f"Source {ip} sent {s['syn_count']} SYN packets "
                    f"at {syn_pps:.1f} SYN/s (threshold: {SYN_FLOOD_PPS_THRESHOLD}/s)"
                ),
                evidence={
                    "syn_count":  s["syn_count"],
                    "syn_pps":    round(syn_pps, 2),
                    "duration_s": round(dur, 3),
                },
            ))
    return detections


def _detect_ddos(dst_view: Dict[str, dict]) -> List[Detection]:
    detections = []
    for ip, d in dst_view.items():
        if d["pps"] >= DDOS_PPS_THRESHOLD and len(d["unique_src_ips"]) >= 3:
            detections.append(Detection(
                attack_type="DDOS",
                severity="CRITICAL",
                dst_ip=ip,
                description=(
                    f"Destination {ip} received {d['total_packets']} packets "
                    f"at {d['pps']:.1f} pps from {len(d['unique_src_ips'])} sources "
                    f"(threshold: {DDOS_PPS_THRESHOLD} pps)"
                ),
                evidence={
                    "pps":            d["pps"],
                    "src_ip_count":   len(d["unique_src_ips"]),
                    "total_packets":  d["total_packets"],
                    "total_bytes":    d["total_bytes"],
                },
            ))
    return detections


def _detect_icmp_flood(src_view: Dict[str, dict], flows: Dict[str, dict]) -> List[Detection]:
    detections = []
    icmp_src: Dict[str, dict] = {}
    for flow in flows.values():
        if flow["protocol"] not in ("ICMP", "ICMPv6"):
            continue
        ip = flow["src_ip"]
        if ip not in icmp_src:
            icmp_src[ip] = {"count": 0, "start": flow["start_time"], "end": flow["end_time"]}
        icmp_src[ip]["count"] += flow["packet_count"]
        icmp_src[ip]["start"]  = min(icmp_src[ip]["start"], flow["start_time"])
        icmp_src[ip]["end"]    = max(icmp_src[ip]["end"],   flow["end_time"])

    for ip, data in icmp_src.items():
        dur = data["end"] - data["start"]
        pps = data["count"] / dur if dur > 0 else data["count"]
        if pps >= ICMP_FLOOD_PPS_THRESHOLD:
            detections.append(Detection(
                attack_type="ICMP_FLOOD",
                severity="HIGH",
                src_ip=ip,
                description=(
                    f"Source {ip} sent {data['count']} ICMP packets "
                    f"at {pps:.1f} pps (threshold: {ICMP_FLOOD_PPS_THRESHOLD})"
                ),
                evidence={"icmp_pps": round(pps, 2), "icmp_count": data["count"]},
            ))
    return detections


def _detect_dns_amplification(flows: Dict[str, dict]) -> List[Detection]:
    detections = []
    # Group DNS flows: match query flow (small) with response flow (large)
    dns_flows = [
        f for f in flows.values()
        if f["protocol"] == "DNS" and f["dns_queries"]
    ]
    for flow in dns_flows:
        total_responses = sum(q.get("ancount", 0) for q in flow["dns_queries"])
        total_queries   = sum(q.get("qdcount", 0) for q in flow["dns_queries"])
        if total_queries > 0:
            ratio = total_responses / total_queries
            if ratio >= DNS_AMP_RATIO_THRESHOLD:
                detections.append(Detection(
                    attack_type="DNS_AMPLIFICATION",
                    severity="HIGH",
                    src_ip=flow["src_ip"],
                    dst_ip=flow["dst_ip"],
                    description=(
                        f"DNS amplification suspected: response/query ratio={ratio:.1f} "
                        f"(threshold: {DNS_AMP_RATIO_THRESHOLD})"
                    ),
                    evidence={
                        "response_count":     total_responses,
                        "query_count":        total_queries,
                        "amplification_ratio": round(ratio, 2),
                    },
                ))
    return detections


def _detect_http_layer(flows: Dict[str, dict]) -> List[Detection]:
    """Detect HTTP-layer attacks: SQLi, XSS hints, brute-force login."""
    detections: List[Detection] = []

    # Brute force tracker: src_ip -> list of (url, response_code)
    brute_tracker: Dict[str, List] = {}

    for flow in flows.values():
        for req in flow.get("http_requests", []):
            src_ip  = req.get("ip", flow["src_ip"])
            url     = req.get("url", "")
            method  = req.get("method", "")
            qp      = req.get("queryParams", {})
            body    = req.get("body", {})
            code    = req.get("responseCode")

            combined_text = url + " " + " ".join(str(v) for v in qp.values())
            if isinstance(body, dict):
                combined_text += " " + body.get("raw", "")

            # SQLi hint
            if _SQLI_PATTERNS.search(combined_text):
                detections.append(Detection(
                    attack_type="SQL_INJECTION",
                    severity="HIGH",
                    src_ip=src_ip,
                    description=f"SQL injection pattern detected in request to {url}",
                    evidence={"url": url, "params": qp},
                ))

            # XSS hint
            if _XSS_PATTERNS.search(combined_text):
                detections.append(Detection(
                    attack_type="XSS",
                    severity="MEDIUM",
                    src_ip=src_ip,
                    description=f"XSS pattern detected in request to {url}",
                    evidence={"url": url, "params": qp},
                ))

            # Brute force: track failed POSTs to login-like paths
            if method == "POST" and _LOGIN_PATH.search(url):
                if src_ip not in brute_tracker:
                    brute_tracker[src_ip] = []
                brute_tracker[src_ip].append(url)

    for src_ip, attempts in brute_tracker.items():
        if len(attempts) >= BRUTE_FORCE_THRESHOLD:
            detections.append(Detection(
                attack_type="BRUTE_FORCE",
                severity="HIGH",
                src_ip=src_ip,
                description=(
                    f"Brute-force login attempt: {len(attempts)} POST requests "
                    f"to login endpoints (threshold: {BRUTE_FORCE_THRESHOLD})"
                ),
                evidence={"attempt_count": len(attempts), "sample_urls": attempts[:5]},
            ))

    return detections


def extract_http_for_engine(flows: Dict[str, dict], project_id: str = "pcap-upload") -> List[dict]:
    """
    Collect all HTTP requests across flows into a flat list
    compatible with the Detection Engine /analyze endpoint.
    """
    requests = []
    for flow in flows.values():
        for req in flow.get("http_requests", []):
            requests.append({
                "projectId":    project_id,
                "method":       req.get("method", "GET"),
                "url":          req.get("url", "/"),
                "ip":           req.get("ip", flow["src_ip"]),
                "queryParams":  req.get("queryParams", {}),
                "body":         req.get("body", {}),
                "headers":      req.get("headers", {}),
                "responseCode": req.get("responseCode"),
                "timestamp":    req.get("timestamp", flow["start_time"]),
            })
    return requests
