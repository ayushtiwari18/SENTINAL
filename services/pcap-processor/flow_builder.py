"""
flow_builder.py — Reconstructs network flows from parsed packet metadata.

A "flow" is a 5-tuple:
  (src_ip, dst_ip, src_port, dst_port, protocol)

For each flow we accumulate:
  - packet_count
  - total_bytes
  - start_time / end_time / duration
  - tcp flag distribution
  - per-second packet rate
  - list of destination ports (for port-scan detection)
"""
from collections import defaultdict
from typing import List, Dict
from config import FLOW_TIMEOUT_SECONDS
from logger import get_logger

log = get_logger(__name__)


def build_flows(parsed_packets: List[dict]) -> Dict[str, dict]:
    """
    Group parsed packets into flows.
    Returns a dict keyed by flow_id string.
    """
    flows: Dict[str, dict] = {}

    for pkt in parsed_packets:
        src_ip   = pkt.get("src_ip") or "0.0.0.0"
        dst_ip   = pkt.get("dst_ip") or "0.0.0.0"
        src_port = pkt.get("src_port") or 0
        dst_port = pkt.get("dst_port") or 0
        protocol = pkt.get("protocol", "UNKNOWN")
        ts       = pkt.get("timestamp", 0.0)
        length   = pkt.get("length", 0)

        flow_id  = f"{src_ip}:{src_port}->{dst_ip}:{dst_port}/{protocol}"

        if flow_id not in flows:
            flows[flow_id] = {
                "flow_id":      flow_id,
                "src_ip":       src_ip,
                "dst_ip":       dst_ip,
                "src_port":     src_port,
                "dst_port":     dst_port,
                "protocol":     protocol,
                "packet_count": 0,
                "bytes":        0,
                "start_time":   ts,
                "end_time":     ts,
                "flags":        defaultdict(int),   # flag string -> count
                "dst_ports":    set(),              # unique destination ports touched by this src
                "http_requests": [],
                "dns_queries":   [],
                "icmp_types":    [],
            }

        flow = flows[flow_id]
        flow["packet_count"] += 1
        flow["bytes"]        += length
        flow["end_time"]      = max(flow["end_time"], ts)

        if pkt.get("flags"):
            flow["flags"][pkt["flags"]] += 1

        if dst_port:
            flow["dst_ports"].add(dst_port)

        if pkt.get("http"):
            http = dict(pkt["http"])
            http["ip"]        = src_ip
            http["timestamp"] = ts
            flow["http_requests"].append(http)

        if pkt.get("dns"):
            flow["dns_queries"].append(pkt["dns"])

        if pkt.get("icmp_type") is not None:
            flow["icmp_types"].append(pkt["icmp_type"])

    # ── Post-process ──────────────────────────────────────────────────────────
    for flow in flows.values():
        duration = flow["end_time"] - flow["start_time"]
        flow["duration"]   = round(duration, 6)
        flow["pps"]        = round(flow["packet_count"] / duration, 2) if duration > 0 else 0
        flow["bps"]        = round(flow["bytes"] / duration, 2)        if duration > 0 else 0
        flow["flags"]      = dict(flow["flags"])          # convert defaultdict -> plain dict
        flow["dst_ports"]  = list(flow["dst_ports"])      # convert set -> list

    # ── Also build src-aggregated views for scan/flood detection ──────────────
    src_view = _build_src_view(flows)
    dst_view = _build_dst_view(flows)

    log.info("Built %d flows from packet metadata", len(flows))
    return flows, src_view, dst_view


def _build_src_view(flows: Dict[str, dict]) -> Dict[str, dict]:
    """
    Aggregate by source IP:
      total packets, bytes, unique dst_ports, unique dst_ips, SYN count, etc.
    Used to detect port scans and SYN floods originating from a single host.
    """
    src: Dict[str, dict] = {}
    for flow in flows.values():
        ip = flow["src_ip"]
        if ip not in src:
            src[ip] = {
                "src_ip":       ip,
                "total_packets": 0,
                "total_bytes":   0,
                "unique_dst_ports": set(),
                "unique_dst_ips":   set(),
                "syn_count":     0,
                "syn_ack_count": 0,
                "rst_count":     0,
                "start_time":    flow["start_time"],
                "end_time":      flow["end_time"],
            }
        s = src[ip]
        s["total_packets"] += flow["packet_count"]
        s["total_bytes"]   += flow["bytes"]
        s["unique_dst_ports"].update(flow["dst_ports"])
        s["unique_dst_ips"].add(flow["dst_ip"])
        s["syn_count"]     += flow["flags"].get("SYN", 0)
        s["syn_ack_count"] += flow["flags"].get("SYN-ACK", 0)
        s["rst_count"]     += flow["flags"].get("RST", 0)
        s["start_time"]     = min(s["start_time"], flow["start_time"])
        s["end_time"]       = max(s["end_time"],   flow["end_time"])

    for s in src.values():
        s["unique_dst_ports"] = list(s["unique_dst_ports"])
        s["unique_dst_ips"]   = list(s["unique_dst_ips"])
        dur = s["end_time"] - s["start_time"]
        s["pps"] = round(s["total_packets"] / dur, 2) if dur > 0 else 0

    return src


def _build_dst_view(flows: Dict[str, dict]) -> Dict[str, dict]:
    """
    Aggregate by destination IP:
      used to detect DDoS (many sources, single victim).
    """
    dst: Dict[str, dict] = {}
    for flow in flows.values():
        ip = flow["dst_ip"]
        if ip not in dst:
            dst[ip] = {
                "dst_ip":         ip,
                "total_packets":  0,
                "total_bytes":    0,
                "unique_src_ips": set(),
                "start_time":     flow["start_time"],
                "end_time":       flow["end_time"],
            }
        d = dst[ip]
        d["total_packets"] += flow["packet_count"]
        d["total_bytes"]   += flow["bytes"]
        d["unique_src_ips"].add(flow["src_ip"])
        d["start_time"]     = min(d["start_time"], flow["start_time"])
        d["end_time"]       = max(d["end_time"],   flow["end_time"])

    for d in dst.values():
        d["unique_src_ips"] = list(d["unique_src_ips"])
        dur = d["end_time"] - d["start_time"]
        d["pps"] = round(d["total_packets"] / dur, 2) if dur > 0 else 0

    return dst
