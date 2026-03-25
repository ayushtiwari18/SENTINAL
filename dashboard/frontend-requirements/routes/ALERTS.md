# Route: `/alerts` — Alert Management

## Purpose
Full alert feed with unread count, severity filter, and mark-read actions.
The operator comes here to triage high/critical security alerts,
understand what happened, and mark them resolved.

## Inspiration
- https://linear.app/notifications — notification list, read/unread state
- https://vercel.com/notifications — alert inbox layout
- GitHub notification center — unread badge + mark-read pattern

---

## Layout

```
[PageWrapper fade-in]

Page Title: "Alerts"
Subtitle: "X unread"

[Action bar]
  [Filter: Severity (all / low / medium / high / critical)]
  [Filter: Type (all / attack_detected / service_down / rate_limit / anomaly)]
  [Filter: Read (all / unread / read)]
  [Button: Mark All Read] — only enabled when unread count > 0

[Alert Table / List]
  Time | Severity | Title | Type | Attack Link | Read | [Mark Read]

  - Time: formatDate(a.createdAt)
  - Severity: <SeverityBadge>
  - Title: plain text
  - Type: colored label
  - Attack Link: if attackId exists → link to /attacks/:attackId._id
  - Read: "yes" (muted) / "no" (red)
  - Mark Read button: only shown if !a.isRead

[Empty State]
  Unfiltered: "No alerts yet."
  Filtered: "No alerts match your filters."

[Unread count badge in Navbar]
  Navbar Alerts link shows badge: e.g. Alerts [3]
  Badge driven by socket alert:new events
```

---

## Component Tree

```
Alerts.jsx (page)
├── PageWrapper
├── action bar (filters + mark-all-read)
└── Panel (title: "Alert Feed")
    ├── LoadingState
    ├── ErrorState
    ├── EmptyState
    └── table
        └── AlertRow (motion.tr for new socket alerts)
            └── SeverityBadge
```

---

## API Calls

### Primary — Alert List
- **Endpoint**: `GET /api/alerts?limit=100`
- **Function**: `getAlerts(100)` from `services/api.js`
- **Poll interval**: 30 seconds (useInterval)
- **Socket**: `alert:new` — prepend new alert to top
  - Payload: `{ event, timestamp, data: { id, title, severity, type, timestamp } }`
  - Read `payload.data`, NOT `payload`
  - NOTE: Socket payload is partial — only `id, title, severity, type, timestamp`
  - Add `isRead: false` and normalize `_id: payload.data.id`

**Response shape** (`response.data.data` — array):
```json
[
  {
    "_id":       "ObjectId",
    "attackId":  { "_id": "ObjectId", "attackType": "sqli", "ip": "192.168.1.101", "status": "attempt", "confidence": 0.92 },
    "title":     "SQLI Detected",
    "message":   "high severity attack from 192.168.1.101",
    "severity":  "high",
    "type":      "attack_detected",
    "isRead":    false,
    "meta":      { "attackType": "sqli", "confidence": 0.92 },
    "createdAt": "ISO timestamp"
  }
]
```

### Mark Read — Single
- **Endpoint**: `PATCH /api/alerts/:id/read`
- **Function**: `markAlertRead(id)` from `services/api.js`
- **Do NOT re-fetch** after mark-read
- Update state: `setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a))`

### Mark All Read
- No dedicated API endpoint exists yet
- Call `markAlertRead` in sequence for all unread alerts
- Or: optimistically set all `isRead: true` locally + batch PATCH calls
- Show loading state on the button during calls

---

## Field Mapping

| UI Column | Source Field | Notes |
|-----------|-------------|-------|
| Time | `a.createdAt` | `formatDate(a.createdAt)` |
| Severity | `a.severity` | `<SeverityBadge>` |
| Title | `a.title` | plain text |
| Type | `a.type` | color-coded label (see TYPE_COLORS below) |
| Attack Link | `a.attackId._id` | Guard: `a.attackId?._id` — may be null |
| Message | `a.message` | secondary row info or tooltip |
| Read | `a.isRead` | `true` = muted "yes"; `false` = red "no" |
| Mark Read | `a._id` | Button: calls `markAlertRead(a._id)` |

### Alert Type Colors
```js
const TYPE_COLORS = {
  attack_detected: 'var(--color-critical)',
  service_down:    'var(--color-high)',
  rate_limit:      'var(--color-medium)',
  anomaly:         'var(--color-low)',
};
```

---

## States

| State | Display |
|-------|---------|
| Loading | `<LoadingState message="Loading alerts..." />` |
| Error | `<ErrorState message="Failed to load alerts" onRetry={refetch} />` |
| Empty (no alerts) | `<EmptyState message="No alerts yet." />` |
| Empty (filtered) | `<EmptyState message="No alerts match your filters." />` |
| New socket alert | Animate row in: `opacity 0→1`, `y -8→0`, `0.15s` |
| All read | Subtitle: "All caught up" in `--color-online` |

---

## ⚠️ Pitfalls

1. `a.attackId` is a **populated object**, not a string ID
   - Access as `a.attackId?.attackType` NOT `a.attackType`
   - May be `null` — always use optional chain
2. Socket `alert:new` payload has `id` NOT `_id` — normalize on arrival
3. Do NOT re-fetch the full list after marking read — update state locally
4. Socket alert payload does NOT include `attackId`, `message`, `isRead` — add defaults
5. `a.meta?.confidence` may be undefined — optional chain

---

## AI Build Instructions

```
You are building the Alerts page for SENTINAL.

Route: /alerts
Wrap in PageWrapper. AppLayout wraps via router.

Data:
1. Call getAlerts(100) on mount + every 30s (useInterval)
2. Listen to 'alert:new' socket → prepend to top
   Read payload.data (NOT payload)
   Socket payload shape: { id, title, severity, type, timestamp }
   Normalize on arrival: { ...payload.data, _id: payload.data.id, isRead: false }
   NOTE: attackId and message are NOT in socket payload — set as null

Filtering (client-side):
- severity select (all / low / medium / high / critical)
- type select (all / attack_detected / service_down / rate_limit / anomaly)
- read state select (all / unread / read)

Mark Read (single):
  - Call markAlertRead(a._id)
  - On success: update local state, do NOT refetch
  - setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a))

Mark All Read:
  - Loop unread alerts and call markAlertRead for each
  - Show button as loading/disabled during loop
  - Update local state on completion

Table columns:
  Time | Severity (SeverityBadge) | Title | Type (colored) | Attack (link if exists) | Read | [Mark Read btn]

Unread rows: full opacity, bold title
Read rows: 0.55 opacity to de-emphasize

Socket new rows: animate in with motion.tr
  initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}

Attack link:
  if (a.attackId?._id) render: <Link to={`/attacks/${a.attackId._id}`}>View Attack</Link>
  else: render '—'

Subtitle logic:
  unread > 0 ? `${unread} unread` : 'All caught up'
  All caught up uses --color-online

Loading: <LoadingState message="Loading alerts..." />
Error: <ErrorState message="Failed to load alerts" onRetry={refetch} />
Empty: <EmptyState message="No alerts yet." />
```
