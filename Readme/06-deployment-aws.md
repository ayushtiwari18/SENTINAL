# 06 — Production Deployment — AWS EC2

> Source: `MASTER_REFERENCE.md` §14 · Last verified: 2026-03-28
> Verified against `deploy.sh` SHA: `6bab1b30b2cb7369d404a27693c605dea9cc4b82`

---

## Services Deployed

| Service | Port | Tech Stack | PM2 Name |
|---------|------|-----------|----------|
| Gateway (Backend) | 3000 | Node.js / Express | `sentinal-gateway` |
| Detection Engine | 8002 | Python / FastAPI + uvicorn | `sentinal-detection` |
| PCAP Processor | 8003 | Python / FastAPI + uvicorn | `sentinal-pcap` |
| SENTINAL Response Engine | 8004 | Python / FastAPI + uvicorn | `sentinal-armoriq` |
| React Dashboard | 5173 | Vite build, served via `serve` | `sentinal-dashboard` |

---

## PART A — Launch EC2 Instance

1. AWS Console → **EC2** → **Launch Instance**
2. **Name:** `sentinal-server`
3. **AMI:** Ubuntu Server 22.04 LTS (64-bit x86)
4. **Instance type:** `t2.medium` (recommended) or `t3.micro` (AWS Academy default)
5. **Key pair:** Select existing `sentinal-key` (or create new → download `.pem`)
6. **Security Group** — Add inbound rules:

| Port | Protocol | Source | Purpose |
|------|----------|--------|---------|
| 22 | TCP | 0.0.0.0/0 | SSH |
| 3000 | TCP | 0.0.0.0/0 | Gateway API |
| 5173 | TCP | 0.0.0.0/0 | React Dashboard |
| 8002 | TCP | 0.0.0.0/0 | Detection Engine |
| 8003 | TCP | 0.0.0.0/0 | PCAP Processor |
| 8004 | TCP | 0.0.0.0/0 | SENTINAL Response Engine |

7. **Storage:** 20 GB gp3
8. Launch → wait 2 min → copy **Public IPv4**

---

## PART B — Connect to Instance

**Option 1 — EC2 Instance Connect (recommended for AWS Academy — no .pem needed)**
1. AWS Console → your instance → **Connect** → **EC2 Instance Connect** → **Connect**

**Option 2 — SSH from Linux/Mac**
```bash
chmod 400 ~/.ssh/sentinal-key.pem
ssh -i ~/.ssh/sentinal-key.pem ubuntu@<EC2_PUBLIC_IP>
```

**Option 3 — SSH from Windows (PowerShell)**
```powershell
ssh -i C:\Users\YourName\.ssh\sentinal-key.pem ubuntu@<EC2_PUBLIC_IP>
```

> If SSH times out: Security Group → check port 22 is open to `0.0.0.0/0` (not "My IP").

---

## PART C — One-Command Deploy

```bash
curl -s https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/deploy.sh | bash
```

Or clone first:
```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git && cd SENTINAL
chmod +x deploy.sh && ./deploy.sh
```

**What `deploy.sh` does automatically:**

1. Auto-detects EC2 public IP
2. `apt install` — Node.js 20, Python3, venv, pip, build tools, libpcap, PM2, serve
3. `git clone` repo (or `git pull` if exists)
4. Creates Python `.venv` + `pip install -r requirements.txt` for all 3 Python services
5. `npm install` for `backend/` + `dashboard/`
6. Creates `.env` — auto-sets `PUBLIC_URL`, `JWT_SECRET`, `API_SECRET`, `NODE_ENV=production`
7. **Prompts once for `MONGO_URI`**
8. Writes `dashboard/.env.production` with EC2 IP
9. Rewrites `ecosystem.config.js` with absolute `.venv` Python paths
10. `npm run build` on dashboard
11. `pm2 start ecosystem.config.js` → 4 backend services
12. `pm2 start "serve -s dist -l 5173"` → dashboard
13. `pm2 save`
14. Health checks + prints Atlas IP allowlist reminder

**Total time: ~10–12 minutes on fresh Ubuntu instance.**

---

## PART D — Provide MONGO_URI When Prompted

The script pauses and asks:
```
Paste your MONGO_URI:
```

Get from MongoDB Atlas → cluster → **Connect** → **Drivers**:
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/sentinal
```

> ⚠️ Save this URI somewhere safe. You need it every new AWS Academy session.

---

## PART E — Update MongoDB Atlas IP Allowlist

After `deploy.sh` completes, **immediately**:
1. Go to [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**
2. Delete old IP entry → **Add IP Address** → enter the EC2 IP shown by deploy.sh → **Confirm**
3. Wait 30 seconds

> Without this, Gateway returns HTTP 000 — cannot connect to MongoDB.

---

## PART F — Verify Everything Is Running

```bash
pm2 list
# All 5 services: online

curl http://localhost:3000/health
curl http://localhost:8002/health
curl http://localhost:8003/health
curl http://localhost:8004/health

