# 07 — AWS Academy — Every Session Checklist

> Source: `MASTER_REFERENCE.md` §15 · Last verified: 2026-03-28
>
> AWS Academy labs auto-terminate after ~4 hours.
> Every session = fresh Ubuntu instance + new IP.
> MongoDB Atlas data **persists**. EC2 data does **not**.

---

## What Changes Each Session

| Item | Persists? | Action needed |
|------|-----------|---------------|
| EC2 instance | ❌ Gone | Launch new instance |
| Public IP | ❌ Changes | Get new IP from console |
| All installed software | ❌ Gone | `deploy.sh` reinstalls everything |
| `.env` file | ❌ Gone | `deploy.sh` recreates (prompts MONGO_URI) |
| MongoDB Atlas data | ✅ Persists | Just update IP allowlist |
| GitHub repo code | ✅ Persists | `deploy.sh` clones latest |
| `.pem` key | ✅ Persists (if same key pair) | Reuse existing `sentinal-key` |

---

## Every New Session — 4 Steps

### Step 1 — Launch EC2 Instance
- AWS Console → EC2 → Launch Instance
- Ubuntu 22.04, t2.medium (or t3.micro), key pair: `sentinal-key` (existing)
- Security Group: all 6 ports — 22, 3000, 5173, 8002, 8003, 8004 — source `0.0.0.0/0`
- Storage: 20 GB gp3
- Wait 2 min → copy Public IPv4

### Step 2 — Connect
- **Recommended:** Instance → **Connect** → **EC2 Instance Connect** → **Connect**
- SSH fallback: `ssh -i ~/.ssh/sentinal-key.pem ubuntu@<NEW_IP>`

### Step 3 — Run Deploy Script
```bash
curl -s https://raw.githubusercontent.com/ayushtiwari18/SENTINAL/main/deploy.sh | bash
```
- When prompted: paste your `MONGO_URI` from MongoDB Atlas
- Script auto-sets everything else (IP, JWT_SECRET, API_SECRET, dashboard build)

### Step 4 — Update MongoDB Atlas IP
- [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**
- Delete old IP entry → **Add IP Address** → enter IP shown by deploy.sh → **Confirm**
- Wait 30 seconds → verify: `curl http://localhost:3000/health`

✅ Done. Dashboard live at `http://<NEW_IP>:5173`

---

## Getting Your MONGO_URI (save this string)

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Click your cluster → **Connect** → **Drivers**
3. Copy the string:
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/sentinal
```
4. Replace `<password>` with your actual Atlas password
5. **Save this string** — you need it every session

---

## Session Troubleshooting

| Problem | Fix |
|---------|-----|
| EC2 Instance Connect fails | Reboot instance → try again |
| SSH times out | Security Group → Port 22 → change source to `0.0.0.0/0` |
| Gateway HTTP 000 after deploy | Wrong/empty MONGO_URI → `nano ~/SENTINAL/.env` → fix MONGO_URI → `pm2 restart sentinal-gateway` |
| Services stopped | `pm2 resurrect` or `cd ~/SENTINAL && pm2 start ecosystem.config.js` |
| Dashboard shows Network Error | `nano ~/SENTINAL/dashboard/.env.production` → update IP → `cd dashboard && npm run build` → `pm2 restart sentinal-dashboard` |
| Atlas connection refused | IP allowlist not updated → Atlas → Network Access → add current EC2 IP |
| `pm2 list` shows errored/stopped | Check logs: `pm2 logs --lines 30` → likely MONGO_URI or port conflict |
