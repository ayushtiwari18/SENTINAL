# ATLAS_MIGRATION_GUIDE.md
## SENTINAL — MongoDB Atlas Migration & Setup Guide

> For judges evaluating the **MongoDB Atlas Track** at MLH Hackathon

---

## Quick Setup (5 minutes)

### Step 1: Configure Environment
```bash
cd backend
cp .env.example .env
# Edit .env and set your MONGO_URI:
# MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/sentinal
```

### Step 2: Start the server
```bash
npm install
npm start
```

Expected startup logs:
```
[DATABASE] Connected to MongoDB Atlas — host: cluster0.lenxm5v.mongodb.net
[DATABASE] Database name: sentinal
[DATABASE] All indexes verified / created successfully.
[SERVER] SENTINEL Gateway running on port 3000
```

### Step 3: Run verification script
```bash
node backend/scripts/atlasVerify.js
```
This runs full CRUD on all 6 collections and cleans up after itself.

---

## Atlas Search Setup (Advanced Feature)

1. Go to **MongoDB Atlas UI** → your cluster → **Search** tab
2. Click **Create Search Index**
3. Choose **JSON Editor**
4. Select collection: `attackevents`
5. Paste this definition:

```json
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "payload": { "type": "string", "analyzer": "lucene.standard" },
      "ip": { "type": "string", "analyzer": "lucene.keyword" },
      "attackType": { "type": "string", "analyzer": "lucene.keyword" },
      "explanation": { "type": "string", "analyzer": "lucene.standard" },
      "mitigationSuggestion": { "type": "string", "analyzer": "lucene.standard" }
    }
  },
  "name": "attackevents_search"
}
```

6. Click **Create**. Index builds in ~2 minutes.

### Test Atlas Search:
```bash
curl "http://localhost:3000/api/attacks/search?q=union+select"
curl "http://localhost:3000/api/attacks/search?q=xss&limit=10"
curl "http://localhost:3000/api/attacks/search/stats"
```

---

## Collections Used

| Collection | Purpose | Model File |
|---|---|---|
| `attackevents` | Core attack detection records | `AttackEvent.js` |
| `audit_log` | ArmorIQ policy enforcement log | `AuditLog.js` |
| `action_queue` | Pending/approved agent actions | `ActionQueue.js` |
| `alerts` | Real-time alerting | `Alert.js` |
| `servicestatuses` | Microservice health tracking | `ServiceStatus.js` |
| `systemlogs` | Raw HTTP request logs | `SystemLog.js` |

---

## Atlas Features Used

| Feature | Implementation | File |
|---|---|---|
| **Atlas Cluster** | Cloud MongoDB, SRV connection string | `config/database.js` |
| **Atlas Search** | `$search` aggregation on attackevents | `atlasSearchController.js` |
| **Aggregation Pipeline** | `$facet` stats, `$group` trends | `atlasSearchController.js` |
| **Connection Pooling** | `maxPoolSize: 10` | `config/database.js` |
| **Retry Writes** | `retryWrites=true,w=majority` | `config/database.js` |
| **TLS/SSL** | Enforced by `mongodb+srv://` protocol | Atlas default |
| **Indexes** | Auto-created on startup | `config/database.js` |

---

## API Endpoints

```
GET  /api/attacks/search?q=<term>   — Atlas Search full-text
GET  /api/attacks/search/stats      — Aggregation pipeline stats
GET  /api/attacks/recent            — Recent attack events
POST /api/attacks/report            — Ingest new attack
GET  /api/health                    — Server + DB health
```

---

## Security Checklist

- [x] `MONGO_URI` read from `process.env` only
- [x] `.env` in `.gitignore` (never committed)
- [x] Connection uses TLS via `mongodb+srv://` protocol
- [x] No credentials in source code
- [x] `.env.example` has placeholder values only
- [x] `retryWrites=true, w=majority` for data safety
- [x] IP allowlist configured in Atlas Network Access

---

*SENTINAL — AI-powered Web Application Security Platform*
*HackByte 4.0 | MongoDB Atlas Track*
