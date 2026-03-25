# SENTINAL — API Contract Reference

> This document is the single source of truth for the frontend.
> Every field name, enum value, and response shape is verified against the actual backend code.
> If backend changes a field, update this document AND the frontend simultaneously.

**Gateway base URL**: `http://localhost:3000`
**All responses**: `{ success: boolean, message: string, data: any }`
**Always read**: `response.data.data` (the inner `data`, not `response.data`)

---

## ENDPOINT 1 — POST /api/logs/ingest

**Purpose**: Ingest one HTTP request event from the middleware.

### Request Body
```json
{
  "projectId":       "string (required)",
  "method":          "GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD",
  "url":             "string (required)",
  "ip":              "string (required)",
  "queryParams":     {},
  "body":            {},
  "headers":         { "userAgent": "", "contentType": "", "referer": "" },
  "responseCode":    200,
  "processingTimeMs": 12
}
```

### Response
```json
{
  "success": true,
  "message": "Log ingested successfully",
  "data": { "id": "ObjectId string" }
}
```

---

## ENDPOINT 2 — GET /api/logs/recent

**Purpose**: Fetch recent system logs.

### Query Params
- `limit` (optional, default 20)

### Response
```json
{
  "success": true,
  "message": "...",
  "data": [
    {
      "_id":             "ObjectId string",
      "projectId":       "demo-project-001",
      "method":          "POST",
      "url":             "/api/login?input=%27+OR+1%3D1",
      "ip":              "192.168.1.101",
      "queryParams":     { "input": "' OR 1=1" },
      "body":            {},
      "headers":         { "userAgent": "Mozilla/5.0", "contentType": "application/json", "referer": "" },
      "responseCode":    200,
      "processingTimeMs": 45,
      "timestamp":       "2026-03-25T10:00:00.000Z",
      "createdAt":       "2026-03-25T10:00:00.000Z",
      "updatedAt":       "2026-03-25T10:00:00.000Z"
    }
  ]
}
```

### ⚠️ Warnings
- `responseCode` can be `null` — always null-check before display
- `queryParams` and `body` are objects — use `JSON.stringify()` for display, never render raw
- `headers` is `{ userAgent, contentType, referer }` — NOT a standard Headers object

---

## ENDPOINT 3 — GET /api/attacks/recent

**Purpose**: Fetch recent confirmed attack events.

### Query Params
- `limit` (optional, default 20)

### Response
```json
{
  "success": true,
  "message": "Recent attacks retrieved",
  "data": [
    {
      "_id":                  "ObjectId string",
      "requestId":            "ObjectId string (reference to SystemLog)",
      "ip":                   "192.168.1.101",
      "attackType":           "sqli",
      "severity":             "high",
      "status":               "attempt",
      "detectedBy":           "rule",
      "confidence":           0.92,
      "payload":              "' OR 1=1 --",
      "explanation":          "{\"summary\":\"...\",\"what_happened\":\"...\",\"potential_impact\":\"...\",\"recommended_action\":\"...\"}",
      "mitigationSuggestion": "Sanitize user input",
      "responseCode":         200,
      "timestamp":            "2026-03-25T10:00:00.000Z",
      "createdAt":            "2026-03-25T10:00:00.000Z",
      "updatedAt":            "2026-03-25T10:00:00.000Z"
    }
  ]
}
```

### ⚠️ Warnings
- `explanation` is a **JSON string** — always `JSON.parse()` it, with try/catch fallback
- `confidence` is `0.0` to `1.0` — multiply by 100 for percent display
- `attackType` enum: `sqli | xss | traversal | command_injection | ssrf | lfi_rfi | brute_force | hpp | xxe | webshell | unknown`
- `severity` enum: `low | medium | high | critical`
- `status` enum: `attempt | successful | blocked`
- `detectedBy` enum: `rule | ml | both` (NOT `rules_engine`, NOT `ml_classifier`)
- Use `_id` for navigation to `/attacks/:_id` and for forensics fetch

---

## ENDPOINT 4 — GET /api/attacks/:id/forensics

**Purpose**: Full forensic report for a single attack.

### URL Param
- `:id` = MongoDB `_id` of the AttackEvent

### Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "attack": {
      "id":          "ObjectId string",
      "attackType":  "sqli",
      "severity":    "high",
      "confidence":  0.92,
      "status":      "attempt",
      "detectedBy":  "rule",
      "payload":     "' OR 1=1 --",
      "explanation": "{\"summary\":\"...\",\"what_happened\":\"...\",\"potential_impact\":\"...\",\"recommended_action\":\"...\",\"rule_triggered\":\"..\"}",
      "timestamp":   "2026-03-25T10:00:00.000Z"
    },
    "raw_request": {
      "method":       "POST",
      "url":          "/api/login",
      "ip":           "192.168.1.101",
      "headers":      { "userAgent": "...", "contentType": "application/json", "referer": "" },
      "body":         {},
      "queryParams":  { "input": "' OR 1=1 --" },
      "responseCode": 200
    },
    "ip_intel": {
      "ip":                  "192.168.1.101",
      "total_requests_24h":  14,
      "total_attacks_ever":  6,
      "first_attack":        "2026-03-24T08:00:00.000Z",
      "last_attack":         "2026-03-25T10:00:00.000Z",
      "attack_types_seen":   ["sqli", "xss", "traversal"]
    },
    "attack_chain": {
      "timeline": [
        { "time": "2026-03-25T09:55:00.000Z", "method": "GET", "url": "/login", "code": 200 }
      ],
      "pattern_label": "Focused single-vector attack",
      "all_attacks":   [ ...AttackEvent objects with: attackType, severity, status, timestamp, confidence... ]
    }
  }
}
```

### ⚠️ Warnings
- `attack.id` on this endpoint (NOT `attack._id`)
- `raw_request` can be `null` if the linked SystemLog was deleted — always null-check
- `attack.explanation` is JSON string — parse it, keys: `summary`, `what_happened`, `potential_impact`, `recommended_action`, `rule_triggered`
- `attack_chain.timeline` items use key `code` (NOT `responseCode`)
- `ip_intel.attack_types_seen` is an array of strings (may be empty `[]`)
- `ip_intel.first_attack` / `last_attack` can be `null` if no attacks exist

### Error: 404
```json
{ "success": false, "message": "Attack not found", "code": "NOT_FOUND" }
```

---

## ENDPOINT 5 — GET /api/stats

**Purpose**: Aggregate statistics for the dashboard.

### Response
```json
{
  "success": true,
  "message": "Stats retrieved successfully",
  "data": {
    "totalLogs":    80,
    "totalAttacks": 50,
    "totalAlerts":  18,
    "unreadAlerts": 7,
    "attacksByType": {
      "sqli": 5, "xss": 8, "traversal": 3, "command_injection": 2,
      "ssrf": 1, "lfi_rfi": 4, "brute_force": 6, "hpp": 2,
      "xxe": 1, "webshell": 3, "unknown": 15
    },
    "attacksBySeverity": {
      "low": 10, "medium": 15, "high": 12, "critical": 13
    },
    "recentAttacks": [
      { "ip": "...", "attackType": "sqli", "severity": "high", "status": "attempt", "detectedBy": "rule", "confidence": 0.9, "createdAt": "..." }
    ]
  }
}
```

### ⚠️ Warnings
- `attacksBySeverity` keys: exactly `low`, `medium`, `high`, `critical` — use optional chain: `data.attacksBySeverity?.high ?? 0`
- `attacksByType` keys match the attackType enum — may be missing some if no attacks of that type exist
- `recentAttacks` items have only selected fields, NOT the full AttackEvent — no `_id`, no `payload`

---

## ENDPOINT 6 — GET /api/service-status

**Purpose**: Health status of all microservices.

### Response
```json
{
  "success": true,
  "message": "Service status retrieved",
  "data": {
    "overall":  "healthy" | "degraded",
    "services": [
      { "service": "gateway",          "status": "online",  "responseTimeMs": 0 },
      { "service": "detection-engine", "status": "online",  "responseTimeMs": 142 },
      { "service": "pcap-processor",   "status": "offline", "responseTimeMs": 3001, "error": "ECONNREFUSED" },
      { "service": "armoriq-agent",    "status": "offline", "responseTimeMs": 3001, "error": "ECONNREFUSED" }
    ],
    "checkedAt": "2026-03-25T13:00:00.000Z"
  }
}
```

### ⚠️ Warnings
- Field is `service` (NOT `name`) — the existing SystemStatus component uses `svc.name` which is **WRONG**, must be `svc.service`
- `error` field only present when status is `offline`
- `responseTimeMs` for gateway is always `0` (self-reported)
- `overall` is `"healthy"` only when ALL services are online — realistically will be `"degraded"` until all 4 services are running

---

## ENDPOINT 7 — GET /api/alerts

**Purpose**: Fetch alert list.

### Query Params
- `limit` (optional, default 20)
- `severity` (optional, filter: `low|medium|high|critical`)

### Response
```json
{
  "success": true,
  "message": "Alerts retrieved",
  "data": [
    {
      "_id":       "ObjectId string",
      "attackId":  {
        "_id":        "ObjectId string",
        "attackType": "sqli",
        "ip":         "192.168.1.101",
        "status":     "attempt",
        "confidence": 0.92
      },
      "title":     "SQLI Detected",
      "message":   "high severity attack from 192.168.1.101",
      "severity":  "high",
      "type":      "attack_detected",
      "isRead":    false,
      "resolvedAt": null,
      "meta":      { "attackType": "sqli", "confidence": 0.92 },
      "createdAt": "2026-03-25T10:00:00.000Z",
      "updatedAt": "2026-03-25T10:00:00.000Z"
    }
  ]
}
```

### ⚠️ Warnings
- `attackId` is a **populated object** (not a string ID) — access as `alert.attackId.attackType`
- `attackId` may be `null` in edge cases — always guard: `alert.attackId?.attackType ?? 'unknown'`
- `meta` may be `{}` — use optional chain: `alert.meta?.confidence`
- `resolvedAt` is `null` until resolved (feature not built yet)
- `type` enum: `attack_detected | service_down | rate_limit | anomaly`

---

## ENDPOINT 8 — PATCH /api/alerts/:id/read

**Purpose**: Mark a single alert as read.

### Response
```json
{
  "success": true,
  "message": "Alert marked read",
  "data": { ...full Alert object with isRead: true... }
}
```

### ⚠️ Warning
- Do NOT re-fetch entire alert list after this call
- Update local state directly: `setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a))`

---

## ENDPOINT 9 — GET /api/health

**Purpose**: Basic uptime check.

### Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "status":    "ok",
    "uptime":    342.5,
    "dbStatus":  "connected" | "disconnected",
    "timestamp": "2026-03-25T13:00:00.000Z"
  }
}
```

