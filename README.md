<div align="center">

# 🛡️ SENTINAL

**AI-Powered Web Application Firewall & Intrusion Detection System**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-98.92.84.165%3A5173-00d4aa?style=for-the-badge)](http://98.92.84.165:5173/dashboard)
[![Built for HackByte 4.0](https://img.shields.io/badge/HackByte-4.0-ff6b35?style=for-the-badge)](https://hackbyte.in)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb)](https://mongodb.com)

*Real-time attack detection → AI-powered response → Human-in-the-loop enforcement*

</div>

---

## 🎯 What is SENTINAL?

SENTINAL is a **production-grade, AI-augmented security platform** that sits in front of your web application and provides:

- 🔍 **Real-time traffic inspection** — every HTTP request scanned for SQLi, XSS, path traversal, command injection, brute force, and more
- 🤖 **AI threat scoring** — ML-based confidence scoring + Gemini AI forensic analysis
- ⚡ **Automated response** — low-risk threats handled autonomously; high-risk actions require human approval
- 🧠 **Nexus Policy Engine** — Python-based agent that enforces `rate_limit_ip`, `permanent_ban_ip`, `shutdown_endpoint` policies
- 👁️ **Live dashboard** — real-time WebSocket-powered React UI showing attacks, blocklist, audit logs, AI copilot
- 🚫 **IP Blocklist** — manual and automated blocking with TTL expiry, visible and manageable from the dashboard

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INCOMING TRAFFIC                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │   Node.js Gateway :3000  │  ← Express + Socket.IO
              │   (Middleware Layer)     │  ← BlockedIP Check (MongoDB)
              └────────────┬────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
  ┌────────▼───────┐  ┌───▼────┐  ┌──────▼───────┐
  │ Detection Eng. │  │MongoDB │  │  Nexus Engine │
  │  Python :8002  │  │ Atlas  │  │  Python :8004 │
  │  (ML Scoring)  │  │        │  │ (Policy Guard)│
  └────────────────┘  └───┬────┘  └──────────────┘
                           │
              ┌────────────▼────────────┐
              │   React Dashboard :5173  │
              │   (Vite + WebSocket)     │
              └─────────────────────────┘
```

> 📖 Full architecture details → [`Readme/ARCHITECTURE.md`](./Readme/ARCHITECTURE.md)

---

## 📁 Repository Structure

```
SENTINAL/
├── README.md                    # You are here
├── .env.example                 # Environment template
├── ecosystem.config.js          # PM2 process config
├── deploy.sh                    # One-command cloud deploy
├── start.sh / stop.sh           # Local start/stop scripts
│
├── Readme/                      # 📚 All documentation
│   ├── ARCHITECTURE.md          # System design + data flow
│   ├── API_REFERENCE.md         # Every API endpoint documented
│   ├── LOCAL_SETUP.md           # Step-by-step local setup
│   └── CODEBASE_GUIDE.md        # How the codebase is organized
│
├── backend/                     # Node.js Gateway (Express)
│   └── src/
│       ├── controllers/         # Route handlers
│       ├── middleware/          # BlockedIP check, request logger
│       ├── models/              # MongoDB schemas
│       ├── routes/              # API route definitions
│       ├── services/            # attackService, geminiService
│       ├── sockets/             # Socket.IO broadcast
│       └── utils/               # logger, eventEmitter
│
├── services/
│   ├── detection-engine/        # Python FastAPI — ML attack scoring
│   ├── nexus/                   # Python FastAPI — Policy Guard agent
│   └── pcap-processor/          # Python FastAPI — PCAP file analysis
│
├── dashboard/                   # React + Vite frontend
│   └── src/
│       ├── pages/               # Route-level components
│       ├── components/          # Shared UI components
│       ├── hooks/               # useSocket, custom hooks
│       └── services/api.js      # All API calls
│
├── demo-target/                 # Vulnerable Express app (for demos)
├── postman/                     # Postman collection for API testing
├── config/                      # PM2 / Nginx configs
└── scripts/                     # Utility scripts
```

---

## ⚡ Quick Start

### Cloud Deploy (Ubuntu VPS)
```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd SENTINAL
cp .env.example .env
nano .env   # fill in MONGODB_URI, GEMINI_API_KEY
bash deploy.sh
```

### Local Development
```bash
git clone https://github.com/ayushtiwari18/SENTINAL.git
cd SENTINAL && cp .env.example .env
# See Readme/LOCAL_SETUP.md for full steps
```

> 📖 Full setup guide → [`Readme/LOCAL_SETUP.md`](./Readme/LOCAL_SETUP.md)

---

## 🔌 Services & Ports

| Service | Tech | Port | Purpose |
|---|---|---|---|
| **Gateway** | Node.js / Express | `3000` | Main API, middleware, WebSocket |
| **Detection Engine** | Python / FastAPI | `8002` | ML-based attack classification |
| **PCAP Processor** | Python / FastAPI | `8003` | Network capture file analysis |
| **Nexus Engine** | Python / FastAPI | `8004` | Policy enforcement agent |
| **Dashboard** | React / Vite | `5173` | Web UI |

---

## 🔐 Attack Types Detected

| Attack | Detection Method | Auto-Response |
|---|---|---|
| SQL Injection | Pattern + ML scoring | `rate_limit_ip` |
| XSS | Pattern + ML scoring | `rate_limit_ip` |
| Path Traversal | Pattern matching | `rate_limit_ip` |
| Command Injection | Pattern + ML | `permanent_ban_ip` |
| Brute Force | Rate analysis | `rate_limit_ip` |
| SSRF | Pattern matching | `rate_limit_ip` |
| XXE | XML inspection | `rate_limit_ip` |
| Webshell Upload | File analysis | `permanent_ban_ip` |

---

## 📊 Dashboard Pages

| Route | Page | Description |
|---|---|---|
| `/dashboard` | Dashboard | Live stats, attack feed, risk score |
| `/attacks` | Attacks | All detected attacks with forensics |
| `/alerts` | Alerts | High/critical severity notifications |
| `/action-queue` | Nexus Queue | Approve/reject AI-proposed actions |
| `/blocklist` | IP Blocklist | View, add, remove blocked IPs |
| `/audit` | Audit Log | Full action history trail |
| `/pcap` | PCAP Analyzer | Upload & analyze network captures |
| `/copilot` | AI Copilot | Gemini AI security assistant |
| `/correlation` | Correlation | AI cross-attack pattern analysis |
| `/simulate` | Simulate | Trigger test attacks for demo |
| `/services` | Services | Health status of all services |

---

## 📬 API Testing

Import the Postman collection to test all endpoints:

```
postman/SENTINAL_API.postman_collection.json
```

> 📖 Full API docs → [`Readme/API_REFERENCE.md`](./Readme/API_REFERENCE.md)

---

## 🛠️ Tech Stack

**Backend:** Node.js 18, Express 4, Socket.IO, Mongoose, Axios  
**AI Services:** Python 3.11, FastAPI, scikit-learn, Google Gemini 1.5 Pro  
**Frontend:** React 18, Vite, React Router v6, Axios  
**Database:** MongoDB Atlas (hosted) or local MongoDB 7  
**Process Manager:** PM2  
**Deployment:** Ubuntu 22.04 LTS, Nginx (optional)

---

## 📖 Documentation

| Doc | Description |
|---|---|
| [`Readme/ARCHITECTURE.md`](./Readme/ARCHITECTURE.md) | Full system design, data flow diagrams, MongoDB schemas |
| [`Readme/API_REFERENCE.md`](./Readme/API_REFERENCE.md) | Every endpoint, request/response format |
| [`Readme/LOCAL_SETUP.md`](./Readme/LOCAL_SETUP.md) | Step-by-step local development setup |
| [`Readme/CODEBASE_GUIDE.md`](./Readme/CODEBASE_GUIDE.md) | How the code is organized, key files explained |

---

<div align="center">

Built with ❤️ for **HackByte 4.0** · [Live Demo](http://98.92.84.165:5173/dashboard) · [GitHub](https://github.com/ayushtiwari18/SENTINAL)

</div>
