# 05 — API Contracts — Every Live Route

> Source: `MASTER_REFERENCE.md` §5, §7, §8 · Last verified: 2026-03-28
> All Gateway routes use the standard response envelope — see [03-services.md](./03-services.md#response-envelope-standard)

---

## Gateway API (`:3000`)

```
POST /api/logs/ingest
Body: { projectId, method, url, ip, queryParams?, body?, headers?,
        responseCode?, processingTimeMs? }
⚠️  EXACT FIELDS ONLY — Joi strict mode. No userAgent, no extra fields.
Response 201: { success:true, data:{ id:ObjectId } }

GET  /api/attacks/recent?limit=50
GET  /api/attacks/:id/forensics
GET  /api/attacks/search?q=<term>&limit=20&page=1
GET  /api/attacks/search/stats

GET   /api/alerts?limit=50
PATCH /api/alerts/:id/read
POST  /api/alerts/armoriq        ← ArmorIQ executor only

GET  /api/actions/pending
POST /api/actions/:id/approve   Body: { approvedBy: string }
POST /api/actions/:id/reject    Body: { rejectedBy: string }

GET  /api/audit?limit=100
POST /api/audit/ingest          ← audit_logger.py only

POST /api/armoriq/trigger       Body: { ip?, attackType?, severity?, confidence?, status? }
POST /api/pcap/upload           multipart: field "pcap" + field "projectId"
GET  /api/stats
GET  /api/service-status
GET  /api/logs/recent?limit=50
GET  /health
```

---

## Detection Engine (`:8002`)

```
POST /analyze
Body: { logId, projectId, method, url, ip, queryParams, body, headers, responseCode }
Response: { isAttack: bool, attackType: string, confidence: float }

GET  /health
```

---

## SENTINAL Response Engine (`:8004`)

```
POST /respond
Body: { attackId, ip, attackType, severity, status, confidence }

GET  /health
Response: { openclaw_loaded: bool, enforcement: 'ArmorClaw-v1' }
```

---

## PCAP Processor (`:8003`)

```
POST /process
Body: { filepath: string, projectId: string }

GET  /health
```

---

## Demo Target (`:4000`)

```
GET  /                              health check
GET  /users                         returns demo user list
POST /login                         Body: { username, password } — intentionally vulnerable
GET  /search?q=<query>              reflects query — XSS/command injection target
GET  /file?name=<filename>          path traversal target
```

> All demo-target routes pass through `sentinel-middleware` → Gateway automatically.

---

## MongoDB Schemas — All 6 Collections

```
systemlogs:
  { projectId*, timestamp*, method, url, queryParams, body, headers,
    ip*, responseCode, processingTimeMs }

attackevents:
  { requestId*, timestamp*, ip*, attackType*, severity*, status*,
    detectedBy, confidence, payload, explanation, mitigationSuggestion }

alerts:
  { attackId*, title, message, severity, type, isRead, resolvedAt, meta }

action_queue:
  { attackId(String)*, action*, status*, agentReason, blockedReason,
    ip, approvedBy, approvedAt }

audit_log:          ← collection name is SINGULAR (not audit_logs)
  { intent_id, action, status*, triggeredBy, ip*, attackId(String),
    policy_rule_id, enforcement_level, reason, meta }

servicestatuses:
  { serviceName(unique), status, lastChecked, responseTimeMs, errorMessage }
```

`*` = indexed

> **Critical naming:** collection is `audit_log` (singular), NOT `audit_logs`.
> `attackId` in `action_queue` and `audit_log` is a plain **String**, not an ObjectId reference.
