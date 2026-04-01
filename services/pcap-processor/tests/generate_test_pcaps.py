#!/usr/bin/env python3
"""
tests/generate_test_pcaps.py

Generates deterministic synthetic PCAP files for unit/integration testing.
No external network required — all packets crafted with Scapy.

Files generated in tests/fixtures/:
  normal_traffic.pcap     — clean HTTP + DNS traffic
  port_scan.pcap          — Nmap-style SYN scan of 30 ports from single IP
  syn_flood.pcap          — 500 SYN packets/second from single source
  ddos.pcap               — 10 sources flooding a single victim at high pps
  icmp_flood.pcap         — ICMP echo storm
  dns_amplification.pcap  — DNS responses much larger than queries
  sqli_http.pcap          — HTTP GET with SQL injection payload
  xss_http.pcap           — HTTP GET with XSS payload
  malformed.pcap          — truncated / malformed packets

Usage:
    python tests/generate_test_pcaps.py
"""
import os
import time
from pathlib import Path

from scapy.all import (
    Ether, IP, IPv6, TCP, UDP, ICMP, DNS, DNSQR, DNSRR, Raw,
    wrpcap, RandMAC
)

FIXTURES = Path(__file__).parent / "fixtures"
FIXTURES.mkdir(parents=True, exist_ok=True)

BASE_TIME = 1700000000.0  # fixed epoch for reproducibility


def _pkt(src, dst, sport, dport, proto="tcp", flags="S", payload=b"", ts_offset=0.0):
    """Helper: craft a packet with explicit timestamp."""
    ip = IP(src=src, dst=dst)
    if proto == "tcp":
        layer4 = TCP(sport=sport, dport=dport, flags=flags)
    elif proto == "udp":
        layer4 = UDP(sport=sport, dport=dport)
    elif proto == "icmp":
        layer4 = ICMP()
    else:
        layer4 = TCP(sport=sport, dport=dport)

    pkt = ip / layer4
    if payload:
        pkt = pkt / Raw(load=payload)
    pkt.time = BASE_TIME + ts_offset
    return pkt


def gen_normal_traffic():
    pkts = []
    # HTTP GET
    http_req = b"GET /index.html HTTP/1.1\r\nHost: example.com\r\nUser-Agent: Mozilla/5.0\r\n\r\n"
    for i in range(5):
        pkts.append(_pkt("10.0.0.1", "93.184.216.34", 54321, 80, "tcp", "PA", http_req, ts_offset=float(i)))
    # DNS query
    dns_q = DNS(rd=1, qd=DNSQR(qname="example.com"))
    pkt = IP(src="10.0.0.1", dst="8.8.8.8") / UDP(sport=5300, dport=53) / dns_q
    pkt.time = BASE_TIME + 10
    pkts.append(pkt)
    wrpcap(str(FIXTURES / "normal_traffic.pcap"), pkts)
    print("  Generated normal_traffic.pcap")


def gen_port_scan():
    pkts = []
    attacker = "192.168.1.100"
    victim   = "10.0.0.5"
    for i, port in enumerate(range(1, 31)):
        pkts.append(_pkt(attacker, victim, 60000 + i, port, "tcp", "S", ts_offset=float(i) * 0.05))
    wrpcap(str(FIXTURES / "port_scan.pcap"), pkts)
    print("  Generated port_scan.pcap")


def gen_syn_flood():
    pkts = []
    attacker = "203.0.113.1"
    victim   = "10.0.0.10"
    for i in range(200):
        # 200 SYN packets in 1 second = 200 SYN/s (above default threshold of 100)
        pkts.append(_pkt(attacker, victim, 10000 + (i % 65000), 80, "tcp", "S", ts_offset=float(i) / 200))
    wrpcap(str(FIXTURES / "syn_flood.pcap"), pkts)
    print("  Generated syn_flood.pcap")


