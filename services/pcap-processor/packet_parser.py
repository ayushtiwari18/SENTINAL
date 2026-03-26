"""
packet_parser.py — Multi-protocol packet metadata extractor.

Supported protocols:
  Layer 3 : IPv4, IPv6
  Layer 4 : TCP, UDP, ICMP, ICMPv6
  Layer 7 : HTTP (raw TCP payload heuristic), DNS

Output per packet is a plain dict that flow_builder.py and attack_detector.py consume.
"""
import urllib.parse
from typing import Optional

from scapy.all import (
    IP, IPv6, TCP, UDP, ICMP, ICMPv6EchoRequest, ICMPv6EchoReply,
    DNS, DNSQR, DNSRR, Raw
)

from logger import get_logger

log = get_logger(__name__)

# HTTP methods we recognise in raw TCP payloads
_HTTP_METHODS = frozenset({
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "CONNECT", "TRACE"
})


def parse_packet(pkt) -> Optional[dict]:
    """
    Extract a normalised metadata dict from a single Scapy packet.
    Returns None if the packet is too thin to be useful (e.g. pure Ethernet noise).
    """
    meta = {
        "timestamp":  float(pkt.time),
        "src_ip":     None,
        "dst_ip":     None,
        "src_port":   None,
        "dst_port":   None,
        "protocol":   "UNKNOWN",
        "length":     len(pkt),
        "flags":      None,     # TCP flags string
        "http":       None,     # dict if HTTP found
        "dns":        None,     # dict if DNS found
        "icmp_type":  None,
    }

    # ── Layer 3 ────────────────────────────────────────────────────────────────
    if IP in pkt:
        meta["src_ip"] = pkt[IP].src
        meta["dst_ip"] = pkt[IP].dst
    elif IPv6 in pkt:
        meta["src_ip"] = pkt[IPv6].src
        meta["dst_ip"] = pkt[IPv6].dst
    else:
        # No IP layer — skip (ARP, STP, etc.)
        return None

    # ── Layer 4 ────────────────────────────────────────────────────────────────
    if TCP in pkt:
        tcp = pkt[TCP]
        meta["src_port"] = tcp.sport
        meta["dst_port"] = tcp.dport
        meta["protocol"] = "TCP"
        meta["flags"]    = _tcp_flags(tcp.flags)

        # HTTP heuristic — look for HTTP method in raw payload
        if Raw in pkt:
            http_meta = _try_parse_http(pkt[Raw].load, meta["src_ip"])
            if http_meta:
                meta["http"]     = http_meta
                meta["protocol"] = "HTTP"

    elif UDP in pkt:
        udp = pkt[UDP]
        meta["src_port"] = udp.sport
        meta["dst_port"] = udp.dport
        meta["protocol"] = "UDP"

        # DNS heuristic — port 53 or Scapy DNS layer
        if DNS in pkt:
            meta["dns"]      = _parse_dns(pkt[DNS])
            meta["protocol"] = "DNS"

    elif ICMP in pkt:
        meta["protocol"]  = "ICMP"
        meta["icmp_type"] = pkt[ICMP].type

    elif ICMPv6EchoRequest in pkt or ICMPv6EchoReply in pkt:
        meta["protocol"] = "ICMPv6"

    return meta


def parse_packets(packets) -> list[dict]:
    """
    Parse an entire Scapy PacketList.
    Silently skips packets that cannot be parsed.
    """
    results = []
    errors  = 0
    for pkt in packets:
        try:
            m = parse_packet(pkt)
            if m:
                results.append(m)
        except Exception as exc:
            errors += 1
            log.debug("Packet parse error: %s", exc)
    if errors:
        log.warning("Skipped %d malformed packets during parsing", errors)
    log.info("Parsed %d / %d packets successfully", len(results), len(packets))
    return results


# ── Helpers ────────────────────────────────────────────────────────────────────

def _tcp_flags(flags_int) -> str:
    """Convert Scapy TCP flags integer to string like 'SYN', 'SYN-ACK', etc."""
    mapping = [
        (0x02, "SYN"),
        (0x10, "ACK"),
        (0x01, "FIN"),
        (0x04, "RST"),
        (0x08, "PSH"),
        (0x20, "URG"),
    ]
    active = [name for bit, name in mapping if int(flags_int) & bit]
    return "-".join(active) if active else "NONE"


def _try_parse_http(raw_bytes: bytes, src_ip: str) -> Optional[dict]:
    """Attempt to parse an HTTP/1.x request from raw TCP payload bytes."""
    try:
        payload = raw_bytes.decode("utf-8", errors="ignore")
    except Exception:
        return None

    lines = payload.split("\r\n") if "\r\n" in payload else payload.split("\n")
    if not lines:
        return None

    parts = lines[0].split(" ")
    if len(parts) < 2 or parts[0] not in _HTTP_METHODS:
        return None

    method = parts[0]
    # Handle URLs that may contain spaces (rare but valid in some captures)
    if len(parts) >= 3 and parts[-1].startswith("HTTP/"):
        raw_url = " ".join(parts[1:-1])
    else:
        raw_url = " ".join(parts[1:])

    parsed      = urllib.parse.urlparse(raw_url)
    query_params = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))

    headers_dict: dict = {}
    body_start = 0
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "":
            body_start = i + 1
            break
        if ":" in line:
            k, _, v = line.partition(":")
            headers_dict[k.strip().lower()] = v.strip()

    raw_body = "\n".join(lines[body_start:]).strip() if body_start else ""

    return {
        "method":      method,
        "url":         raw_url,
        "queryParams": query_params,
        "body":        {"raw": raw_body} if raw_body else {},
        "headers": {
            "userAgent":   headers_dict.get("user-agent", ""),
            "contentType": headers_dict.get("content-type", ""),
            "referer":     headers_dict.get("referer", ""),
            "host":        headers_dict.get("host", ""),
        },
        "responseCode": None,
        # projectId injected by caller
    }


def _parse_dns(dns_layer) -> dict:
    """Extract DNS query/response metadata."""
    queries   = []
    responses = []

    if dns_layer.qdcount and dns_layer.qd:
        try:
            q = dns_layer.qd
            while q:
                queries.append(q.qname.decode(errors="ignore") if isinstance(q.qname, bytes) else str(q.qname))
                q = q.payload if hasattr(q, "payload") and isinstance(q.payload, DNSQR) else None
        except Exception:
            pass

    if dns_layer.ancount and dns_layer.an:
        try:
            r = dns_layer.an
            while r:
                responses.append({
                    "name":  r.rrname.decode(errors="ignore") if isinstance(r.rrname, bytes) else str(r.rrname),
                    "rdata": str(r.rdata) if hasattr(r, "rdata") else "",
                })
                r = r.payload if hasattr(r, "payload") and isinstance(r.payload, DNSRR) else None
        except Exception:
            pass

    return {
        "is_response": bool(dns_layer.qr),
        "queries":     queries,
        "responses":   responses,
        "ancount":     dns_layer.ancount,
        "qdcount":     dns_layer.qdcount,
    }
