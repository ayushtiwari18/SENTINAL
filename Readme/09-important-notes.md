# 09 — Important Notes, Demo Guide & Concerns

> Source: `MASTER_REFERENCE.md` §13 · Last verified: 2026-03-28

---

## Demo Day Guide

### Health Check (Always Do This First)
```bash
curl http://localhost:3000/health
curl http://localhost:8004/health   # must show policyguard_loaded:true
```

### Option A — Browser Attack Simulator (No Terminal Needed — Recommended for Judges)
1. Open `http://<EC2_IP>:5173/simulate`
2. Click any attack button — fires real payload to Gateway
3. Switch tab to `/attacks` — new entry appears live
4. Click **🚨 LAUNCH FULL ATTACK WAVE** — all 5 attacks fire with 1.2s stagger
5. Right panel shows live detections via Socket.io

| Button | Payload | Target Route |
|--------|---------|--------------|
| 💉 SQL Injection | `admin' OR '1'='1' --` in body | POST /api/logs/ingest |
| ⚡ XSS Attack | `<script>alert(document.cookie)</script>` in URL | POST /api/logs/ingest |
| 📁 Path Traversal | `/../../../etc/passwd` in query | POST /api/logs/ingest |
| 💻 Command Injection | `hello; cat /etc/shadow` | POST /api/logs/ingest |
| 🔨 Brute Force (CRITICAL) | severity:critical → triggers BLOCK | POST /api/Nexus/trigger |

### Option B — Postman
```
https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/SENTINAL_Postman_Collection.json
```
Run **Folder 08 — End-to-End Demo Sequence** in order.

### Option C — Shell Script
```bash
bash demo-target/attack.sh
# Watch dashboard: http://<EC2_IP>:5173
```

### Option D — Direct curl
```bash
# SQLi
curl -s -X POST http://localhost:3000/api/logs/ingest \
  -H "Content-Type: application/json" \
  -d '{"projectId":"demo","method":"POST","url":"/login","ip":"1.2.3.4",
       "headers":{},"queryParams":{},"body":{"username":"admin'\'''\'' OR '\''1'\''='\''1'\'' --","password":"x"}}'

# Nexus ALLOW (medium)
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-1","ip":"5.5.5.5","attackType":"sqli","severity":"medium","confidence":0.9,"status":"attempt"}'

# Nexus BLOCK (critical)
curl -X POST http://localhost:8004/respond -H "Content-Type: application/json" \
  -d '{"attackId":"demo-2","ip":"6.6.6.6","attackType":"brute_force","severity":"critical","confidence":0.97,"status":"successful"}'
```

### Judge Pitch
> *"SENTINEL detects threats in real time and enforces responses through PolicyGuard —
> reading from policy.yaml. Safe actions like send_alert execute automatically.
> Dangerous actions like permanent_ban_ip are blocked and queued for human approval.
> Every decision is logged with the exact policy rule that fired it."*

---

## Critical Rules (DO NOT BREAK)

- **Never modify `main` directly** for experimental changes — use a feature branch
- **Never delete existing functionality** without team confirmation
- **Never hardcode the EC2 IP** anywhere in code — it changes every AWS session
- **Never add extra fields** to `/api/logs/ingest` — Joi strict mode will reject the request
- **`audit_log` is singular** — never query `audit_logs`
- **`attackId` in action_queue/audit_log is a String** — never treat as ObjectId
- **Always run `npm run build`** in `dashboard/` before restarting `sentinal-dashboard`
- **`MONGO_URI` env var** — Joi validator will reject `MONGO_URL`. Must be exactly `MONGO_URI`.
- **`runtime.py` default is BLOCK** — fail-safe. Do not change the default.
- **policy_engine.py is the fallback** — do not remove it even if runtime works fine

---

## Important Points to Remember

### Architecture
- The gateway is the **only entry point** for external traffic — never expose Python services directly in prod
- `setImmediate()` in `detectionConnector.js` keeps detection **async** — does not block the log ingest response
- `callNexus()` is **also async** — Nexus processing never blocks the gateway response
- Socket.io events are emitted **after** MongoDB writes — order is guaranteed

### Data
- `confidence` is a float `0.0–1.0` — never store as percentage integer
- `severity` values: `low` · `medium` · `high` · `critical` — lowercase always
- `status` values on AttackEvent: `attempt` · `successful` · `blocked`
- `status` values on ActionQueue: `pending` · `approved` · `rejected`

### Deployment
- `deploy.sh` auto-rewrites `ecosystem.config.js` — **do not manually edit** `ecosystem.config.js` on the server
- Python `.venv` directories are created **inside each service folder** — not at repo root
- `pm2 save` must be run after every pm2 change or processes won't survive reboot

### Dashboard
- `api.js` reads `VITE_API_URL` — must be set in `dashboard/.env.production` before build
- `socket.js` reads `VITE_SOCKET_URL` — same file
- Dashboard is a **static build** — `npm run build` must be re-run after any JSX/JS change
- Arrays from API come as `{ data: [] }` — use `r.data.length` not `r.length`

---

## Concerns & Risks

| Concern | Status | Notes |
|---------|--------|-------|
| `sentinel_v5.pkl` not in repo | 🔴 P0 | ML model integration in progress (sentinel-ml repo) |
| Gemini API key not set | 🟡 P1 | LLM explanation falls back gracefully |
| No Nginx / HTTPS | 🟡 P1 | All ports exposed directly — acceptable for demo, not prod |
| EC2 IP changes every session | 🟡 Ongoing | `deploy.sh` handles it — just remember to update Atlas allowlist |
| No rate limiting on Gateway | 🟡 P1 | Demo traffic only — add before production |
| Dashboard charts not wired | 🟠 P1 | Recharts components exist but data not connected |
| No auth on API routes | 🟡 Demo | JWT middleware exists but not enforced on all routes |
| PM2 log rotation | 🟠 P2 | Logs grow unbounded — add `pm2 install pm2-logrotate` |