def gen_ddos():
    pkts = []
    victim = "10.0.0.20"
    for src_idx in range(10):  # 10 sources
        src_ip = f"198.51.100.{src_idx + 1}"
        for i in range(60):   # 60 packets each = 600 total in 1s → 600 pps > threshold
            pkts.append(_pkt(src_ip, victim, 20000 + i, 80, "tcp", "S", ts_offset=float(i) / 60))
    wrpcap(str(FIXTURES / "ddos.pcap"), pkts)
    print("  Generated ddos.pcap")


def gen_icmp_flood():
    pkts = []
    attacker = "172.16.0.1"
    victim   = "10.0.0.30"
    for i in range(100):  # 100 ICMP in 1s = 100 pps > threshold of 50
        pkt = IP(src=attacker, dst=victim) / ICMP()
        pkt.time = BASE_TIME + float(i) / 100
        pkts.append(pkt)
    wrpcap(str(FIXTURES / "icmp_flood.pcap"), pkts)
    print("  Generated icmp_flood.pcap")


def gen_dns_amplification():
    pkts = []
    attacker = "10.0.0.1"
    resolver = "8.8.8.8"
    victim   = "10.0.0.50"  # spoofed source = victim
    # 1 query, 6 large answers (ratio 6 > threshold 5)
    dns_q = DNS(rd=1, qd=DNSQR(qname="big.example.com"))
    pkt_q = IP(src=victim, dst=resolver) / UDP(sport=5301, dport=53) / dns_q
    pkt_q.time = BASE_TIME
    pkts.append(pkt_q)

    # Fake large DNS response
    dns_r = DNS(
        qr=1, ancount=6, qdcount=1,
        qd=DNSQR(qname="big.example.com"),
        an=(
            DNSRR(rrname="big.example.com", rdata="1.2.3.4") /
            DNSRR(rrname="big.example.com", rdata="1.2.3.5") /
            DNSRR(rrname="big.example.com", rdata="1.2.3.6") /
            DNSRR(rrname="big.example.com", rdata="1.2.3.7") /
            DNSRR(rrname="big.example.com", rdata="1.2.3.8") /
            DNSRR(rrname="big.example.com", rdata="1.2.3.9")
        ),
    )
    pkt_r = IP(src=resolver, dst=victim) / UDP(sport=53, dport=5301) / dns_r
    pkt_r.time = BASE_TIME + 0.01
    pkts.append(pkt_r)

    wrpcap(str(FIXTURES / "dns_amplification.pcap"), pkts)
    print("  Generated dns_amplification.pcap")


def gen_sqli_http():
    payload = b"GET /search?q=1+OR+1%3D1+--+&page=1 HTTP/1.1\r\nHost: vuln.example.com\r\n\r\n"
    pkt = _pkt("192.168.1.200", "10.0.0.80", 55555, 80, "tcp", "PA", payload)
    wrpcap(str(FIXTURES / "sqli_http.pcap"), [pkt])
    print("  Generated sqli_http.pcap")


def gen_xss_http():
    payload = b"GET /comment?msg=%3Cscript%3Ealert(1)%3C%2Fscript%3E HTTP/1.1\r\nHost: vuln.example.com\r\n\r\n"
    pkt = _pkt("192.168.1.201", "10.0.0.80", 55556, 80, "tcp", "PA", payload)
    wrpcap(str(FIXTURES / "xss_http.pcap"), [pkt])
    print("  Generated xss_http.pcap")


def gen_malformed():
    # Intentionally short / incomplete packets
    pkts = [
        IP(src="1.2.3.4", dst="5.6.7.8"),           # no transport layer
        IP(src="1.2.3.4") / TCP(),                   # no dst
        Raw(load=b"\x00\x01\x02GARBAGE"),            # not a real packet
    ]
    for p in pkts:
        p.time = BASE_TIME
    wrpcap(str(FIXTURES / "malformed.pcap"), pkts)
    print("  Generated malformed.pcap")


def main():
    print(f"Generating test fixtures in {FIXTURES}\n")
    gen_normal_traffic()
    gen_port_scan()
    gen_syn_flood()
    gen_ddos()
    gen_icmp_flood()
    gen_dns_amplification()
    gen_sqli_http()
    gen_xss_http()
    gen_malformed()
    print("\nAll fixtures generated.")


if __name__ == "__main__":
    main()
