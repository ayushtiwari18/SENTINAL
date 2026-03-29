# SPONSOR_TRACK_REPORT — SENTINAL @ HackByte 4.0

> **Tracks Targeted:** ArmorIQ · MongoDB Atlas · Vultr · Google Gemini · General Championship

| Track | Status |
|-------|--------|
| ArmorIQ Claw & Shield | ✅ BUILT |
| MongoDB Atlas | 🟡 90% there |
| Vultr | 🔴 NOT STARTED |
| Google Gemini | 🔴 NOT STARTED |
| General Championship | 🟡 STRONG |

---

## TRACK 1 — ArmorIQ Claw & Shield ($109 / ₹10,000)

### What They Want

Build an autonomous agent that operates inside enforced intent boundaries. Not just a chatbot. A real agent that executes actions, but only within a declared policy. They want to see:

- A structured intent model
- Policy-based runtime enforcement using ArmorClaw
- Clean separation between reasoning and execution
- One action that is **allowed** and executes
- One action that is **deterministically blocked**
- Every decision logged with the rule that fired

### What You Have Built (COMPLETE ✅)

| Requirement | File | Status |
|-------------|------|--------|
| Structured intent model | `services/sentinal-response-engine/models.py` → `IntentModel`, `ProposedAction`, `DecisionModel` | ✅ DONE |
| Policy-based enforcement | `services/sentinal-response-engine/openclaw_runtime.py` → 5-rule evaluation chain | ✅ DONE |
| Declarative policy file | `services/sentinal-response-engine/policy.yaml` → `allowed_actions`, `blocked_actions`, `risk_rules` | ✅ DONE |
| Reasoning vs execution separation | `intent_builder.py` → `openclaw_runtime.py` → `executor.py` (3 separate files, 3 separate jobs) | ✅ DONE |
| Allowed action demo | `send_alert`, `log_attack`, `rate_limit_ip` → RULE_004 → ALLOW → executor fires | ✅ DONE |
| Blocked action demo | `permanent_ban_ip`, `shutdown_endpoint` → RULE_001 → BLOCK → ActionQueue | ✅ DONE |
| Enforcement logging | `audit_logger.py` → `POST /api/audit/ingest` → MongoDB `audit_logs` → Socket.io `audit:new` | ✅ DONE |
| Real execution | `executor.py` → `_send_alert()` hits real Gateway endpoint | ✅ DONE |
| Fallback safety | `_evaluate_with_fallback()` in `main.py` → `policy_engine.py` on crash | ✅ DONE |

### What Still Needs Fixing Before Demo

#### ⚠️ RISK 1 — `rate_limit_ip` only logs, doesn't call a real endpoint

Currently in `executor.py`:
```python
elif action == "rate_limit_ip":
    logger.info(f"[EXECUTOR] rate_limit_ip applied for ip=...")
    return True   # ← this is a log, not a real action
```
**Fix:** Make `rate_limit_ip` call a real Gateway endpoint. Even a stub route `POST /api/actions/rate-limit` that saves to MongoDB is enough. It just needs to be a real HTTP call, not a log line.

#### ⚠️ RISK 2 — AuditLog dashboard page must show `policy_rule_id` visibly

Judges will ask: *"Where can I see which rule fired?"* You need `RULE_001`, `RULE_004`, etc. visible as a column on `/audit` during the demo. Check `AuditLog.jsx` has this column rendered.

#### ⚠️ RISK 3 — Demo script must show BLOCK in under 30 seconds

Prepare this exact curl command:
```bash
curl -X POST http://localhost:8004/respond \
  -H "Content-Type: application/json" \
  -d '{
    "attackId": "demo-block-001",
    "ip": "6.6.6.6",
    "attackType": "sqli",
    "severity": "critical",
    "confidence": 0.97,
    "status": "successful"
  }'
```

