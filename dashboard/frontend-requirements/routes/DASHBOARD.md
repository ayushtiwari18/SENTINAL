# Route: `/dashboard` — Operations Dashboard

## Purpose
The main operational view for security engineers.
Real-time: shows live attack feed, system health, aggregate stats, and recent alerts.
This is the page that is open all day on a monitor.

## Inspiration
- Grafana dashboard (information density, no fluff)
- Datadog APM overview (tables + numbers, not cards)
- https://github.com/nicedoc/nicedoc (minimal dark data UI)

---

## Layout (responsive grid)

```
┌────────────────────────────────────────────┐
│ Navbar                                      │
├────────────────────────────────────────────┤
│ [SystemStatus 1/3]  [StatsPanel 2/3]       │
├────────────────────────────────────────────┤
│ LiveAttackFeed (full width)                 │
├────────────────────────────────────────────┤
│ AlertsPanel (full width)                    │
└────────────────────────────────────────────┘
```

---

## Components & Data Sources

### SystemStatus
- **API**: `GET /api/service-status`
- **Response shape**:
  ```json
  {
    "success": true,
    "data": {
      "overall": "healthy" | "degraded",
      "services": [
        { "service": "gateway", "status": "online", "responseTimeMs": 0 },
        { "service": "detection-engine", "status": "online" | "offline", "responseTimeMs": 142, "error": "..." },
        { "service": "pcap-processor", "status": "offline", ... },
        { "service": "armoriq-agent", "status": "offline", ... }
      ],
      "checkedAt": "2026-03-25T13:00:00.000Z"
    }
  }
  ```
- **EXACT KEY NAMES**: `data.overall`, `data.services[].service` (NOT `name`), `data.services[].status`, `data.services[].responseTimeMs`, `data.checkedAt`
- **WARNING**: The field is `service` not `name`. The existing SystemStatus component uses `svc.name` which is WRONG — must be `svc.service`.
- **Poll**: every 30s
- **Display**: table with status dot (green/red/orange), service name, latency

### StatsPanel
- **API**: `GET /api/stats`
- **Response shape**:
  ```json
  {
    "success": true,
    "data": {
      "totalLogs": 80,
      "totalAttacks": 50,
      "totalAlerts": 18,
      "unreadAlerts": 7,
      "attacksByType": { "sqli": 5, "xss": 8, "traversal": 3, ... },
      "attacksBySeverity": { "low": 10, "medium": 15, "high": 12, "critical": 13 },
      "recentAttacks": [ ...10 AttackEvent objects... ]
    }
  }
  ```
- **EXACT KEY NAMES**: `totalLogs`, `totalAttacks`, `totalAlerts`, `unreadAlerts`, `attacksByType`, `attacksBySeverity`
- **Severity keys inside `attacksBySeverity`**: `low`, `medium`, `high`, `critical`
- **Poll**: every 30s
- **Display**: 6 stat cards + 2 Recharts donut charts

### LiveAttackFeed
- **API**: `GET /api/attacks/recent?limit=20`
- **Socket**: `attack:new`
- **Socket payload**: `{ event: "attack:new", timestamp: "...", data: { id, ip, attackType, severity, status, detectedBy, confidence, timestamp } }`
- **AttackEvent fields**: `_id`, `requestId`, `ip`, `attackType`, `severity`, `status`, `detectedBy`, `confidence`, `payload`, `explanation`, `responseCode`, `createdAt`, `updatedAt`
- **Table columns**: Time (createdAt), IP, Attack Type, Severity, Status, Detected By, Confidence, [Forensics button]
- **On row click or forensics button**: navigate to `/attacks/:_id`
- **Poll**: every 30s
- **Animation**: new rows fade in from top (framer-motion)

### AlertsPanel
- **API**: `GET /api/alerts?limit=30`
- **Socket**: `alert:new`
- **Alert fields**: `_id`, `attackId`, `title`, `message`, `severity`, `type`, `isRead`, `createdAt`
- **`attackId` is populated**: `{ attackType, ip, status, confidence }`
- **Actions**: mark read — `PATCH /api/alerts/:id/read`
- **Poll**: every 30s

---

## Navbar for Dashboard
```
Left:  [Shield icon] SENTINAL
Links: Dashboard | Attacks | Alerts | Logs | Docs
Right: [Socket status dot: green if connected, red if not]
```

---

## Files
```
src/pages/Dashboard.jsx
src/components/dashboard/SystemStatus.jsx
src/components/dashboard/StatsPanel.jsx
src/components/dashboard/LiveAttackFeed.jsx
src/components/dashboard/AlertsPanel.jsx
```

---

## AI Build Instructions

```
You are building the Dashboard page for SENTINAL.
This is the main operational view used all day by security engineers.

Rules:
- Import all API functions from src/services/api.js
- Import socket from src/services/socket.js
- Use useApi hook for all polling data
- Use useSocket hook for socket events
- Every component shows loading state, error state, empty state
- Use Panel, StatCard, SeverityBadge, StatusDot from src/components/ui/
- Clicking a row in LiveAttackFeed navigates to /attacks/:_id using useNavigate
- Alert mark-read calls PATCH /api/alerts/:id/read via markAlertRead from api.js
- SystemStatus response: field is `svc.service` NOT `svc.name`
- Socket events are wrapped: read data from payload.data NOT payload directly
- All dates formatted using formatDate from src/utils/format.js
- Severity colors from SEVERITY_COLORS in src/utils/constants.js
- New attack rows animate in: framer-motion AnimatePresence + motion.tr
- Poll interval: 30000ms via useInterval hook
- Log all fetches and socket events to console
```
