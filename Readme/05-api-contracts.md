# 05 — API Contracts — Every Live Route

> Source: `MASTER_REFERENCE.md` §5, §7, §8 · Last verified: 2026-04-01
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
POST  /api/alerts/Nexus        ← Nexus executor only

GET  /api/actions/pending
POST /api/actions/:id/approve   Body: { approvedBy: string }
POST /api/actions/:id/reject    Body: { rejectedBy: string }

GET  /api/audit?limit=100
POST /api/audit/ingest          ← audit_logger.py only

POST /api/Nexus/trigger       Body: { ip?, attackType?, severity?, confidence?, status? }
POST /api/pcap/upload           multipart: field "pcap" + field "projectId"
GET  /api/stats
GET  /api/service-status
GET  /api/logs/recent?limit=50
GET  /health
```

---

## Geo-IP Intelligence API (`:3000/api/geo`)

> Added 2026-04-01. No authentication required. All data served from MongoDB aggregations.

```
GET /api/geo/heatmap
  Response 200: {
    success: true,
    heatmap: [
      {
        country_code: "IN",
        country:      "India",
        lat:          20.59,
        lng:          78.96,
        count:        42,        ← total attacks from this country
        critical:     5,
        high:         12,
        tor_count:    0,
        proxy_count:  3,
        avg_abuse:    0          ← average AbuseIPDB confidence score
      },
      ...
    ]
  }
  Notes: Returns up to 200 countries sorted by attack count descending.
         Only includes records where geoIntel.country_code exists (not null).

GET /api/geo/stats
  Response 200: {
    success: true,
    top_countries: [
      { country_code: "IN", country: "India", count: 42 },
      ...                          ← top 10 attacking countries
    ],
    threat_flags: {
      total:           157,        ← total attacks with geo data
      tor_attacks:     0,
      proxy_attacks:   8,
      hosting_attacks: 12,
      high_abuse:      3,          ← IPs with abuse_confidence_score >= 50
      unique_countries: 6
    }
  }

GET /api/geo/ip/:ip
  Response 200: { success: true, heatmap: [...] }
  Notes: Currently proxies to Detection Engine geo cache.
         Future: will return single-IP enriched profile.
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
Response: { policyguard_loaded: bool, enforcement: 'PolicyGuard-v1' }
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
    detectedBy, confidence, payload, explanation, mitigationSuggestion,
    geoIntel: {                      ← NEW (2026-04-01)
      country, country_code, region, city,
      latitude, longitude, isp, org, asn,
      is_proxy, is_hosting, is_tor, is_whitelisted,
      abuse_confidence_score, total_reports, last_reported_at
    }
  }

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