Expected response judges must see:
```json
{
  "actionsExecuted": ["send_alert", "log_attack", "rate_limit_ip", "flag_for_review"],
  "actionsQueued": [
    { "action": "permanent_ban_ip", "decision": "BLOCK", "reason": "Irreversible — requires human authorization" },
    { "action": "shutdown_endpoint", "decision": "BLOCK", "reason": "Critical impact — requires human authorization" }
  ],
  "auditEntries": 6
}
```

Then open the dashboard. Judges see the ActionQueue badge go from `0 → 2` live.

### Demo Script (60 seconds, judge-facing)

> *"SENTINAL detects a critical SQL injection attack. It builds 6 response intents. It runs each through our OpenClaw runtime, which reads from this `policy.yaml` file. Low-risk actions like `send_alert` execute immediately. But `permanent_ban_ip` — which is irreversible — gets deterministically blocked. You can see it here in the action queue, with the exact policy rule that blocked it: **RULE_001**. The analyst can approve or reject. Every decision is in the audit log with the timestamp and enforcement level."*

Point to terminal showing: `[OPENCLAW] permanent_ban_ip → BLOCK (RULE_001)`

---

## TRACK 2 — MongoDB Atlas (M5Stack IoT Kit per team member)

### What They Want

- Cloud Atlas connection (`mongodb+srv://`)
- Data that makes sense for Atlas (not just basic CRUD)
- Bonus: Atlas Search, Time Series, Charts, Vector Search
- Good data model with real relationships

### What You Have (90% there 🟡)

| Component | Status | Detail |
|-----------|--------|--------|
| MongoDB integration | ✅ DONE | Mongoose in `backend/package.json`, 6 real collections |
| Data model quality | ✅ STRONG | `AttackEvent`, `AuditLog`, `ActionQueue`, `Alert`, `ServiceStatus`, `SystemLog` with real relationships |
| Atlas connection | 🔴 NOT DONE | `MONGO_URI=mongodb://localhost:27017/sentinel` — this is **LOCAL**, not Atlas |
| Atlas cloud | 🔴 NOT DONE | No `mongodb+srv://` URI anywhere in the repo |

### What You Must Do — 3 Steps (30 minutes total)

#### Step 1 — Switch to Atlas (10 minutes)

