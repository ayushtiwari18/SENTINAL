# Route: `/logs` — System Log Viewer

## Purpose
Raw view of every HTTP request ingested through the SENTINAL middleware.
Used to debug: verify middleware is sending data, see what's being logged.

---

## Layout

```
[Page title: System Logs]
[Log count | Last updated]
[Filter: method | project ID | IP search]
[Logs table]
[Pagination]
```

---

## Data Source

- **API**: `GET /api/logs/recent?limit=50`
- **Response**: `{ success: true, data: SystemLog[] }`
- **SystemLog fields**:
  ```
  _id               string    MongoDB ObjectId
  projectId         string    e.g. "demo-project-001"
  method            string    enum: GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD
  url               string    full URL path + query
  ip                string    source IP
  queryParams       object    e.g. { input: "value" }
  body              object    request body
  headers           object    { userAgent, contentType, referer }
  responseCode      number    HTTP response code or null
  processingTimeMs  number    ms taken
  createdAt         string    ISO datetime
  ```

---

## Table Columns

| Column | Field | Format |
|--------|-------|--------|
| Time | `createdAt` | `formatDate` |
| Project | `projectId` | plain text |
| Method | `method` | color-coded badge (GET=teal, POST=yellow, DELETE=red) |
| URL | `url` | mono font, truncated to 60 chars |
| IP | `ip` | mono font |
| Response | `responseCode` | color-coded |
| Time ms | `processingTimeMs` | `${n}ms` |

---

## Files
```
src/pages/Logs.jsx
```

---

## AI Build Instructions

```
You are building the Logs page for SENTINAL.
Route: /logs

Data:
- Call getRecentLogs(50) from src/services/api.js on mount
- Refresh every 30s via useInterval hook

Field names:
- log._id
- log.projectId
- log.method
- log.url
- log.ip
- log.queryParams    (object, may be empty {})
- log.body           (object, may be empty {})
- log.headers        (object: userAgent, contentType, referer)
- log.responseCode   (number or null)
- log.processingTimeMs
- log.createdAt

Pitfalls:
- responseCode can be null — display as '—' not 'null'
- url may be very long — truncate display at 60 chars, show full on hover title attribute
- queryParams and body are objects — do NOT render as [object Object]
  → use JSON.stringify(log.queryParams) for display
- No socket on this page
- No filtering on backend — filter client-side only
```
