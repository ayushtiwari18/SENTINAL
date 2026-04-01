# Route: `/attacks` — Attack History

## Purpose
Full paginated attack history with filters.
The operator comes here to audit all detected attacks,
filter by type/severity/status, and drill into forensics.

## Inspiration
- https://grafana.com/logs — dense filter bar + table layout
- https://vercel.com/deployments — status filters above table, row click to detail
- https://linear.app/issues — filter chips, sortable table

---

## Layout

```
[PageWrapper fade-in]

Page Title: "Attacks"
Subtitle: "X total attacks detected"

[Filter Bar]
  [Search: IP or attack type]
  [Filter: Severity  (all / low / medium / high / critical)]
  [Filter: Type      (all / sqli / xss / traversal / ...)]
  [Filter: Status    (all / attempt / successful / blocked)]
  [Filter: DetectedBy (all / rule / ml / both)]
  [Clear Filters button — only visible when filter active]

[Attack Table]
  Time | IP | Attack Type | Severity | Status | Detected By | Confidence | [Investigate]

  - Time: formatDate(a.createdAt)
  - IP: mono font
  - Attack Type: <AttackTypeTag> component
  - Severity: <SeverityBadge>
  - Status: colored text (attempt / successful / blocked)
  - Detected By: plain text (rule / ml / both)
  - Confidence: formatConf(a.confidence)
  - Investigate button: navigates to /attacks/:id

[Live indicator]
  Top-right: "Live" dot pulse when new socket row arrives

[Empty State]
  "No attacks found matching your filters."

[Footer count]
  "Showing X of Y attacks"
```

---

## Component Tree

```
Attacks.jsx (page)
├── PageWrapper
├── AttackFilters.jsx
│   ├── search input
│   ├── severity select
│   ├── type select
│   ├── status select
│   └── detectedBy select
├── Panel (title: "All Attacks")
│   ├── LoadingState
│   ├── ErrorState
│   ├── EmptyState
│   └── table
│       └── AttackRow (motion.tr for socket rows)
│           ├── AttackTypeTag
│           └── SeverityBadge
└── "Showing X of Y" footer text
```

---

## API Calls

### Primary — Recent Attacks
- **Endpoint**: `GET /api/attacks/recent?limit=100`
- **Function**: `getRecentAttacks(100)` from `services/api.js`
- **Poll interval**: 30 seconds (useInterval)
- **Socket**: `attack:new` — prepend new attack to top of list
  - Socket payload: `{ event, timestamp, data: { id, ip, attackType, severity, status, detectedBy, confidence, timestamp } }`
  - Read `payload.data`, NOT `payload`
  - Normalize: `{ ...payload.data, _id: payload.data.id }` before adding to state

**Response shape** (`response.data.data` — array):
```json
[
  {
    "_id":         "ObjectId string",
    "ip":          "192.168.1.101",
    "attackType":  "sqli",
    "severity":    "high",
    "status":      "attempt",
    "detectedBy":  "rule",
    "confidence":  0.92,
    "payload":     "' OR 1=1 --",
    "createdAt":   "ISO timestamp"
  }
]
```

---

## Filtering Logic

Filtering is done CLIENT-SIDE on the fetched array.
Do NOT make a new API call when filter changes.

```js
const filtered = attacks.filter(a => {
  if (filters.severity && a.severity !== filters.severity) return false;
  if (filters.type     && a.attackType !== filters.type)   return false;
  if (filters.status   && a.status !== filters.status)     return false;
  if (filters.detectedBy && a.detectedBy !== filters.detectedBy) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!a.ip.includes(q) && !a.attackType.includes(q)) return false;
  }
  return true;
});
```

---

## Field Mapping

| UI Column | Field | Transform |
|-----------|-------|----------|
| Time | `a.createdAt` | `formatDate(a.createdAt)` |
| IP | `a.ip` | mono font, no transform |
| Attack Type | `a.attackType` | `<AttackTypeTag type={a.attackType} />` |
| Severity | `a.severity` | `<SeverityBadge severity={a.severity} />` |
| Status | `a.status` | Color from `STATUS_COLORS[a.status]` |
| Detected By | `a.detectedBy` | plain text |
| Confidence | `a.confidence` | `formatConf(a.confidence)` |
| Investigate | `a._id` | `navigate(ROUTES.FORENSICS(a._id))` |

---

## States

| State | Display |
|-------|---------|
| Loading | `<LoadingState message="Loading attacks..." />` |
| Error | `<ErrorState message="Failed to load attacks" onRetry={refetch} />` |
| Empty (no data) | `<EmptyState message="No attacks recorded yet." />` |
| Empty (filter) | `<EmptyState message="No attacks match your filters." />` |
| Live new row | Animate in from top: `opacity 0→1`, `y -8→0`, `0.15s` |

---

## AttackTypeTag Spec

```jsx
// src/components/attacks/AttackTypeTag.jsx
// Maps attackType to a short uppercase label with color
const TYPE_COLORS = {
  sqli:               '#f44747',
  xss:                '#ce9178',
  traversal:          '#dcdcaa',
  command_injection:  '#f44747',
  ssrf:               '#ce9178',
  lfi_rfi:            '#dcdcaa',
  brute_force:        '#9cdcfe',
  hpp:                '#888888',
  xxe:                '#ce9178',
  webshell:           '#f44747',
  unknown:            '#555555',
};
```

---

## ⚠️ Pitfalls

1. Socket rows have `id` not `_id` — normalize on arrival
2. `confidence` is 0–1 float — always `formatConf()`
3. Filter state must reset when new data arrives (don't clear filters, just re-apply)
4. Cap socket feed at 200 rows to prevent memory leak
5. Navigate to `/attacks/${a._id}` not `${a.id}` for REST rows

---

## AI Build Instructions

```
You are building the Attacks page for SENTINAL.

Route: /attacks
Wrap in PageWrapper. AppLayout wraps via router (no need to add Navbar).

Data:
1. Call getRecentAttacks(100) on mount + every 30s (useInterval)
2. Listen to 'attack:new' socket → prepend to top
   ALWAYS read payload.data (not payload)
   Normalize: { ...payload.data, _id: payload.data.id }
   Cap array at 200 rows

Filtering:
- 4 filter selects: severity, attackType, status, detectedBy
- 1 search input: match against ip and attackType
- Filter is purely client-side on the local array
- "X of Y attacks" shown below table

Table columns:
  Time | IP (mono) | Attack Type (AttackTypeTag) | Severity (SeverityBadge) |
  Status (colored text) | Detected By | Confidence | [Investigate button]

Investigate button:
  onClick: navigate(`/attacks/${a._id}`) using useNavigate
  Style: small ghost button, text: "Investigate"

Socket new rows animate in:
  Use motion.tr with initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }}

Loading: <LoadingState message="Loading attacks..." />
Error: <ErrorState message="Failed to load attacks" onRetry={refetch} />
Empty: <EmptyState message="No attacks recorded yet." />
Empty after filter: <EmptyState message="No attacks match your filters." />

Never hardcode colors. Use SEVERITY_COLORS and STATUS_COLORS from constants.js.
Never format dates inline. Use formatDate() from utils/format.js.
```
