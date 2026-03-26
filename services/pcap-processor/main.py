"""
main.py — FastAPI entry point for SENTINAL PCAP Processor Service.

Endpoints:
  GET  /health          — liveness probe
  POST /process         — process a PCAP file and return detection results
  GET  /stats/{file}    — return processing statistics for a given file path

Architecture (request flow):
  POST /process
      └─► pcap_loader.load_pcap()          # load & validate file
      └─► packet_parser.parse_packets()    # parse all packets
      └─► flow_builder.build_flows()       # group into flows (+ src/dst aggregates)
      └─► attack_detector.run_detections() # local rule-based detection
      └─► attack_detector.extract_http_for_engine()  # HTTP reqs for remote engine
      └─► _forward_to_engine()             # async batch forward to Detection Engine
      └─► return ProcessResponse
"""
import asyncio
import os
import time
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from config import ANALYZE_ENDPOINT, BATCH_SIZE, HTTP_TIMEOUT
from pcap_loader import load_pcap
from packet_parser import parse_packets
from flow_builder import build_flows
from attack_detector import run_detections, extract_http_for_engine
from logger import get_logger

log = get_logger(__name__)

app = FastAPI(
    title="SENTINAL PCAP Processor",
    version="2.0.0",
    description="Standalone PCAP ingestion and multi-protocol attack detection microservice.",
)


# ── Request / Response schemas ─────────────────────────────────────────────────

class ProcessRequest(BaseModel):
    filepath:  str
    projectId: str = "pcap-upload"


class AttackEvent(BaseModel):
    attack_type: str
    severity:    str
    src_ip:      Optional[str] = ""
    dst_ip:      Optional[str] = ""
    description: str
    evidence:    dict = {}


class ProcessResponse(BaseModel):
    filepath:           str
    total_packets:      int
    parsed_packets:     int
    total_flows:        int
    http_requests_sent: int
    local_attacks:      List[AttackEvent]
    engine_attacks:     List[dict]
    skipped_engine:     int
    processing_time_s:  float


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "service": "pcap-processor", "version": "2.0.0"}


@app.post("/process", response_model=ProcessResponse)
async def process_pcap(req: ProcessRequest):
    t_start = time.perf_counter()
    log.info("=== /process request: filepath=%s projectId=%s ===", req.filepath, req.projectId)

    # 1. Load
    try:
        packets = load_pcap(req.filepath)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    total_packets = len(packets)

    # 2. Parse
    parsed = parse_packets(packets)

    if not parsed:
        return ProcessResponse(
            filepath=req.filepath,
            total_packets=total_packets,
            parsed_packets=0,
            total_flows=0,
            http_requests_sent=0,
            local_attacks=[],
            engine_attacks=[],
            skipped_engine=0,
            processing_time_s=round(time.perf_counter() - t_start, 3),
        )

    # 3. Build flows
    flows, src_view, dst_view = build_flows(parsed)

    # 4. Local rule-based detection
    local_detections = run_detections(flows, src_view, dst_view)
    local_attacks    = [AttackEvent(**d.to_dict()) for d in local_detections]

    # 5. Forward HTTP requests to Detection Engine
    http_requests   = extract_http_for_engine(flows, req.projectId)
    engine_attacks  = []
    skipped_engine  = 0

    if http_requests:
        engine_attacks, skipped_engine = await _forward_to_engine(http_requests)

    processing_time = round(time.perf_counter() - t_start, 3)
    log.info(
        "=== Done: packets=%d parsed=%d flows=%d local_attacks=%d engine_attacks=%d time=%.3fs ===",
        total_packets, len(parsed), len(flows),
        len(local_attacks), len(engine_attacks), processing_time
    )

    return ProcessResponse(
        filepath=req.filepath,
        total_packets=total_packets,
        parsed_packets=len(parsed),
        total_flows=len(flows),
        http_requests_sent=len(http_requests),
        local_attacks=local_attacks,
        engine_attacks=engine_attacks,
        skipped_engine=skipped_engine,
        processing_time_s=processing_time,
    )


# ── Internal helpers ───────────────────────────────────────────────────────────

async def _forward_to_engine(http_requests: list) -> tuple[list, int]:
    """Batch-forward HTTP requests to Detection Engine and collect attack results."""
    attacks = []
    skipped = 0

    async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
        for i in range(0, len(http_requests), BATCH_SIZE):
            batch   = http_requests[i: i + BATCH_SIZE]
            tasks   = [_call_engine(client, r) for r in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for j, result in enumerate(results):
                if isinstance(result, Exception):
                    skipped += 1
                    log.debug("Engine call failed: %s", result)
                    continue
                if result and result.get("threat_detected"):
                    result["ip"]  = batch[j].get("ip")
                    result["url"] = batch[j].get("url")
                    attacks.append(result)

    log.info("Engine returned %d attack signals (%d skipped)", len(attacks), skipped)
    return attacks, skipped


async def _call_engine(client: httpx.AsyncClient, req: dict) -> Optional[dict]:
    try:
        resp = await client.post(ANALYZE_ENDPOINT, json=req)
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        raise exc
    return None


# ── Dev runner ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    from config import SERVICE_HOST, SERVICE_PORT
    uvicorn.run("main:app", host=SERVICE_HOST, port=SERVICE_PORT, reload=False)