---

## SOCKET EVENTS

**Connection**: `io('http://localhost:3000', { transports: ['websocket', 'polling'] })`

All events are wrapped:
```json
{
  "event":     "attack:new",
  "timestamp": "2026-03-25T10:00:00.000Z",
  "data":      { ...event-specific fields... }
}
```

**CRITICAL RULE**: Always read `payload.data`, NEVER `payload` directly.

### attack:new
Fired when: a new AttackEvent is saved to DB
```json
"data": {
  "id":         "ObjectId string",
  "ip":         "192.168.1.101",
  "attackType": "sqli",
  "severity":   "high",
  "status":     "attempt",
  "detectedBy": "rule",
  "confidence": 0.92,
  "timestamp":  "2026-03-25T10:00:00.000Z"
}
```
⚠️ Field is `id` (NOT `_id`) in socket payload

### alert:new
Fired when: a new Alert is created for high/critical attack
```json
"data": {
  "id":        "ObjectId string",
  "title":     "SQLI Detected",
  "severity":  "high",
  "type":      "attack_detected",
  "timestamp": "2026-03-25T10:00:00.000Z"
}
```
⚠️ Field is `id` (NOT `_id`) in socket payload
⚠️ `attackId`, `message`, `isRead` are NOT in socket payload — only full object comes from REST

### service:status
Fired when: service health changes
```json
"data": { ...service status object... }
```

### stats:update
Fired when: stats change (not yet triggered automatically — reserved)

---

## ENUMS REFERENCE

### attackType
```
sqli | xss | traversal | command_injection | ssrf | lfi_rfi | brute_force | hpp | xxe | webshell | unknown
```

### severity
```
low | medium | high | critical
```

### status (AttackEvent)
```
attempt | successful | blocked
```

### detectedBy
```
rule | ml | both
```

### Alert.type
```
attack_detected | service_down | rate_limit | anomaly
```

### SystemLog.method
```
GET | POST | PUT | PATCH | DELETE | OPTIONS | HEAD
```

---

## COMMON PITFALLS SUMMARY

| # | Pitfall | Correct Pattern |
|---|---------|----------------|
| 1 | Using `svc.name` | Use `svc.service` |
| 2 | Reading socket payload directly | Read `payload.data` |
| 3 | `attack.explanation` as raw string | `JSON.parse(attack.explanation)` with try/catch |
| 4 | `response.data` instead of `response.data.data` | Always unwrap inner `data` |
| 5 | `alert.attackType` | `alert.attackId.attackType` (populated) |
| 6 | Socket `payload.data.id` vs REST `._id` | Socket uses `id`, REST uses `_id` |
| 7 | `responseCode` = null | Display as `'—'`, never `'null'` |
| 8 | `confidence` as percent | Multiply by 100: `Math.round(c * 100)` |
| 9 | `attack_chain.timeline[].code` | Key is `code` NOT `responseCode` |
| 10 | Re-fetching after mark-read | Update state optimistically, no re-fetch |
| 11 | `detectedBy: 'rules_engine'` | Correct value is `'rule'` |
| 12 | `attacksBySeverity.High` (capital) | Lowercase: `attacksBySeverity.high` |
