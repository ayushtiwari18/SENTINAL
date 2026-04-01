# API Reference

> **Last updated:** 2026-03-31  
> **Base URL:** `http://localhost:3000` (dev) | `https://your-domain.com` (prod)  
> **Auth:** JWT Bearer token — `Authorization: Bearer <token>` (unless marked public)  
> **Content-Type:** `application/json`

---

## Quick Index

| Prefix | Domain | File |
|--------|--------|------|
| `GET /api/health` | Health check | `routes/health.js` |
| `/api/logs` | Request logs | `routes/logs.js` |
| `/api/attacks` | Attack events | `routes/attacks.js` |
| `/api/alerts` | Alerts | `routes/alerts.js` |
| `/api/Nexus` | Nexus AI agent | `routes/Nexus.js` |
| `/api/pcap` | PCAP / forensics upload | `routes/pcap.js` |
| `/api/gemini` | Direct Gemini AI | `routes/gemini.js` |
| `/api/actions` | Response actions | `routes/actions.js` |
| `/api/audit` | Audit log | `routes/audit.js` |
| `/api/forensics` | Forensics reports | `routes/forensics.js` |
| `/api/stats` | Dashboard statistics | `routes/stats.js` |
| `/api/services/status` | Microservice health | `routes/serviceStatus.js` |

---

## Health

### `GET /api/health` 🟢 Public
Returns backend liveness status.

**Response 200**
```json
{ "status": "ok", "uptime": 3600, "timestamp": "2026-03-31T11:00:00Z" }
```

---

## Logs — `/api/logs`

### `POST /api/logs` — Ingest a request log
Called by the SDK snippet embedded in the target app. This is the **primary ingest endpoint** — triggers detection pipeline.

**Request Body**
```json
{
  "projectId": "proj_abc123",
  "method": "GET",
  "url": "/search?q=1' OR 1=1--",
  "ip": "203.0.113.42",
  "headers": { "user-agent": "Mozilla/5.0" },
  "queryParams": { "q": "1' OR 1=1--" },
  "body": {},
  "responseCode": 200
}
```

**Response 201**
```json
{
  "logId": "log_xyz789",
  "isAttack": true,
  "attackType": "sqli",
  "confidence": 0.97,
  "llm_explanation": {
    "explanation": "Classic SQL injection via OR tautology.",
    "impact": "Full database read access possible.",
    "fix": "Use parameterised queries."
  }
}
```

**Response 400** — missing required fields  
**Response 503** — detection engine unreachable (circuit open)

---

### `GET /api/logs` — List logs

**Query Params**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `projectId` | string | — | Filter by project |
| `page` | number | 1 | Pagination |
| `limit` | number | 50 | Results per page |
| `from` | ISO date | — | Start date filter |
| `to` | ISO date | — | End date filter |

**Response 200**
```json
{
  "logs": [ { "_id": "...", "url": "...", "method": "GET", "isAttack": false, "createdAt": "..." } ],
  "total": 1240,
  "page": 1,
  "pages": 25
}
```

---

## Attacks — `/api/attacks`

### `GET /api/attacks` — List attack events

**Query Params**
| Param | Type | Description |
|-------|------|-------------|
| `projectId` | string | Filter by project |
| `type` | string | `sqli` \| `xss` \| `lfi` \| `ssrf` \| `cmdi` \| `unknown` |
| `page` | number | Pagination |
| `limit` | number | Results per page |

**Response 200**
```json
{
  "attacks": [
    {
      "_id": "atk_001",
      "logId": "log_xyz789",
      "projectId": "proj_abc123",
      "attackType": "sqli",
      "confidence": 0.97,
      "ip": "203.0.113.42",
      "url": "/search?q=1' OR 1=1--",
      "llm_explanation": { "explanation": "...", "impact": "...", "fix": "..." },
      "createdAt": "2026-03-31T11:00:00Z"
    }
  ],
  "total": 34
}
```

### `GET /api/attacks/:id` — Get single attack detail

**Response 200** — Full attack object  
**Response 404** — Attack not found

---

## Alerts — `/api/alerts`

### `GET /api/alerts` — List alerts

**Response 200**
```json
{ "alerts": [ { "_id": "...", "severity": "high", "message": "...", "resolved": false } ] }
```

### `PATCH /api/alerts/:id/resolve` — Mark alert resolved

**Response 200** `{ "success": true }`

---

## Nexus Agent — `/api/Nexus`

