# 08 — Database — MongoDB Atlas

> Source: `MASTER_REFERENCE.md` §7, §17 · Last verified: 2026-03-28

---

## Connection Config

**File:** `backend/src/config/database.js`

- URI from `process.env.MONGO_URI` — **fails fast if missing**
- Retry: 3 attempts × 3s delay
- Options: `serverSelectionTimeoutMS:10000`, `socketTimeoutMS:45000`, `maxPoolSize:10`
- Graceful shutdown: `SIGINT`/`SIGTERM` → `mongoose.connection.close()`

---

## All 6 Collections

```
systemlogs:
  projectId*  timestamp*  method  url  queryParams  body  headers
  ip*  responseCode  processingTimeMs

attackevents:
  requestId*  timestamp*  ip*  attackType*  severity*  status*
  detectedBy  confidence  payload  explanation  mitigationSuggestion

alerts:
  attackId*  title  message  severity  type  isRead  resolvedAt  meta

action_queue:
  attackId(String)*  action*  status*  agentReason  blockedReason
  ip  approvedBy  approvedAt

audit_log:          ← SINGULAR — not audit_logs
  intent_id  action  status*  triggeredBy  ip*  attackId(String)
  policy_rule_id  enforcement_level  reason  meta

servicestatuses:
  serviceName(unique)  status  lastChecked  responseTimeMs  errorMessage
```

**Key:** `*` = indexed

> ⚠️ `attackId` in `action_queue` and `audit_log` is a plain **String** — NOT an ObjectId reference. Never cast it.

---

## Atlas Search Index

- **Index name:** `attackevents_search`
- **Collection:** `attackevents`
- **Fields:** `payload` (standard), `ip` (keyword), `attackType` (keyword), `explanation` (standard), `mitigationSuggestion` (standard)
- **Endpoint:** `GET /api/attacks/search?q=<term>` — auto-falls back to `$regex` if index not provisioned

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "payload":              { "type": "string", "analyzer": "lucene.standard" },
      "ip":                   { "type": "string", "analyzer": "lucene.keyword" },
      "attackType":           { "type": "string", "analyzer": "lucene.keyword" },
      "explanation":          { "type": "string", "analyzer": "lucene.standard" },
      "mitigationSuggestion": { "type": "string", "analyzer": "lucene.standard" }
    }
  },
  "name": "attackevents_search"
}
```

---

## Live Production Evidence (2026-03-28)

```
All 5 services: online via PM2
MongoDB Atlas: IP allowlisted, connection confirmed
Collections: 125+ system logs, 78+ attack events
Atlas Search: attackevents_search index live
```