# ArmorIQ openclaw check
curl http://localhost:8004/health
# Must return: { "openclaw_loaded": true, "enforcement": "ArmorClaw-v1" }
```

```
Dashboard:        http://<EC2_IP>:5173
Attack Simulator: http://<EC2_IP>:5173/simulate
API Health:       http://<EC2_IP>:3000/health
```

---

## Update Scenarios

### Scenario 1 — Backend-only change
```bash
cd ~/SENTINAL && git pull origin main
pm2 restart sentinal-gateway     # if backend/ changed
pm2 restart sentinal-detection   # if services/detection-engine/ changed
pm2 restart sentinal-pcap        # if services/pcap-processor/ changed
pm2 restart sentinal-armoriq     # if services/sentinal-response-engine/ changed
pm2 save
```

### Scenario 2 — Dashboard (React/JSX) files changed
```bash
cd ~/SENTINAL && git pull origin main
cd ~/SENTINAL/dashboard && npm run build
pm2 restart sentinal-dashboard && pm2 save
```

### Scenario 3 — New npm packages (package.json changed)
```bash
cd ~/SENTINAL && git pull origin main
cd ~/SENTINAL/backend && npm install --omit=dev
pm2 restart sentinal-gateway && pm2 save
```

### Scenario 4 — New Python packages (requirements.txt changed)
```bash
cd ~/SENTINAL && git pull origin main
source ~/SENTINAL/services/detection-engine/.venv/bin/activate
pip install -r ~/SENTINAL/services/detection-engine/requirements.txt -q
deactivate
# Repeat for other services if their requirements.txt changed
pm2 restart sentinal-detection && pm2 save
```

### Scenario 5 — Full update (safest)
```bash
cd ~/SENTINAL && git pull origin main
cd ~/SENTINAL/dashboard && npm run build
cd ~/SENTINAL && pm2 restart all && pm2 save
pm2 list && curl http://localhost:3000/health
```

### Update Cheat Sheet

| What changed | Commands needed |
|--------------|-----------------|
| `backend/` JS only | `git pull` → `pm2 restart sentinal-gateway` → `pm2 save` |
| `services/detection-engine/` | `git pull` → `pm2 restart sentinal-detection` → `pm2 save` |
| `services/pcap-processor/` | `git pull` → `pm2 restart sentinal-pcap` → `pm2 save` |
| `services/sentinal-response-engine/` or `policy.yaml` | `git pull` → `pm2 restart sentinal-armoriq` → `pm2 save` |
| `dashboard/src/` React/JSX | `git pull` → `npm run build` (in dashboard/) → `pm2 restart sentinal-dashboard` → `pm2 save` |
| `backend/package.json` new dep | `git pull` → `npm install --omit=dev` (in backend/) → `pm2 restart sentinal-gateway` → `pm2 save` |
| `*/requirements.txt` new dep | `git pull` → activate venv → `pip install -r requirements.txt` → deactivate → `pm2 restart <service>` → `pm2 save` |
| Multiple / unsure | `git pull` → `npm run build` (dashboard) → `pm2 restart all` → `pm2 save` |

---

## PART H — Day-to-Day Operations

```bash
# Status
pm2 list
./status.sh

# Logs
pm2 logs sentinal-gateway
pm2 logs sentinal-detection
pm2 logs sentinal-pcap
pm2 logs sentinal-armoriq
pm2 logs sentinal-dashboard
pm2 logs --lines 50 --nostream

# Restart single
pm2 restart sentinal-gateway

# Restart all
pm2 restart all
./start.sh

# Stop all
./stop.sh
pm2 stop all

# Recover after reboot
pm2 resurrect
# OR
pm2 start ~/SENTINAL/ecosystem.config.js
pm2 start "serve -s dist -l 5173" --name sentinal-dashboard --cwd ~/SENTINAL/dashboard
pm2 save
```

---

## PART I — Known Issues & Fixes

| Issue | Fix Applied |
|-------|-------------|
| `validate-env.sh` broken `cd` on line 30 | Rewrote with correct `$(dirname "${BASH_SOURCE[0]}")/..` |
| `.env` had `MONGO_URL` instead of `MONGO_URI` | Renamed — Joi validator requires `MONGO_URI` |
| `api.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_API_URL` |
| `socket.js` hardcoded `localhost:3000` | Now reads `import.meta.env.VITE_SOCKET_URL` |
| `ecosystem.config.js` corrupted | `deploy.sh` rewrites it with absolute `.venv` paths |
| Dashboard `Network Error` in prod | Fixed by `dashboard/.env.production` with EC2 IP |
| Gateway HTTP 000 after deploy | MONGO_URI was stale — must paste correct Atlas URI |
| EC2 Instance Connect failing | Reboot instance → try again |
| SSH connection timeout | Security Group port 22 source was `My IP` — change to `0.0.0.0/0` |
| Dashboard not reflecting new code after git pull | Must run `npm run build` in `dashboard/` then `pm2 restart sentinal-dashboard` |
| Python service not reflecting new code after git pull | Run `pm2 restart <service-name>` — venv does not need rebuild unless requirements.txt changed |
