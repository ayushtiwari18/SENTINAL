# SENTINAL — Reference Index

> **Last updated:** 2026-03-31

This folder is the authoritative, split reference for the SENTINAL project.  
The old `MASTER_REFERENCE.md` in the root is kept for history — **do not edit it**.  
All active edits go into the files below.

---

## Navigation

| # | File | Contents |
|---|------|----------|
| — | **[INDEX.md](./INDEX.md)** | This file — quick lookup |
| 01 | **[01-architecture.md](./01-architecture.md)** | System diagram, port registry, 4 request flows, OpenClaw flow, deployment topology |
| 02 | **[02-repo-structure.md](./02-repo-structure.md)** | Full directory tree (verified), key files, root scripts |
| 03 | **[03-services.md](./03-services.md)** | Each service: purpose, tech stack, env vars, run commands |
| 04 | **[04-features.md](./04-features.md)** | Feature breakdown: detection, response, forensics, AI |
| 05 | **[05-api-contracts.md](./05-api-contracts.md)** | Internal service-to-service contracts (detection, response engines) |
| **NEW** | **[API.md](./API.md)** | **Complete external + internal API reference — all endpoints** |
| 06 | **[06-deployment-aws.md](./06-deployment-aws.md)** | AWS EC2 setup, PM2 config, Security Groups, domain/TLS |
| 07 | **[07-aws-sessions.md](./07-aws-sessions.md)** | AWS session management, credentials, rotate keys |
| 08 | **[08-database.md](./08-database.md)** | MongoDB Atlas: collections, schemas, indexes |
| 09 | **[09-important-notes.md](./09-important-notes.md)** | Gotchas, known issues, critical rules to follow |
| 10 | **[10-changelog.md](./10-changelog.md)** | Version history, breaking changes, what changed when |

---

## System at a Glance

```
Target App (SDK)
    │
    ▼
Backend — Node.js :3000  (backend/server.js)
    │
    ├─► Detection Engine     Python :8002  (services/detection-engine)
    ├─► PCAP Processor        Python :8003  (services/pcap-processor)
    ├─► Nexus Agent         Python :8004  (services/Nexus-agent)
    └─► Response Engine       Python :8005  (services/sentinal-response-engine)
    │
    ├─► MongoDB Atlas
    │
Dashboard — React :5173  (dashboard/)
```

---

## Quick Command Reference

```bash
# Start everything (local dev)
bash start.sh

# Stop everything
bash stop.sh

# Check health
bash status.sh

# Deploy to AWS
bash deploy.sh

# PM2 process list
pm2 list
pm2 logs sentinal-backend

# Backend only
cd backend && npm run dev

# Detection engine only
cd services/detection-engine && python app/run.py

# Response engine only
cd services/sentinal-response-engine && python run.py
```

---

## Where to Look for What

| I want to... | Go to |
|---|---|
| Understand the full system flow | [01-architecture.md](./01-architecture.md) |
| Find a file in the repo | [02-repo-structure.md](./02-repo-structure.md) |
| Call an API endpoint | [API.md](./API.md) |
| Change response policy | `services/sentinal-response-engine/policy.yaml` |
| Change ML detection logic | `services/detection-engine/app/classifier.py` |
| Add a new route | `backend/src/routes/` + `backend/src/controllers/` |
| Change how detection is called | `backend/src/services/detectionConnector.js` |
| Deploy to AWS | [06-deployment-aws.md](./06-deployment-aws.md) |
| Understand DB schema | [08-database.md](./08-database.md) |
| Check known issues | [09-important-notes.md](./09-important-notes.md) |
