# SENTINAL — Reference Index

> **Version:** 12.0 · **Date:** 2026-03-31 · **Status:** Living index — always up to date
>
> The original `MASTER_REFERENCE.md` has been split into focused files for easier navigation.
> Each file below is the single source of truth for its topic.
> **Do NOT create new standalone docs outside this folder** — add sections here.

---

## Files in This Folder

| # | File | Covers | Sections from Master |
|---|------|--------|-----------------------|
| 01 | [Architecture](./01-architecture.md) | System diagram, OpenClaw decision flow, request lifecycle | §1, §4 |
| 02 | [Repo Structure](./02-repo-structure.md) | Exact directory tree, every file explained | §2 |
| 03 | [Services](./03-services.md) | Service registry, ports, Socket.io events, response envelope | §3, §10, §11, §12 |
| 04 | [Features](./04-features.md) | Feature breakdown, build status, OpenClaw enforcement detail | §6, §8, §9 |
| 05 | [API Contracts](./05-api-contracts.md) | Every live route, request/response schemas, field registry | §5, §7, §8 |
| 06 | [Deployment — AWS](./06-deployment-aws.md) | Full EC2 deploy guide (Parts A–I), update scenarios, known issues | §14 |
| 07 | [AWS Sessions](./07-aws-sessions.md) | Per-session checklist, what persists, MONGO_URI, troubleshooting | §15 |
| 08 | [Database](./08-database.md) | MongoDB Atlas schemas, Atlas Search index, connection config | §7, §17 |
| 09 | [Important Notes](./09-important-notes.md) | Demo day guide, critical warnings, known pitfalls, concerns | §13 |
| 10 | [Changelog](./10-changelog.md) | Full version history v1.0 → current | §16 |

---

## Quick Navigation

### I need to...

| Task | Go to |
|------|-------|
| Understand the full system flow | [01-architecture.md](./01-architecture.md) |
| Find where a file lives in the repo | [02-repo-structure.md](./02-repo-structure.md) |
| Check which port a service runs on | [03-services.md](./03-services.md) |
| See all API routes and request bodies | [05-api-contracts.md](./05-api-contracts.md) |
| Deploy on a new AWS session | [07-aws-sessions.md](./07-aws-sessions.md) → 4-step checklist |
| Deploy from scratch on fresh EC2 | [06-deployment-aws.md](./06-deployment-aws.md) |
| Update live server after a git push | [06-deployment-aws.md § Update Scenarios](./06-deployment-aws.md#update-scenarios) |
| Check MongoDB schemas | [08-database.md](./08-database.md) |
| Run the demo for judges | [09-important-notes.md](./09-important-notes.md) |
| Know what NOT to break | [09-important-notes.md § Critical Rules](./09-important-notes.md#critical-rules) |
| See what's been built / what's missing | [04-features.md](./04-features.md) |

---

## System at a Glance

```
sentinel-middleware (npm)
       │
       ▼
Gateway API (Node :3000)  ──→  Detection Engine (Python :8002)
       │                                  │
       │               threat_detected = true
       │                                  │
       ├──→ AttackEvent + Alert (MongoDB)
       ├──→ Socket.io broadcast
       └──→ SENTINAL Response Engine (Python :8004)
                    │
             OpenClaw runtime (policy.yaml)
                    │
          ALLOW ────┼──── BLOCK
          executor  │   ActionQueue → Human review
                    │
             AuditLog (MongoDB)

React Dashboard (Vite :5173) — 14 pages, live Socket.io
PCAP Processor (Python :8003) — independent network analysis
```

---

## Current Status (2026-03-31)

| Component | Status |
|-----------|--------|
| Gateway API | ✅ LIVE |
| Detection Engine | ✅ LIVE (ML model pending) |
| PCAP Processor | ✅ LIVE |
| SENTINAL Response Engine | ✅ LIVE |
| React Dashboard (14 pages) | ✅ LIVE |
| MongoDB Atlas | ✅ LIVE |
| sentinel-ml integration | 🟡 IN PROGRESS |
| Dashboard Charts (Recharts) | 🔲 NOT BUILT |
| Nginx + HTTPS | 🔲 NOT BUILT |
