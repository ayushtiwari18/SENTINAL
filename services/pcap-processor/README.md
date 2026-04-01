# SENTINAL — PCAP Processor Service

Standalone microservice that ingests `.pcap` / `.pcapng` network capture files,
parses every packet, reconstructs flows, and runs rule-based attack detection —
independent of the Nexus backend and frontend.

## Architecture

```
POST /process
    └─► pcap_loader.py        Load & validate file (size, format, existence)
    └─► packet_parser.py      Parse all packets (TCP/UDP/ICMP/DNS/HTTP/IPv6)
    └─► flow_builder.py       Reconstruct flows + src/dst aggregation views
    └─► attack_detector.py    Rule-based detection (8 attack types)
    └─► main.py               Batch-forward HTTP requests to Detection Engine
    └─► ProcessResponse       Return unified result
```

## Detected Attack Types

| Attack | Layer | Detection Method |
|---|---|---|
| PORT_SCAN | Network | Single source → ≥15 unique dst ports |
| SYN_FLOOD | Transport | SYN rate ≥100/s from single source |
| DDOS | Network | ≥500 pps to single dst from ≥3 sources |
| ICMP_FLOOD | Network | ICMP rate ≥50/s from single source |
| DNS_AMPLIFICATION | App | Response/query answer ratio ≥5.0 |
| SQL_INJECTION | App | SQL keyword regex in HTTP params/body |
| XSS | App | Script tag / JS event regex in HTTP params |
| BRUTE_FORCE | App | ≥10 POST requests to login-like endpoints |

All thresholds are configurable via environment variables.

## Quick Start

```bash
cd services/pcap-processor
pip install -r requirements.txt

# Generate test fixtures
python tests/generate_test_pcaps.py

# Run all tests
python tests/test_pcap_processor.py

# Start service
python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

## Environment Variables

Copy `.env.example` to `.env` and adjust:

```
DETECTION_ENGINE_URL=http://localhost:8002
PORT=8003
MAX_PCAP_SIZE_MB=500
PORT_SCAN_THRESHOLD=15
SYN_FLOOD_PPS_THRESHOLD=100
DDOS_PPS_THRESHOLD=500
DNS_AMP_RATIO_THRESHOLD=5.0
ICMP_FLOOD_PPS_THRESHOLD=50
BRUTE_FORCE_THRESHOLD=10
```

## API

### `GET /health`
```json
{"status": "ok", "service": "pcap-processor", "version": "2.0.0"}
```

### `POST /process`
**Body:**
```json
{
  "filepath": "/path/to/capture.pcap",
  "projectId": "my-project"
}
```

**Response:**
```json
{
  "filepath": "/path/to/capture.pcap",
  "total_packets": 10000,
  "parsed_packets": 9850,
  "total_flows": 342,
  "http_requests_sent": 88,
  "local_attacks": [
    {
      "attack_type": "PORT_SCAN",
      "severity": "HIGH",
      "src_ip": "192.168.1.100",
      "dst_ip": "",
      "description": "Source 192.168.1.100 contacted 28 unique destination ports",
      "evidence": {"unique_dst_ports": 28, "sample_ports": [22, 80, 443]}
    }
  ],
  "engine_attacks": [],
  "skipped_engine": 0,
  "processing_time_s": 1.234
}
```

## Downloading Real Datasets

```bash
python datasets/download_datasets.py
```

Downloads Wireshark sample captures, DNS samples, and Nmap scan captures
into `datasets/samples/`.

## File Structure

```
services/pcap-processor/
├── main.py               FastAPI app + /process endpoint
├── config.py             All configuration / env vars
├── pcap_loader.py        PCAP file loader & validator
├── packet_parser.py      Multi-protocol packet parser
├── flow_builder.py       Flow reconstruction + aggregation
├── attack_detector.py    Rule-based detection (8 types)
├── logger.py             Structured logging setup
├── requirements.txt
├── .env.example
├── datasets/
│   ├── download_datasets.py
│   └── samples/          (auto-created by download script)
├── tests/
│   ├── generate_test_pcaps.py
│   ├── test_pcap_processor.py
│   └── fixtures/         (auto-created by generate script)
└── logs/                 (auto-created at runtime)
```