Proxy layer to `services/Nexus-agent` on port 8004.

### `POST /api/Nexus/chat` — AI security chat
Send a natural-language security question; receive an AI-powered answer.

**Request Body**
```json
{
  "message": "Why is my app getting SQLi attacks from 203.0.113.42?",
  "projectId": "proj_abc123",
  "context": { "recentAttacks": 12, "topType": "sqli" }
}
```

**Response 200**
```json
{
  "response": "The IP 203.0.113.42 has sent 12 SQLi probes...",
  "context": { "attacksReferenced": 12 }
}
```

### `POST /api/Nexus/analyze-attack` — Analyze specific attack

**Request Body**
```json
{ "attackId": "atk_001" }
```

**Response 200**
```json
{
  "analysis": "Detailed attack breakdown...",
  "recommendations": ["Deploy WAF rule...", "Patch parameter..."]
}
```

### `POST /api/Nexus/generate-response` — Generate incident response plan

**Request Body**
```json
{ "attackId": "atk_001", "severity": "critical" }
```

**Response 200**
```json
{ "plan": "Step 1: Isolate endpoint...", "steps": [...] }
```

### `GET /api/Nexus/blocklist` — Get current IP blocklist

**Response 200** `{ "blocked": ["203.0.113.42", "198.51.100.0/24"] }`

### `POST /api/Nexus/blocklist` — Add IP to blocklist

**Request Body** `{ "ip": "203.0.113.42", "reason": "SQLi probe" }`  
**Response 201** `{ "success": true }`

---

## PCAP Processor — `/api/pcap`

Proxy layer to `services/pcap-processor` on port 8003.

### `POST /api/pcap/upload` — Upload PCAP file for analysis

**Content-Type:** `multipart/form-data`

**Form Fields**
| Field | Type | Description |
|-------|------|-------------|
| `file` | binary | `.pcap` or `.pcapng` file |
| `projectId` | string | Associated project |

**Response 200**
```json
{
  "reportId": "pcap_rpt_001",
  "summary": {
    "totalPackets": 45230,
    "anomalies": 3,
    "protocols": { "TCP": 38000, "UDP": 7000, "ICMP": 230 }
  },
  "anomalies": [
    { "type": "port_scan", "sourceIp": "10.0.0.5", "severity": "medium" }
  ]
}
```

### `GET /api/pcap/reports` — List PCAP analysis reports

**Response 200** `{ "reports": [...] }`

### `GET /api/pcap/reports/:reportId` — Get full report

**Response 200** — Full forensics report object

### `POST /api/pcap/analyze-live` — Trigger live packet capture (if supported)

**Request Body** `{ "interfaceName": "eth0", "duration": 30 }`  
**Response 202** `{ "jobId": "cap_job_001", "status": "running" }`

---

## Gemini (Direct) — `/api/gemini`

Direct Gemini Flash calls from backend — no microservice hop.

### `POST /api/gemini/analyze-attack` — Explain an attack

**Request Body**
```json
{
  "attackType": "xss",
  "url": "/comment?text=<script>alert(1)</script>",
  "payload": "<script>alert(1)</script>"
}
```

**Response 200**
```json
{
  "explanation": "Reflected XSS via unsanitized query parameter...",
  "impact": "Session hijacking, credential theft...",
  "mitigation": "Encode output with htmlspecialchars()..."
}
```

### `POST /api/gemini/security-advice` — General security query

**Request Body** `{ "question": "How do I prevent SSRF in Node.js?" }`  
**Response 200** `{ "advice": "Validate and whitelist outbound URLs..." }`

### `POST /api/gemini/generate-report` — Generate full incident report

**Request Body** `{ "attackIds": ["atk_001", "atk_002"], "format": "markdown" }`  
**Response 200** `{ "report": "# Incident Report\n..." }`

---

## Response Actions — `/api/actions`

### `GET /api/actions` — List all response actions taken

**Response 200**
```json
{
  "actions": [
    {
      "_id": "act_001",
      "type": "BLOCK_IP",
      "target": "203.0.113.42",
      "triggeredBy": "atk_001",
      "status": "executed",
      "createdAt": "..."
    }
  ]
}
```

### `POST /api/actions/manual` — Trigger a manual response action

**Request Body**
```json
{
  "type": "BLOCK_IP",
  "target": "203.0.113.42",
  "attackId": "atk_001",
  "reason": "Manual block by admin"
}
```

