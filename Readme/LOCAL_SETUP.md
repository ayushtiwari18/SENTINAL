# 🚀 SENTINAL — Local Setup Guide

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | 18+ | `node --version` |
| Python | 3.11+ | `python3 --version` |
| MongoDB | Atlas (free tier) or local 7+ | — |
| Git | Any | `git --version` |

---

## Step 1 — Clone & Configure

```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd SENTINAL
cp .env.example .env
```

Edit `.env` and fill in:
```env
# Required
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/sentinal
GEMINI_API_KEY=your_gemini_api_key_here

# Optional (defaults shown)
PORT=3000
DETECTION_ENGINE_URL=http://localhost:8002
NEXUS_URL=http://localhost:8004
PCAP_URL=http://localhost:8003
BLOCK_DURATION_MINUTES=60
```

Get a free Gemini API key at: https://aistudio.google.com/app/apikey

---

## Step 2 — Install Dependencies

### Node.js Gateway
```bash
cd backend
npm install
cd ..
```

### React Dashboard
```bash
cd dashboard
npm install
cd ..
```

### Python Services
```bash
# Detection Engine
cd services/detection-engine
pip install -r requirements.txt
cd ../..

# Nexus Policy Engine
cd services/nexus
pip install -r requirements.txt
cd ../..

# PCAP Processor
cd services/pcap-processor
pip install -r requirements.txt
cd ../..
```

---

## Step 3 — Start All Services

### Option A — Using start.sh (recommended)
```bash
bash start.sh
```

### Option B — Manual (separate terminals)

**Terminal 1 — Gateway:**
```bash
cd backend && npm run dev
```

**Terminal 2 — Detection Engine:**
```bash
cd services/detection-engine
python3 main.py
```

**Terminal 3 — Nexus Engine:**
```bash
cd services/nexus
python3 main.py
```

**Terminal 4 — PCAP Processor:**
```bash
cd services/pcap-processor
python3 main.py
```

**Terminal 5 — Dashboard:**
```bash
cd dashboard && npm run dev
```

---

## Step 4 — Verify Everything is Running

Open in browser:

| Service | URL | Expected |
|---|---|---|
| Dashboard | http://localhost:5173 | SENTINAL UI |
| Gateway health | http://localhost:3000/health | `{"success":true}` |
| Detection Engine | http://localhost:8002/health | `{"status":"ok"}` |
| Nexus Engine | http://localhost:8004/health | `{"status":"ok"}` |
| PCAP Processor | http://localhost:8003/health | `{"status":"ok"}` |

---

## Step 5 — Test the Pipeline

Trigger a simulated attack to test the full pipeline:

```bash
curl -X POST http://localhost:3000/api/nexus/trigger \
  -H "Content-Type: application/json" \
  -d '{"ip":"10.0.0.1","attackType":"brute_force","severity":"critical"}'
```

Then check:
1. `/attacks` — attack should appear
2. `/action-queue` — `permanent_ban_ip` card should appear
3. Click **Approve** → check `/blocklist` — IP should appear

---

## Production Deploy (Ubuntu VPS)

```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd SENTINAL
cp .env.example .env && nano .env
bash deploy.sh
```

The deploy script installs Node.js, Python, PM2, all dependencies, and starts all 5 services.

**PM2 commands:**
```bash
pm2 list                        # see all processes
pm2 logs sentinal-gateway       # gateway logs
pm2 logs sentinal-Nexus         # nexus logs
pm2 restart sentinal-gateway    # restart after code change
pm2 restart all                 # restart everything
```

---

## Common Issues

| Problem | Cause | Fix |
|---|---|---|
| `MongoServerError: bad auth` | Wrong MongoDB URI | Check `.env` MONGODB_URI |
| Gateway starts but Nexus shows offline | Python service not running | `cd services/nexus && python3 main.py` |
| Approve action but IP not in blocklist | Gateway running old code | `pm2 restart sentinal-gateway` after `git pull` |
| Dashboard blank | Vite build issue | `cd dashboard && npm run build && npm run preview` |
| Port already in use | Old process running | `pm2 kill` then restart |
