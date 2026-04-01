# 📬 SENTINAL — API Reference

Base URL: `http://localhost:3000` (local) or `http://98.92.84.165:3000` (live)

All responses follow:
```json
{ "success": true, "message": "...", "data": { ... } }
```

---

## 🔒 Blocklist

### GET /api/blocklist
Returns all currently active blocked IPs.

**Response:**
```json
[
  {
    "_id": "...",
    "ip": "203.0.113.99",
    "reason": "Human approved rate_limit_ip",
    "attackType": "brute_force",
    "blockedAt": "2026-04-01T05:45:58.313Z",
    "expiresAt": "2026-04-01T06:45:58.313Z",
    "blockedBy": "human-dashboard"
  }
]
```

---

### POST /api/blocklist
Manually block an IP.

**Body:**
```json
{
  "ip": "203.0.113.99",
  "reason": "Too many attacks",
  "durationMinutes": 60,
  "blockedBy": "human-dashboard"
}
```
`durationMinutes: 0` = permanent block.

---

### DELETE /api/blocklist/:ip
Unblock an IP immediately.

**Example:** `DELETE /api/blocklist/203.0.113.99`

---

### GET /api/blocklist/check/:ip
Check if a specific IP is blocked.

**Response:**
```json
{ "blocked": true, "reason": "Too many attacks", "expiresAt": "..." }
```

---

## ⚔️ Attacks

### GET /api/attacks/recent?limit=50
Get recent detected attacks.

### GET /api/attacks/:id/forensics
Get detailed forensic data for a specific attack.

---

## 🚨 Alerts

### GET /api/alerts?limit=50
Get recent alerts (high/critical severity events).

### PATCH /api/alerts/:id/read
Mark an alert as read.

---

## ⏳ Action Queue (Nexus)

### GET /api/actions/pending
Get all pending Nexus-proposed actions awaiting human review.

**Response:**
```json
[
  {
    "_id": "...",
    "action": "permanent_ban_ip",
    "ip": "203.0.113.99",
    "agentReason": "Critical confidence brute_force",
    "blockedReason": "Irreversible — requires human authorization",
    "status": "pending",
    "createdAt": "..."
  }
]
```

---

### POST /api/actions/:id/approve
Approve a pending action. For `permanent_ban_ip` / `rate_limit_ip`, this immediately writes to BlockedIP.

**Body:**
```json
{ "approvedBy": "human" }
```

**Response:**
```json
{
  "success": true,
  "message": "Action approved and executed",
  "execution": {
    "success": true,
    "detail": "203.0.113.99 written to BlockedIP — PERMANENT"
  }
}
```

---

### POST /api/actions/:id/reject
Reject a pending action (no block applied).

**Body:**
```json
{ "rejectedBy": "human" }
```

---

## 📋 Audit Log

### GET /api/audit?limit=50
Get the full audit trail of all approve/reject/block actions.

---

## 📊 Stats & Health

### GET /api/stats
Get dashboard stats: total attacks, blocked IPs, alerts, severity breakdown.

### GET /api/health
Gateway health check.

### GET /api/service-status
Health status of all microservices (Detection, Nexus, PCAP).

---

## 📁 Logs

### GET /api/logs/recent?limit=50
Get recent raw HTTP request logs.

---

## 📦 PCAP

### POST /api/pcap/upload
Upload a `.pcap` file for analysis.

**Body:** `multipart/form-data`
- `pcap` — the `.pcap` file
- `projectId` — string identifier

---

## 🤖 Gemini AI

### POST /api/gemini/chat
Single-shot or multi-turn security Q&A.

**Body:**
```json
{
  "message": "What are the top 3 attacked IPs this week?",
  "history": [
    { "role": "user", "text": "previous question" },
    { "role": "model", "text": "previous answer" }
  ]
}
```

---

### GET /api/gemini/chat/stream?message=...&history=...
Streaming version. Returns Server-Sent Events:
```
data: {"type":"chunk","text":"..."}
data: {"type":"done","suggestions":[...]}
```

---

### POST /api/gemini/report/:attackId
Generate an AI report for a specific attack.

**Body:**
```json
{ "reportType": "technical" }
```
`reportType` options: `technical` | `executive` | `forensic`

---

### POST /api/gemini/correlate
Run AI cross-attack pattern correlation across all recent events.

---

### POST /api/gemini/mutate
Generate attack payload variants (for security testing).

**Body:**
```json
{ "payload": "' OR 1=1--", "attackType": "sqli" }
```

---

## 🧪 Nexus Demo Trigger

### POST /api/nexus/trigger
Simulate an attack to test the full detection → Nexus → action queue pipeline.

**Body:**
```json
{
  "ip": "203.0.113.99",
  "attackType": "brute_force",
  "severity": "critical",
  "confidence": 0.97,
  "status": "successful"
}
```

**Valid attackTypes:** `sqli`, `xss`, `traversal`, `command_injection`, `ssrf`, `lfi_rfi`, `brute_force`, `hpp`, `xxe`, `webshell`, `unknown`

**Valid severities:** `low`, `medium`, `high`, `critical`
