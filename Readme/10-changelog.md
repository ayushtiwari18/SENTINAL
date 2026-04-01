# 10 — Changelog

> Source: `MASTER_REFERENCE.md` §16 · Updated: 2026-03-31

---

| Date | Version | Change |
|------|---------|--------|
| 2026-03-26 | 1.0 | Initial doc + PCAP Processor built |
| 2026-03-26 | 2.0 | SENTINAL Response Engine + ActionQueue + AuditLog + sentinel-middleware |
| 2026-03-26 | 3.0 | Pydantic models fix, executor safe HTTP, audit:new socket, Demo Target E2E |
| 2026-03-26 | 4.0 | runtime.py + policy.yaml. 4 redundant docs deleted                    |
| 2026-03-27 | 5.0 | MongoDB Atlas Track: Atlas Search, $facet, all 6 collections verified |
| 2026-03-27 | 6.0 | Production deploy: PM2, env fixes, VITE_API_URL fix, Atlas IP allowlist |
| 2026-03-27 | 7.0 | Full AWS EC2 deploy guide Parts A–M: .pem, EC2 launch, apt install, venvs, PM2 |
| 2026-03-27 | 8.0 | AWS Academy strategy: deploy.sh one-command deploy, §15 per-session checklist, IP change workflow, MONGO_URI prompt, Atlas IP update reminder, troubleshooting table, ecosystem.config.js absolute venv paths |
| 2026-03-27 | 9.0 | SimulateAttack page `/simulate` (14th page), Postman collection (40+ requests, 8 folders), updated folder structure with all 14 pages + demo-target routes, §13 demo options A–D, §4 Flow D, socket subscription notes |
| 2026-03-28 | 10.0 | §14 rewritten: verified against deploy.sh SHA 6bab1b30, added services table with PM2 names, expanded Parts A–H |
| 2026-03-28 | 11.0 | §14 PART G fully expanded: 5 update scenarios, Quick Reference cheat sheet. PART H: all individual service log/restart commands + pm2 resurrect. PART I: 2 new known-issue rows |
| 2026-03-31 | 12.0 | Split MASTER_REFERENCE.md into 10 focused files in `Readme/` folder for maintainability. INDEX.md created as navigation hub. Content 100% preserved — no information removed. |

---

## How to Update These Files

- Each file covers exactly one topic — edit only the relevant file
- After any significant architectural change, update the relevant file **and** bump the version + date at the top of that file
- Log the change in this file (`10-changelog.md`) with date, version, and a 1-line description
- Do **not** create new standalone docs outside the `Readme/` folder — add sections to the appropriate file here
- The `INDEX.md` quick-navigation table may need updating if new sections are added
