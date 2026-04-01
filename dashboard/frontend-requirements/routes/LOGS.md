# Route: `/logs` — Raw System Logs

## Purpose
Shows the raw ingested HTTP request log from the middleware.
Lets the operator see every request captured by the SENTINAL middleware,
not just the ones flagged as attacks.
Useful for auditing, debugging, and verifying middleware is working.

## Inspiration
- https://vercel.com/runtime-logs — raw log stream, filter bar, monospace rows
- https://grafana.com/explore — dense log viewer
- https://linear.app — keyboard-navigable list items

---

## Layout

```
[PageWrapper fade-in]

Page Title: "System Logs"
Subtitle: "Raw middleware capture — X entries"

[Filter Bar]
  [Search: IP or URL keyword]
  [Filter: Method (all / GET / POST / PUT / PATCH / DELETE)]
  [Filter: Response Code (all / 2xx / 3xx / 4xx / 5xx)]

[Logs Table]
  Time | Method | URL | IP | Response Code | Processing Time | [Expand]

  - Time: formatDate(log.createdAt)
  - Method: colored label (GET=green, POST=blue, DELETE=red, etc.)
  - URL: truncated to 80 chars, full in tooltip
  - IP: mono font
  - Response Code: colored (2xx=green, 4xx=amber, 5xx=red, null=muted dash)
  - Processing Time: Xms
  - Expand: toggles an expanded row with headers, queryParams, body

[Expanded Row (on click)]
  Headers: { userAgent, contentType, referer }
  Query Params: JSON block
  Body: JSON block
  Project ID: plain text

[Empty State]
  "No logs recorded yet. Is the middleware connected?"
```

---

## Component Tree

```
Logs.jsx (page)
├── PageWrapper
├── filter bar
└── Panel (title: "System Logs")
    ├── LoadingState
    ├── ErrorState
    ├── EmptyState
    └── table
        └── LogRow (toggleable expand)
            └── LogExpandedRow (conditional)
```

---

## API Calls

### Primary — Recent Logs
- **Endpoint**: `GET /api/logs/recent?limit=100`
- **Function**: `getRecentLogs(100)` from `services/api.js`
- **Poll interval**: 30 seconds (useInterval)
- **No socket event** for logs — REST poll only

**Response shape** (`response.data.data` — array):
```json
[
  {
    "_id":             "ObjectId",
    "projectId":       "demo-project-001",
    "method":          "POST",
    "url":             "/api/login?input=%27+OR+1%3D1",
    "ip":              "192.168.1.101",
    "queryParams":     { "input": "' OR 1=1" },
    "body":            {},
    "headers":         { "userAgent": "Mozilla/5.0", "contentType": "application/json", "referer": "" },
    "responseCode":    200,
    "processingTimeMs": 45,
    "createdAt":       "ISO timestamp"
  }
]
```

---

## Field Mapping

| UI Column | Source Field | Transform |
|-----------|-------------|----------|
| Time | `log.createdAt` | `formatDate(log.createdAt)` |
| Method | `log.method` | Color-coded label |
| URL | `log.url` | `truncate(log.url, 80)` |
| IP | `log.ip` | mono font |
| Response Code | `log.responseCode` | Color-coded; null → `'—'` |
| Processing Time | `log.processingTimeMs` | `Xms`; null → `'—'` |

### Method Colors
```js
const METHOD_COLORS = {
  GET:     'var(--color-online)',
  POST:    'var(--color-low)',
  PUT:     'var(--color-medium)',
  PATCH:   'var(--color-medium)',
  DELETE:  'var(--color-critical)',
  OPTIONS: 'var(--color-text-muted)',
  HEAD:    'var(--color-text-muted)',
};
```

### Response Code Colors
```js
const codeColor = (code) => {
  if (!code) return 'var(--color-text-muted)';
  if (code < 300) return 'var(--color-online)';
  if (code < 400) return 'var(--color-medium)';
  if (code < 500) return 'var(--color-high)';
  return 'var(--color-critical)';
};
```

---

## Filtering Logic

Client-side only. Do not re-fetch on filter change.

```js
const filtered = logs.filter(log => {
  if (filters.method && log.method !== filters.method) return false;
  if (filters.codeRange) {
    const c = log.responseCode;
    if (!c) return false;
    if (filters.codeRange === '2xx' && !(c >= 200 && c < 300)) return false;
    if (filters.codeRange === '3xx' && !(c >= 300 && c < 400)) return false;
    if (filters.codeRange === '4xx' && !(c >= 400 && c < 500)) return false;
    if (filters.codeRange === '5xx' && !(c >= 500)) return false;
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    if (!log.ip?.includes(q) && !log.url?.toLowerCase().includes(q)) return false;
  }
  return true;
});
```

---

## States

| State | Display |
|-------|---------|
| Loading | `<LoadingState message="Loading logs..." />` |
| Error | `<ErrorState message="Failed to load logs" onRetry={refetch} />` |
| Empty (no data) | `<EmptyState message="No logs recorded. Is the middleware connected?" />` |
| Empty (filtered) | `<EmptyState message="No logs match your filters." />` |
| Row expanded | Extra row below: headers, queryParams, body in code blocks |

---

## ⚠️ Pitfalls

1. `responseCode` can be `null` — never render `"null"`, always `'—'`
2. `queryParams` and `body` are objects — use `fmtJson()` from utils/format.js for display
3. `headers` is `{ userAgent, contentType, referer }` — NOT a standard Headers object, do not iterate
4. URL may contain encoded characters — display raw, no decoding
5. No socket event for logs — polling is the only refresh mechanism

---

## AI Build Instructions

```
You are building the Logs page for SENTINAL.

Route: /logs
Wrap in PageWrapper. AppLayout wraps via router.

Data:
1. Call getRecentLogs(100) on mount + every 30s (useInterval)
2. NO socket event for logs — polling only

Filter bar (client-side):
- Search input: filter by ip or url substring
- Method select: all / GET / POST / PUT / PATCH / DELETE
- Response code range: all / 2xx / 3xx / 4xx / 5xx

Table columns:
  Time | Method (colored) | URL (truncated) | IP (mono) | Code (colored) | Time (ms) | [expand]

Expand behavior:
- Click a row to toggle expanded state (track by _id in Set or Map)
- Expanded row shows below the main row as a full-width <tr>
- Expanded content: headers object, queryParams, body in <pre> blocks
  Use fmtJson() from utils/format.js for all JSON display

Null handling:
- responseCode null: display '—', color var(--color-text-muted)
- processingTimeMs null: display '—'
- body is empty object {}: display '(empty)'

Loading: <LoadingState message="Loading logs..." />
Error: <ErrorState message="Failed to load logs" onRetry={refetch} />
Empty: <EmptyState message="No logs recorded. Is the middleware connected?" />

Never format dates inline. Use formatDate() from utils/format.js.
Never format JSON inline. Use fmtJson() from utils/format.js.
Never hardcode colors. Use METHOD_COLORS and codeColor() locally.
```
