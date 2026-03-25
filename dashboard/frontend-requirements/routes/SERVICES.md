# Route: `/services` — Service Health

## Purpose
Shows the live health status of all SENTINAL microservices.
Lets the operator know which services are online, offline, or degraded,
and how long each one took to respond last check.

## Inspiration
- https://vercel.com/status — minimal status page
- https://www.githubstatus.com — operational status layout
- https://grafana.com — service health view in ops dashboards

---

## Layout

```
[PageWrapper fade-in]

Page Title: "Service Health"
Subtitle: "Last checked: <checkedAt timestamp>"

[Overall status banner]
  → If overall = 'healthy':  green banner "All systems operational"
  → If overall = 'degraded': amber banner "Some services degraded"

[Services Table / Cards]
  Service Name | Status | Response Time | Error (if any) | Last Checked

[Health Panel]
  DB Status | Server Uptime | Server Timestamp
```

---

## Components

```
src/pages/Services.jsx              ← page root
src/components/dashboard/SystemStatus.jsx  ← reuse/extend (already exists)
src/components/ui/StatusDot.jsx     ← online/offline/degraded dot
src/components/ui/Panel.jsx
src/components/ui/LoadingState.jsx
src/components/ui/ErrorState.jsx
```

---

## API Calls

### Primary — Service Status
- **Endpoint**: `GET /api/service-status`
- **Function**: `getServiceStatus()` from `services/api.js`
- **Poll interval**: 30 seconds (use `useInterval`)
- **Socket**: `service:status` — payload: `{ event, timestamp, data: <service-status-object> }`

**Response shape**:
```json
{
  "overall":  "healthy" | "degraded",
  "services": [
    {
      "service":        "gateway",
      "status":         "online" | "offline",
      "responseTimeMs": 0,
      "error":          "ECONNREFUSED" // only if offline
    }
  ],
  "checkedAt": "ISO timestamp"
}
```

⚠️ **CRITICAL**: Field is `svc.service` NOT `svc.name`. This is a known bug in the existing SystemStatus.jsx — fix it here.

### Secondary — Server Health
- **Endpoint**: `GET /api/health`
- **Function**: `getHealth()` from `services/api.js`
- **Poll interval**: 30 seconds

**Response shape**:
```json
{
  "status":    "ok",
  "uptime":    342.5,
  "dbStatus":  "connected" | "disconnected",
  "timestamp": "ISO timestamp"
}
```

---

## Field Mapping

| UI Label | Source Field | Notes |
|----------|-------------|-------|
| Service Name | `svc.service` | NOT `svc.name` |
| Status | `svc.status` | `online`/`offline` — show `<StatusDot>` |
| Response Time | `svc.responseTimeMs` | Display as `0ms`, `142ms`, etc. Gateway always 0 |
| Error | `svc.error` | Only render if offline; otherwise hide cell |
| Overall status | `data.overall` | `healthy`/`degraded` — drive banner color |
| Last Checked | `data.checkedAt` | Use `formatDate(data.checkedAt)` |
| DB Status | `health.dbStatus` | `connected`/`disconnected` |
| Server Uptime | `health.uptime` | Format as `Xh Xm Xs` — compute from seconds |

---

## States

| State | Display |
|-------|---------|
| Loading | `<LoadingState message="Checking service health..." />` |
| Error (service-status) | `<ErrorState message="Could not reach gateway" onRetry={refetch} />` |
| All online | Green banner: "All systems operational" |
| Some offline | Amber banner: "Degraded — X of Y services offline" |
| DB disconnected | Show warning row in health panel |

---

## Service Name Display

Map internal names to human-readable labels:
```js
const SERVICE_LABELS = {
  'gateway':          'API Gateway',
  'detection-engine': 'Detection Engine',
  'pcap-processor':   'PCAP Processor',
  'armoriq-agent':    'ArmorIQ Agent',
};
```

---

## AI Build Instructions

```
You are building the Services health page for SENTINAL.

Rules:
- Route: /services
- Page title: "Service Health"
- Wrap in PageWrapper for fade-in transition
- Use AppLayout (Navbar + Footer already wraps this page via router)

Data:
1. Call getServiceStatus() on mount + every 30s (useInterval)
2. Call getHealth() on mount + every 30s
3. Listen to 'service:status' socket event → update service list in place
   Socket payload: { event, timestamp, data: <same shape as REST response> }
   Read payload.data, NOT payload directly

CRITICAL field name:
- Use svc.service for the service name — NOT svc.name
- The existing SystemStatus.jsx has this bug — fix it

Overall banner:
- If data.overall === 'healthy': green background, text "All systems operational"
- If data.overall === 'degraded': amber background, text count of offline services

Services table columns:
  Service Name | Status (StatusDot) | Response Time | Error | Last Checked

Health panel below table:
  DB: connected/disconnected | Uptime: Xh Xm Xs | Gateway time: formatDate(health.timestamp)

Uptime formatting:
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  // display as "2h 14m 33s"

Loading: <LoadingState message="Checking service health..." />
Error: <ErrorState message="Could not reach gateway" onRetry={refetch} />
Empty services array: <EmptyState message="No services found." />

Never hardcode service names or status. Drive everything from the API response.
```
