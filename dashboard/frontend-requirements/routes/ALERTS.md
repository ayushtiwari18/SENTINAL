# Route: `/alerts` — Alert Management

## Purpose
Dedicated page for viewing and managing security alerts.
User can see all alerts, filter by severity/read-status, and mark them read.
High/critical alerts created automatically when attacks are detected.

---

## Layout

```
[Page title: Alerts]
[Summary bar: X total | X unread | X critical | X high]
[Filter: severity | read status]
[Alerts table]
```

---

## Data Source

- **API**: `GET /api/alerts?limit=50`
- **Socket**: `alert:new`
- **Response**: `{ success: true, data: Alert[] }`
- **Alert fields**:
  ```
  _id         string    MongoDB ObjectId
  attackId    object    Populated: { attackType, ip, status, confidence }
  title       string    e.g. "SQLI Detected"
  message     string    e.g. "critical severity attack from 192.168.1.101"
  severity    string    enum: low|medium|high|critical
  type        string    enum: attack_detected|service_down|rate_limit|anomaly
  isRead      boolean
  resolvedAt  string    ISO datetime or null
  meta        object    { attackType, confidence } — extra context
  createdAt   string    ISO datetime
  ```

- **PITFALL**: `attackId` is populated (joined) — access as `alert.attackId.attackType`, not `alert.attackType`
- **PITFALL**: `meta` may be empty `{}` — always optional-chain: `alert.meta?.confidence`

---

## Actions

| Action | API | When |
|--------|-----|------|
| Mark read | `PATCH /api/alerts/:id/read` | User clicks "Mark Read" |
| (Future) Resolve | not built yet | skip |

After marking read, update the alert in local state immediately (optimistic update).
Do not re-fetch entire list.

---

## Socket: `alert:new`

Payload shape:
```json
{
  "event": "alert:new",
  "timestamp": "2026-03-25T10:00:00.000Z",
  "data": {
    "id":        "ObjectId string",
    "title":     "XSS Detected",
    "severity":  "critical",
    "type":      "attack_detected",
    "timestamp": "2026-03-25T10:00:00.000Z"
  }
}
```

Read from `payload.data`, NOT `payload`.
New alert should appear at top with animation.
Pulse the unread count badge.

---

## Summary Bar

Calculate client-side from loaded data:
- Total: `alerts.length`
- Unread: `alerts.filter(a => !a.isRead).length`
- Critical: `alerts.filter(a => a.severity === 'critical').length`
- High: `alerts.filter(a => a.severity === 'high').length`

---

## Files
```
src/pages/Alerts.jsx
(reuse AlertsPanel component from dashboard, or build standalone table)
```

---

## AI Build Instructions

```
You are building the Alerts page for SENTINAL.
Route: /alerts

Data:
- Call getAlerts(50) from src/services/api.js on mount
- Listen to alert:new socket event via useSocket hook
- New socket alerts prepend to list, cap at 200

Field access:
- alert._id
- alert.attackId.attackType  (populated field — NOT alert.attackType)
- alert.attackId.ip          (populated field)
- alert.title
- alert.message
- alert.severity
- alert.type
- alert.isRead
- alert.createdAt
- alert.meta?.confidence     (optional chain — may be undefined)

Actions:
- Mark read: markAlertRead(alert._id) from api.js
- On success: setAlerts(prev => prev.map(a => a._id === id ? {...a, isRead: true} : a))
- Do NOT re-fetch entire list

Socket payload:
- Read from payload.data (NOT payload)
- payload.data.id is the alert id (NOT payload.data._id)

Pitfalls:
- alert.attackId is an OBJECT (populated), not a string ID
- If alert.attackId is null (edge case): guard with alert.attackId?.attackType ?? 'unknown'
- severity filter must match exact lowercase enum values
```