1. Go to [mongodb.com/atlas](https://mlh.link/mongodb) → sign up free (no credit card)
2. Create a free M0 cluster
3. Get your connection string: `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/sentinel`
4. Update `backend/.env`:
```
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/sentinel
```
5. Whitelist `0.0.0.0/0` in Atlas Network Access for demo

Your `database.js` already uses `process.env.MONGO_URI` — zero code changes needed.

#### Step 2 — Add Atlas Search (20 minutes, high judge impact)

In Atlas UI:
1. Go to your cluster → **Search** → **Create Index**
2. Collection: `attackevents`, Index name: `payload_search`
3. Use default dynamic mapping

Then add one search route:
```js
// backend/src/routes/attacks.js — add this route
GET /api/attacks/search?q=union+select
// Uses Atlas Search aggregation pipeline
// This is a premium Atlas feature — judges LOVE seeing it
```

#### Step 3 — Show Atlas in the Demo

Open the Atlas web UI on a second screen during the demo. Show:
- Real-time data appearing in Atlas as attacks are detected
- The `attackevents` collection growing live
- Atlas Charts (free, built-in) showing attack distribution

### Why You Win vs Other Teams

Most teams use `mongoose + localhost`. You already have a production-grade 6-collection schema with real relationships and audit trails. **The only thing separating you from winning is switching the connection string to `mongodb+srv://`.** Do it first thing at the hackathon.

---

## TRACK 3 — Vultr (Portable Projectors for team)

### What They Want

- Real deployment on Vultr (not localhost)
- Live URL judges can access
- Scalable cloud setup
- Bonus: Vultr Cloud GPU for AI workloads, one-click deployment

### Deployment Plan — SENTINAL on Vultr (2 hours)

#### Architecture on Vultr

```
Vultr Cloud Compute ($6/month, 1 CPU, 1GB RAM — free credits cover this)
─────────────────────────────────────────────────────
  Ubuntu 22.04 VPS
  ├── PM2 → Node.js Gateway (port 3000)
  ├── uvicorn → Detection Engine (port 8002)
  ├── uvicorn → PCAP Processor (port 8003)
  ├── uvicorn → SENTINAL Response Engine (port 8004)
  └── Nginx → Reverse proxy → ports 3000/5173

Vultr Object Storage (optional, PCAP file uploads)
MongoDB Atlas (external)
Vercel or Vultr static → React Dashboard
```

#### Step 1 — Sign up + get credits (5 minutes)

1. Go to [mlh.link/vultr](https://mlh.link/vultr)
2. Sign up, claim free cloud credits
3. Create a Cloud Compute instance: Ubuntu 22.04, $6/month plan

#### Step 2 — Server setup (30 minutes)

```bash
# On Vultr VPS
sudo apt update && sudo apt install -y nodejs npm python3-pip nginx git
npm install -g pm2
git clone https://github.com/ayushtiwari18/SENTINAL
cd SENTINAL

# Backend
cd backend && npm install
cp .env.example .env  # fill in MONGO_URI (Atlas URI)
pm2 start server.js --name sentinel-gateway

# Detection Engine
cd services/detection-engine
pip3 install -r requirements.txt
pm2 start "uvicorn app.main:app --port 8002" --name detection-engine

# SENTINAL Response Engine
cd services/sentinal-response-engine
pip3 install -r requirements.txt
pm2 start "uvicorn main:app --port 8004" --name sentinal-response-engine

# PCAP Processor
cd services/pcap-processor
pip3 install -r requirements.txt
pm2 start "uvicorn main:app --port 8003" --name pcap-processor

pm2 save && pm2 startup
```

#### Step 3 — Nginx config (10 minutes)

```nginx
# /etc/nginx/sites-available/sentinel
server {
    listen 80;
    server_name <YOUR_VULTR_IP>;

    location /api      { proxy_pass http://localhost:3000; }
    location /socket.io { proxy_pass http://localhost:3000; }
    location /         { proxy_pass http://localhost:5173; }
}
```

#### Step 4 — Deploy Dashboard

```bash
cd dashboard
npm run build
# Push to Vercel (free, 2 minutes) or serve from Vultr
```

### What to Show Judges

- Open `http://<VULTR_IP>/` — live dashboard running on Vultr
- Open Vultr console on second screen — show the VPS, CPU/memory usage during attack demo
- Say: *"Every service runs on Vultr cloud compute. This is a production deployment, not localhost."*

---

## TRACK 4 — Google Gemini API (Google Swag Kits)

### What They Want

- Real Gemini API integration (not OpenAI, not GPT)
- Something that would be **significantly worse** without Gemini
- Creative or technically deep use

### Current State (Gap = explainer.py is a static dict)

```python
# CURRENT STATE — explainer.py (NOT Gemini, just a dict)
EXPLANATIONS = {
    "SQL Injection": {
        "what": "An attacker is injecting malicious SQL code...",
        ...
    }
}
```

Your detection engine already calls `explain()` for every detected threat. The response goes to the frontend `ForensicsDrawer`. Right now it returns a static template. Replace it with a live Gemini call.

### Implementation Plan (2–3 hours)

#### Step 1 — Get API Key (5 minutes)

1. Go to [mlh.link/gemini-quickstart](https://mlh.link/gemini-quickstart)
2. Create a Google AI Studio account
3. Generate a free Gemini API key
4. Add to `services/detection-engine/.env`:
```
GEMINI_API_KEY=your_key_here
```

#### Step 2 — Install SDK (2 minutes)

Add to `services/detection-engine/requirements.txt`:
```
google-generativeai==0.8.3
```

#### Step 3 — Rewrite `explainer.py`

```python
# services/detection-engine/app/explainer.py
# TODO: GEMINI INTEGRATION
#
# WHAT THIS DOES:
#   - Takes threat_type, rule_id, severity, ip, payload
#   - Calls Gemini Flash with a structured security analyst prompt
#   - Returns { summary, what_happened, potential_impact,
#               recommended_action, rule_triggered }
#
# SYSTEM PROMPT TO USE:
#   "You are a senior application security engineer.
#    Given an attack detection result, respond with EXACTLY this JSON:
#    {
#      summary: '5-word attack summary',
#      what_happened: '1 sentence — what the attacker tried',
#      potential_impact: '1 sentence — what damage could occur',
#      recommended_action: '1 sentence — exact code fix with example'
#    }
#    Be concise. Developer audience, not security PhD."
#
# MODEL: gemini-1.5-flash (fast, cheap, perfect for this)
# FALLBACK: if Gemini call fails, fall back to static dict
#           so detection engine NEVER fails because of Gemini being down
#
# IMPLEMENTATION STEPS:
#   1. import google.generativeai as genai
#   2. genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
#   3. model = genai.GenerativeModel("gemini-1.5-flash")
#   4. Build user message with: threat_type, severity, ip, rule_id, payload
#   5. Call model.generate_content(prompt)
#   6. Parse JSON from response.text
#   7. Return structured dict
#   8. Wrap entire call in try/except → fallback to static dict on failure
#
# WHERE IT IS CALLED:
#   services/detection-engine/app/main.py line ~65:
#   explanation = explain(threat_type=..., rule_id=..., severity=..., ip=...)
#   The return value goes directly into API response → ForensicsDrawer on dashboard
#
# DEMO VALUE:
#   Judges see a DIFFERENT, contextually accurate explanation for each attack.
#   SQLi on /login gets different advice than SQLi on /api/search.
#   Gemini understands the URL context. Static dict does not.
```

#### Step 4 — Threat Intelligence Chat (BONUS — high judge impact)

Add a second Gemini integration: a simple chat endpoint where analysts can ask questions about an attack.

```
POST /api/attacks/:id/chat
Body:     { "question": "What should I do about this attack?" }
Response: { "answer": "..." }  ← powered by Gemini with full attack context
```

### What to Show Judges

1. Trigger a SQLi attack
2. Click the attack in the dashboard → `ForensicsDrawer` opens
3. Point to the explanation panel: *"This explanation was generated live by Gemini Flash. It has read the actual URL, payload, and response code and given context-specific advice — not a generic template."*
4. Show two different attacks have two different explanations
5. (If built) Ask chat: *"Is this attacker likely automated or human?"* and show Gemini's answer

---

## TRACK 5 — General Championship ($390 / $279 / $167)

### Why SENTINAL Is a Strong General Contender

You have a genuine production-grade microservices system with 5 services, real-time data, autonomous agents, policy enforcement, and forensics. Most hackathon teams build a CRUD app or a chatbot. You built a security platform with:

- **Custom OpenClaw runtime** (nobody else has this)
- **Intent-boundary enforcement** (novel concept at a hackathon)
- **Multi-layer attack detection** (rules + adversarial decoder + scoring)
- **Human-in-the-loop** for irreversible actions
- **Real-time Socket.io audit trail**
- **PCAP forensics**

### The 30-Second Pitch

> *"Any developer adds one line to their Express app. From that moment, every attack is detected in real time, automatically responded to within enforced policy boundaries — and dangerous actions always require human approval. This is SENTINAL."*

### 5 Signals Judges Vote On

| Signal | How SENTINAL Demonstrates It |
|--------|------------------------------|
| Technical depth | 5 microservices, OpenClaw runtime, 11 attack types, adversarial decoder |
| Real-world use | `sentinel-middleware` installed in `demo-target` — literally 2 lines |
| Demo quality | `attack.sh` fires 7 attacks, dashboard updates live, ActionQueue fills up |
| Innovation | Intent-boundary enforcement at a hackathon is genuinely original |
| Code quality | Clean repo structure, typed Pydantic models, fallback safety, 30+ tests passing |

### General Track Demo Script (3 minutes)

```
0:00 — "This is a real Express app. It has one line added — sentinel-middleware."
0:15 — Run attack.sh — show attacks appearing on dashboard live
0:45 — "The detection engine classified that as SQL injection, confidence 0.94."
1:00 — Click ForensicsDrawer — show raw request, attack chain, explanation
1:20 — Point to ActionQueue — "permanent_ban_ip was proposed by the agent,
        but blocked by our OpenClaw policy. Irreversible actions require a human."
1:40 — Click Approve — show APPROVED in audit log
2:00 — Upload a .pcap — show forensics running on historical traffic
2:30 — "This is deployed on Vultr. MongoDB Atlas. Gemini for AI explanations."
2:50 — "One line of code. Full threat visibility. Agent with enforced boundaries."
```

---

## COMBINED IMPLEMENTATION PRIORITY

Execute in this exact order. Do not deviate.

### PRIORITY 0 — Do this first, everything depends on it

- [ ] Switch `MONGO_URI` to MongoDB Atlas (`mongodb+srv://`)
  - File: `backend/.env`
  - Time: 10 minutes
  - Impact: Unlocks MongoDB Atlas track + makes Vultr deploy work

### PRIORITY 1 — Biggest impact per hour

- [ ] Deploy to Vultr
  - Steps: Sign up → create VPS → install deps → PM2 → Nginx
  - Time: 2 hours
  - Impact: Unlocks Vultr track + makes everything look real for General

### PRIORITY 2 — Gemini integration

- [ ] Rewrite `explainer.py` to use Gemini Flash
  - File: `services/detection-engine/app/explainer.py`
  - Add: `google-generativeai` to `requirements.txt`
  - Add: `GEMINI_API_KEY` to `.env`
  - Time: 2–3 hours
  - Impact: Unlocks Gemini track + makes ForensicsDrawer dramatically better

### PRIORITY 3 — ArmorIQ demo polish

- [ ] Make `rate_limit_ip` call real Gateway endpoint (not just a log)
  - File: `services/sentinal-response-engine/executor.py`
  - Time: 30 minutes
  - Impact: Closes the one real gap judges could flag

- [ ] Verify `AuditLog.jsx` shows `policy_rule_id` column
  - File: `dashboard/src/pages/AuditLog.jsx`
  - Time: 20 minutes
  - Impact: Judges need to SEE the rule that fired

### PRIORITY 4 — MongoDB Atlas bonus features

- [ ] Add Atlas Search index on `attackevents.payload` (in Atlas web UI, no code)
  - Time: 15 minutes
  - Impact: Premium Atlas feature, judges notice

- [ ] Add `GET /api/attacks/search?q=` route using Atlas Search aggregation
  - File: `backend/src/routes/attacks.js`
  - Time: 45 minutes
  - Impact: Visible search feature in demo

### PRIORITY 5 — Demo polish

- [ ] Verify `demo-target/attack.sh` runs cleanly
- [ ] Have all 4 judge demo curl commands ready in a text file
- [ ] Open Vultr dashboard + Atlas dashboard on separate browser tabs for demo
- [ ] Rehearse the 3-minute General Championship pitch 3 times

---

## TRACK TARGETING SUMMARY

| Track | Prize | Current State | Gap | Win Probability |
|-------|-------|---------------|-----|-----------------|
| ArmorIQ Claw & Shield | ₹10,000 | ✅ BUILT | Minor: executor + audit UI | **HIGH** |
| MongoDB Atlas | IoT Kit × team | 🟡 90% | Switch connection string | **HIGH** (after 10 min fix) |
| Vultr | Portable Projectors × team | 🔴 0% | Deploy to Vultr VPS | **MEDIUM** (2 hr work) |
| Google Gemini | Google Swag Kit | 🔴 0% | Rewrite `explainer.py` | **MEDIUM** (3 hr work) |
| General Championship | $390–$167 | 🟡 STRONG | Polish + story | **MEDIUM-HIGH** |

---

> **Bottom line:** You are already winning ArmorIQ. MongoDB takes 10 minutes. Vultr takes 2 hours. Gemini takes 3 hours. All four tracks are reachable in one hackathon session. **Execute in the priority order above.**
