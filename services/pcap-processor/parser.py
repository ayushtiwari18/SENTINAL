import urllib.parse
from scapy.all import rdpcap, TCP, Raw, IP


def parse_http_from_pcap(filepath: str) -> list[dict]:
    """
    Read a .pcap file and extract every HTTP request as a plain dict.
    Returns a list of dicts compatible with the Detection Engine /analyze schema.
    """
    packets = rdpcap(filepath)
    requests = []

    for pkt in packets:
        if not (TCP in pkt and Raw in pkt):
            continue

        try:
            payload = pkt[Raw].load.decode("utf-8", errors="ignore")
        except Exception:
            continue

        # Split on real CRLF or LF
        lines = payload.split("\r\n") if "\r\n" in payload else payload.split("\n")
        first_line = lines[0]
        parts = first_line.split(" ")

        if len(parts) < 2 or parts[0] not in ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"):
            continue

        method = parts[0]
        # Join everything between method and protocol version to handle spaces in URLs/params
        # e.g. "GET /login?id=1 OR 1=1-- HTTP/1.1" -> url = "/login?id=1 OR 1=1--"
        if len(parts) >= 3 and parts[-1].startswith("HTTP/"):
            raw_url = " ".join(parts[1:-1])
        else:
            raw_url = " ".join(parts[1:])

        # Parse query params from URL
        parsed = urllib.parse.urlparse(raw_url)
        query_params = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))

        # Parse headers
        headers_dict = {}
        body_start = 0
        for i, line in enumerate(lines[1:], start=1):
            if line.strip() == "":
                body_start = i + 1
                break
            if ":" in line:
                k, _, v = line.partition(":")
                headers_dict[k.strip().lower()] = v.strip()

        raw_body = "\n".join(lines[body_start:]).strip() if body_start else ""

        src_ip = pkt[IP].src if IP in pkt else "0.0.0.0"

        requests.append({
            "projectId":   "pcap-upload",
            "method":      method,
            "url":         raw_url,
            "ip":          src_ip,
            "queryParams": query_params,
            "body":        {"raw": raw_body} if raw_body else {},
            "headers": {
                "userAgent":   headers_dict.get("user-agent", ""),
                "contentType": headers_dict.get("content-type", ""),
                "referer":     headers_dict.get("referer", ""),
            },
            "responseCode": None,
            "timestamp":    float(pkt.time),
        })

    return requests