**Response 201** `{ "actionId": "act_002", "status": "executed" }`

---

## Audit Log — `/api/audit`

### `GET /api/audit` — List audit log entries
All automated and manual response actions are logged here.

**Response 200**
```json
{
  "entries": [
    {
      "_id": "...",
      "action": "BLOCK_IP",
      "target": "203.0.113.42",
      "source": "runtime",
      "timestamp": "..."
    }
  ]
}
```

---

## Forensics — `/api/forensics`

### `GET /api/forensics` — List forensics reports

**Response 200** `{ "reports": [...] }`

---

## Stats — `/api/stats`

### `GET /api/stats` — Dashboard statistics

**Response 200**
```json
{
  "totalLogs": 45230,
  "totalAttacks": 342,
  "attacksByType": { "sqli": 180, "xss": 95, "lfi": 40, "ssrf": 15, "cmdi": 12 },
  "attacksLast24h": 28,
  "topAttackerIps": [{ "ip": "203.0.113.42", "count": 45 }],
  "detectionRate": 0.98
}
```

---

## Service Status — `/api/services/status`

### `GET /api/services/status` — Health of all Python microservices

**Response 200**
```json
{
  "services": {
    "detection-engine":          { "status": "up", "port": 8002, "latency": 12 },
    "pcap-processor":            { "status": "up", "port": 8003, "latency": 8 },
    "Nexus-agent":             { "status": "up", "port": 8004, "latency": 20 },
    "sentinal-response-engine":  { "status": "up", "port": 8005, "latency": 15 }
  }
}
```

---

## Detection Engine — Internal API `:8002`

> Called **internally** by `backend/src/services/detectionConnector.js`.  
> Not exposed publicly.

### `POST /analyze` — Analyze a request for attacks

**Request Body** (sent by detectionConnector)
```json
{
  "url": "/search?q=1' OR 1=1--",
  "method": "GET",
  "responseCode": 200,
  "logId": "log_xyz789",
  "projectId": "proj_abc123",
  "ip": "203.0.113.42",
  "queryParams": { "q": "1' OR 1=1--" },
  "body": {},
  "headers": { "user-agent": "Mozilla/5.0" }
}
```

**Response 200**
```json
{
  "isAttack": true,
  "attackType": "sqli",
  "confidence": 0.97,
  "rule_flag": true,
  "ml_prob": 0.97,
  "llm_explanation": {
    "explanation": "Classic SQL injection via OR tautology.",
    "impact": "Full database read access possible.",
    "fix": "Use parameterised queries."
  }
}
```

### `GET /health` — Detection engine liveness

**Response 200** `{ "status": "ok", "model": "sentinel_v5", "version": "5.0" }`

---

## Sentinal Response Engine — Internal API `:8005`

> Called **internally** by backend when attack confidence exceeds threshold.

### `POST /respond` — Trigger autonomous response

**Request Body**
```json
{
  "attackId": "atk_001",
  "attackType": "sqli",
  "confidence": 0.97,
  "ip": "203.0.113.42",
  "projectId": "proj_abc123",
  "context": { "url": "...", "method": "GET" }
}
```

**Response 200**
```json
{
  "action": "BLOCK_IP",
  "target": "203.0.113.42",
  "status": "executed",
  "auditId": "aud_001",
  "explanation": "IP blocked due to high-confidence SQLi attack."
}
```

### `GET /health` — Response engine liveness

**Response 200** `{ "status": "ok" }`

---

## Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": true,
  "code": "VALIDATION_ERROR",
  "message": "projectId is required",
  "details": { "field": "projectId" }
}
```

| HTTP Code | Meaning |
|-----------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Downstream microservice unavailable |

---

## Socket.IO Events

Connect to `ws://localhost:3000` with JWT in handshake auth.

```js
const socket = io('http://localhost:3000', {
  auth: { token: '<JWT>' }
});
```

| Event | Direction | Payload |
|-------|-----------|--------|
| `new-log` | Server → Client | `{ logId, url, method, isAttack }` |
| `new-attack` | Server → Client | Full attack object |
| `new-alert` | Server → Client | Alert object |
| `response-action` | Server → Client | `{ action, target, status }` |
| `service-status` | Server → Client | Service health map |
| `subscribe-project` | Client → Server | `{ projectId }` — join project room |

---

→ Architecture overview: [01-architecture.md](./01-architecture.md)  
→ Deployment: [06-deployment-aws.md](./06-deployment-aws.md)
