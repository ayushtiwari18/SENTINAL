import os
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv
from parser import parse_http_from_pcap

load_dotenv()

DETECTION_URL = os.getenv("DETECTION_ENGINE_URL", "http://localhost:8002")
ANALYZE_ENDPOINT = f"{DETECTION_URL}/analyze"

app = FastAPI(title="SENTINAL PCAP Processor", version="1.0.0")


class ProcessRequest(BaseModel):
    filepath: str
    projectId: str = "pcap-upload"


class ProcessResponse(BaseModel):
    analyzed:      int
    attacks_found: int
    attacks:       list[dict]
    skipped:       int


@app.get("/health")
def health():
    return {"status": "ok", "service": "pcap-processor"}


@app.post("/process", response_model=ProcessResponse)
async def process_pcap(req: ProcessRequest):
    if not os.path.exists(req.filepath):
        raise HTTPException(status_code=404, detail=f"File not found: {req.filepath}")

    try:
        http_requests = parse_http_from_pcap(req.filepath)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PCAP parse error: {str(e)}")

    if not http_requests:
        return ProcessResponse(analyzed=0, attacks_found=0, attacks=[], skipped=0)

    attacks = []
    skipped = 0
    BATCH = 20

    async with httpx.AsyncClient(timeout=10.0) as client:
        for batch_start in range(0, len(http_requests), BATCH):
            batch = http_requests[batch_start: batch_start + BATCH]
            tasks = [_analyze(client, r) for r in batch]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    skipped += 1
                    continue
                # Detection Engine returns threat_detected, NOT isAttack
                if result and result.get("threat_detected"):
                    result["ip"]  = batch[i]["ip"]
                    result["url"] = batch[i]["url"]
                    attacks.append(result)

    return ProcessResponse(
        analyzed=len(http_requests),
        attacks_found=len(attacks),
        attacks=attacks,
        skipped=skipped,
    )


async def _analyze(client: httpx.AsyncClient, req: dict) -> dict | None:
    try:
        resp = await client.post(ANALYZE_ENDPOINT, json=req)
        if resp.status_code == 200:
            return resp.json()
    except Exception:
        pass
    return None
