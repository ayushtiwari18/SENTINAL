# INDEX_REPORT.md
## SENTINAL — MongoDB Atlas Index Validation Report

> Generated: 2026-03-27 | Phase 4 of MongoDB Atlas Track

---

## Collection: `attackevents`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `ip_1` | `ip: 1` | Single | Filter attacks by source IP |
| `timestamp_-1` | `timestamp: -1` | Single | Sort/range queries — descending |
| `severity_1` | `severity: 1` | Single | Filter by severity level |
| `attackType_1` | `attackType: 1` | Single | Filter by attack category |
| `status_1` | `status: 1` | Single | Filter by blocked/attempt/successful |
| `severity_1_timestamp_-1` | `severity: 1, timestamp: -1` | Compound | Dashboard severity + time range |
| `ip_1_timestamp_-1` | `ip: 1, timestamp: -1` | Compound | Per-IP attack timeline |
| `requestId_1` | `requestId: 1` | Single (schema) | FK join to systemlogs |
| `attackevents_search` | `payload, ip, attackType` | **Atlas Search** | Full-text search via `$search` |

---

## Collection: `systemlogs`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `projectId_1` | `projectId: 1` | Single (schema) | Project isolation |
| `ip_1` | `ip: 1` | Single | IP-based log queries |
| `timestamp_-1` | `timestamp: -1` | Single | Time-based log retrieval |

---

## Collection: `audit_log`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `status_1` | `status: 1` | Single (schema) | Filter ALLOWED/BLOCKED |
| `ip_1` | `ip: 1` | Single | Per-IP audit trail |
| `createdAt_-1` | `createdAt: -1` | Single | Chronological audit view |

---

## Collection: `action_queue`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `attackId_1` | `attackId: 1` | Single (schema) | Link to attack event |
| `status_1` | `status: 1` | Single (schema) | Filter pending/approved/rejected |

---

## Collection: `alerts`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `attackId_1` | `attackId: 1` | Single (schema) | Link to attack event |
| `severity_1` | `severity: 1` | Single | Filter by severity |
| `createdAt_-1` | `createdAt: -1` | Single | Chronological alert view |

---

## Collection: `servicestatuses`

| Index Name | Fields | Type | Purpose |
|---|---|---|---|
| `_id_` | `_id` | Default | Document lookup |
| `serviceName_1` | `serviceName: 1` | Unique (schema) | One doc per service |

---

## Atlas Search Index Definition

Create this in **Atlas UI → Search → Create Index → Collection: `attackevents`**

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "payload": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "ip": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "attackType": {
        "type": "string",
        "analyzer": "lucene.keyword"
      },
      "explanation": {
        "type": "string",
        "analyzer": "lucene.standard"
      },
      "mitigationSuggestion": {
        "type": "string",
        "analyzer": "lucene.standard"
      }
    }
  },
  "name": "attackevents_search"
}
```

**Index name:** `attackevents_search`

---

## Verification Status

| Check | Status |
|---|---|
| All model-defined indexes created | ✅ Auto-created on startup via `database.js` |
| `ip` index on attackevents | ✅ |
| `timestamp` index on attackevents | ✅ |
| `severity` index on attackevents | ✅ |
| `attackType` index on attackevents | ✅ |
| `status` index on attackevents | ✅ |
| Compound `severity + timestamp` | ✅ |
| Atlas Search index | ⚙️ Manual step in Atlas UI (see definition above) |

---

*Indexes are created/verified automatically on every server startup in `backend/src/config/database.js`.*
