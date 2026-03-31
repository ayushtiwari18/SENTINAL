# 03 — Services, Ports & Real-Time Events

> Source: `MASTER_REFERENCE.md` §3, §10, §11, §12 · Last verified: 2026-03-28

---

## Service Registry

| Service | Language | Port | Status | Entry Point |
|---------|----------|------|--------|-------------|
| Gateway API | Node.js + Express | 3000 | ✅ LIVE (prod) | `backend/server.js` |
| PCAP Processor | Python + FastAPI | 8003 | ✅ LIVE (prod) | `services/pcap-processor/main.py` |
| Detection Engine | Python + FastAPI | 8002 | ✅ LIVE (prod) | `services/detection-engine/app/main.py` |
| SENTINAL Response Engine | Python + FastAPI | 8004 | ✅ LIVE (prod) | `services/sentinal-response-engine/main.py` |
| React Dashboard | Vite + React | 5173 | ✅ LIVE (prod) | `dashboard/src/main.jsx` |
| sentinel-middleware | Node.js npm pkg | — | ✅ WORKING | `services/middleware/src/index.js` |
| Demo Target | Node.js + Express | 4000 | ✅ WORKING | `demo-target/server.js` |
| MongoDB Atlas | Cloud (SRV) | — | ✅ LIVE (prod) | `backend/src/config/database.js` |

---

## Port & URL Map

### Local Development

| Service | Port | Start Command |
|---------|------|---------------|
| Gateway | 3000 | `cd backend && npm run dev` |
| Detection Engine | 8002 | `cd services/detection-engine && source .venv/bin/activate && uvicorn app.main:app --port 8002` |
| PCAP Processor | 8003 | `cd services/pcap-processor && source .venv/bin/activate && uvicorn main:app --port 8003` |
| SENTINAL Response Engine | 8004 | `cd services/sentinal-response-engine && source .venv/bin/activate && uvicorn main:app --port 8004` |
| Dashboard | 5173 | `cd dashboard && npm run dev` |
| Demo Target | 4000 | `cd demo-target && node server.js` |

### Production (AWS EC2)

| Service | Port | URL Pattern |
|---------|------|-------------|
| Gateway | 3000 | `http://<CURRENT_EC2_IP>:3000` |
| Detection Engine | 8002 | `http://<CURRENT_EC2_IP>:8002` |
| PCAP Processor | 8003 | `http://<CURRENT_EC2_IP>:8003` |
| SENTINAL Response Engine | 8004 | `http://<CURRENT_EC2_IP>:8004` |
| Dashboard | 5173 | `http://<CURRENT_EC2_IP>:5173` |

> ⚠️ **IP changes every AWS Academy session.** `deploy.sh` auto-detects and sets it.
> Always run `deploy.sh` on a fresh session — **never hardcode the IP anywhere in code.**

---

## PM2 Process Names

| PM2 Name | Service |
|----------|---------|
| `sentinal-gateway` | Gateway API (Node :3000) |
| `sentinal-detection` | Detection Engine (Python :8002) |
| `sentinal-pcap` | PCAP Processor (Python :8003) |
| `sentinal-armoriq` | SENTINAL Response Engine (Python :8004) |
| `sentinal-dashboard` | React Dashboard (Vite :5173) |

---

## Socket.io Events Reference

| Event | Emitted by | Payload |
|-------|------------|---------|
| `attack:new` | attackService | `{ id, ip, attackType, severity, status, detectedBy, confidence, timestamp }` |
| `alert:new` | attackService | `{ id, title, severity, type, timestamp }` |
| `action:pending` | actionQueueController | `{ id, action, agentReason, blockedReason, ip, attackId }` |
| `audit:new` | auditController | `{ id, action, status, reason, policy_rule_id, triggeredBy, ip, attackId, timestamp }` |
| `service:status` | serviceHealthService | `{ serviceName, status, responseTimeMs, timestamp }` |
| `stats:update` | statsService | stats payload |

> `SimulateAttack.jsx` subscribes to `attack:new` and `action:pending` directly — live detections appear in the right panel of `/simulate` as soon as the backend processes them.

---

## Response Envelope Standard

All Gateway API responses follow this structure:

```js
// Success
{ success: true, message: string, data: object | array }

// Error
{ success: false, message: string, code: string }
// code: 'NOT_FOUND' | 'SERVER_ERROR' | 'VALIDATION_ERROR'
```

> `api.js` unwraps with `res => res.data.data`.
> Arrays come as `{ data: [] }` — use `r.data.length` not `r.length`.
