# 10 — Changelog

> Source: `MASTER_REFERENCE.md` §16 · Updated: 2026-04-01

---

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | SENTINAL Response Engine + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Pydantic models fix, executor safe HTTP, audit:new socket, Demo Target E2E |
| 2026-03-26 | 4.0 | runtime.py + policy.yaml. 4 redundant docs deleted |
| 2026-03-27 | 5.0 | MongoDB Atlas Track: Atlas Search, $facet, all 6 collections verified |
| 2026-03-27 | 6.0 | Production deploy: PM2, env fixes, VITE_API_URL fix, Atlas IP allowlist |
| 2026-03-27 | 7.0 | Full AWS EC2 deploy guide Parts A–M: .pem, EC2 launch, apt install, venvs, PM2 |
| 2026-03-27 | 8.0 | AWS Academy strategy: deploy.sh one-command deploy, §15 per-session checklist |
| 2026-03-27 | 9.0 | SimulateAttack page `/simulate` (14th page), Postman collection (40+ requests) |
| 2026-03-28 | 10.0 | §14 rewritten: verified against deploy.sh, services table, Parts A–H |
| 2026-03-28 | 11.0 | §14 PART G fully expanded, PART H individual service commands, PART I known issues |
| 2026-03-31 | 12.0 | Split MASTER_REFERENCE.md into 10 focused files in `Readme/`. INDEX.md created. |
| 2026-04-01 | 13.0 | **Geo-IP Threat Intelligence**: `geoIntel` field on AttackEvent, `/api/geo/heatmap` + `/api/geo/stats` endpoints, `GeoThreatMap.jsx` page (`/geo`), backfill script `backend/scripts/backfill-geo.js`. 198 existing records enriched via ip-api.com. Docs updated: 02-repo-structure, 04-features, 05-api-contracts. |

---

## How to Update These Files

- Each file covers exactly one topic — edit only the relevant file
- After any significant architectural change, update the relevant file **and** bump the version + date at the top of that file
- Log the change in this file (`10-changelog.md`) with date, version, and a 1-line description
- Do **not** create new standalone docs outside the `Readme/` folder — add sections to the appropriate file here
- The `INDEX.md` quick-navigation table may need updating if new sections are added
