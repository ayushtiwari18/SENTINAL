# Route: `/attacks` — Attack History

## Purpose
Full paginated list of all recorded attack events.
User can filter, search, and click any row to see forensics.

---

## Layout

```
[Page title: Attack History]
[Filter bar: severity | type | status | date range | search IP]
[Attack count: Showing 48 of 50 attacks]
[Attack Table]
[Pagination]
```

---

## Data Source

- **API**: `GET /api/attacks/recent?limit=50`
- **Note**: The current backend only has `/recent` with a `limit` param.
  Filtering is done client-side until backend adds query params.
- **Response**: `{ success: true, data: AttackEvent[] }`
- **AttackEvent fields**:
  ```
  _id           string   MongoDB ObjectId
  ip            string   e.g. "192.168.1.101"
  attackType    string   enum: sqli|xss|traversal|command_injection|ssrf|lfi_rfi|brute_force|hpp|xxe|webshell|unknown
  severity      string   enum: low|medium|high|critical
  status        string   enum: attempt|successful|blocked
  detectedBy    string   enum: rule|ml|both
  confidence    number   0.0 to 1.0
  payload       string   raw attack payload string
  explanation   string   JSON string from LLM (parse with JSON.parse, fallback to raw string)
  responseCode  number   HTTP response code e.g. 200 403 500
  createdAt     string   ISO 8601 datetime
  ```

---

## Filter Bar

| Filter | Type | Values |
|--------|------|--------|
| Severity | Multi-select | low, medium, high, critical |
| Attack Type | Multi-select | all 11 types from enum |
| Status | Multi-select | attempt, successful, blocked |
| IP Search | Text input | partial match client-side |
| Date range | Not needed for MVP | skip |

Filters are applied client-side (no backend query support yet).

---

## Attack Table Columns

| Column | Field | Format |
|--------|-------|--------|
| Time | `createdAt` | `formatDate(createdAt)` from format.js |
| IP | `ip` | mono font |
| Attack Type | `attackType` | `<AttackTypeTag>` component |
| Severity | `severity` | `<SeverityBadge>` component |
| Status | `status` | color-coded text |
| Detected By | `detectedBy` | plain text |
| Confidence | `confidence` | `formatConfidence(confidence)` → "87%" |
| Response | `responseCode` | color-coded: 200=muted, 403=green, 500=red |
| Action | — | [Forensics] button |

Clicking [Forensics] or anywhere on the row navigates to `/attacks/:_id`.

---

## Pagination

- Client-side pagination
- 20 rows per page
- Show: `< Prev  Page 1 of 3  Next >`

---

## Empty / Loading / Error States

- Loading: `<LoadingState />` (from ui/)
- Error: `<ErrorState message="Failed to fetch attacks" />` (from ui/)
- Empty: `<EmptyState message="No attacks recorded." />` (from ui/)

---

## Files
```
src/pages/Attacks.jsx
src/components/attacks/AttackTable.jsx
src/components/attacks/AttackFilters.jsx
src/components/attacks/AttackTypeTag.jsx
```

---

## AI Build Instructions

```
You are building the Attacks page for SENTINAL.

Data:
- Call getRecentAttacks(50) from src/services/api.js on mount
- Store raw data in state
- Apply filters client-side (filter function over array)
- Paginate client-side: 20 per page

Components:
- AttackTable: receives filtered+paginated array, renders table
- AttackFilters: controlled inputs, emits filter state up to Attacks.jsx
- AttackTypeTag: small inline tag showing attackType with color per type
- SeverityBadge: already built in ui/, import it

Navigation:
- Clicking a row calls: useNavigate(`/attacks/${attack._id}`)

Format:
- Dates: formatDate from src/utils/format.js
- Confidence: formatConfidence from src/utils/format.js
- Severity colors: SEVERITY_COLORS from src/utils/constants.js

Pitfalls:
- explanation field is a JSON string — try JSON.parse, catch and use raw string
- Do not re-fetch on every filter change — fetch once, filter in memory
- _id is the MongoDB ObjectId string, use it for navigation
- attackType enum values use underscore: command_injection not command-injection
```
