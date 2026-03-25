# SENTINAL — AI Builder Instructions

> This document is written FOR an AI coding assistant.
> When building any component or page for SENTINAL, read this file first.
> It contains every rule, pitfall, and pattern you must follow.

---

## Project Context

SENTINAL is a real-time web security monitoring platform.
- Backend: Node.js + Express + Socket.io on port 3000
- Frontend: React 18 + Vite on port 5173
- Database: MongoDB Atlas
- Detection: Python FastAPI on port 8002

The frontend is an **operational security dashboard** — dense, dark, fast.
Do NOT make it look like a SaaS landing page or consumer app.

---

## Non-Negotiable Rules

### 1. API Response Shape
Every backend response is wrapped:
```json
{ "success": boolean, "message": string, "data": <actual payload> }
```
When axios returns `response`, the actual data is at `response.data.data`.
**NEVER** use `response.data` directly.

### 2. API Calls
- **NEVER** call axios directly inside a component
- **ALWAYS** import and call functions from `src/services/api.js`
- If an API function doesn't exist yet, add it to `api.js` first

### 3. Socket Connection
- **NEVER** create a new `io()` connection inside a component
- **ALWAYS** import the singleton from `src/services/socket.js`
- **ALWAYS** clean up: `return () => socket.off(event, handler)`
- Socket event payload shape: `{ event, timestamp, data: {...} }` — read `payload.data`

### 4. Socket vs REST ID field
- REST responses use `_id` (MongoDB ObjectId string)
- Socket payloads use `id` (no underscore)
- Normalize to `_id || id` when storing in state

### 5. Date/Time Formatting
- **NEVER** call `new Date().toLocaleString()` inline in JSX
- **ALWAYS** use `formatDate(ts)` or `formatRelTime(ts)` from `src/utils/format.js`

### 6. Colors
- **NEVER** hardcode hex values like `#f44747` in component styles
- **ALWAYS** use CSS custom properties: `var(--color-critical)`
- For severity colors: import `SEVERITY_COLORS` from `src/utils/constants.js`

### 7. Severity, Status, AttackType
- **ALWAYS** use `SeverityBadge` component for severity display
- **ALWAYS** use `StatusDot` component for service status display
- **NEVER** render raw severity strings without a badge
- Attack type enum (exact values): `sqli xss traversal command_injection ssrf lfi_rfi brute_force hpp xxe webshell unknown`
- Severity enum (exact values): `low medium high critical`
- Status enum (exact values): `attempt successful blocked`
- detectedBy enum (exact values): `rule ml both` — NOT `rules_engine`, NOT `ml_classifier`

### 8. Loading / Error / Empty States
- **ALWAYS** use `<LoadingState />` — never custom inline loading text
- **ALWAYS** use `<ErrorState message={} onRetry={} />` — always log to console too
- **ALWAYS** use `<EmptyState message={} />` — never return `null` for empty lists

### 9. Explanation Field (AttackEvent)
`attack.explanation` is a **JSON string**, not an object.
Always parse with fallback:
```js
const exp = parseExplanation(attack.explanation);
// parseExplanation is in src/utils/format.js
// Returns: { summary, what_happened, potential_impact, recommended_action, rule_triggered }
```

### 10. Null Safety
- `responseCode` can be null — display as `'—'`
- `raw_request` in forensics can be null — show "No raw request data"
- `ip_intel.first_attack` / `last_attack` can be null — display as `'—'`
- `alert.attackId` can be null — guard: `alert.attackId?.attackType ?? 'unknown'`

### 11. service-status field name
- Field is `svc.service` (NOT `svc.name`) for the service name
- This is a known inconsistency in the existing `SystemStatus.jsx` — fix it

### 12. Fonts
- UI text: `'Inter', sans-serif`
- IPs, payloads, timestamps, code, table data values: `'JetBrains Mono', monospace` (class `.mono`)

### 13. Routing
- Use `react-router-dom` v6
- Use `Link` for navigation, `useNavigate` for programmatic nav, `useParams` for route params
- Route to attack forensics: `/attacks/:id` where `:id` = `_id` from REST or `id` from socket

### 14. Animations
- Use `framer-motion` only
- Page transitions: `opacity 0→1`, `y 16→0`, `duration 0.2s`
- New socket rows: `opacity 0→1`, `y -8→0`, `duration 0.15s`
- Drawer: `x 100%→0`, `duration 0.25s`, `ease easeOut`
- Do NOT add scroll-triggered animations
- Do NOT add hover animations via framer-motion (use CSS `:hover`)

---

## File Import Paths (always use these)

```js
import { getRecentAttacks, getStats, getAlerts, markAlertRead,
         getServiceStatus, getForensics, getRecentLogs } from '../services/api';
import socket from '../services/socket';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { formatDate, formatRelTime, formatConf, truncate, parseExplanation } from '../utils/format';
import { SEVERITY_COLORS, STATUS_COLORS, ATTACK_TYPES, ROUTES, POLL_INTERVAL } from '../utils/constants';
import SeverityBadge  from '../components/ui/SeverityBadge';
import StatusDot      from '../components/ui/StatusDot';
import LoadingState   from '../components/ui/LoadingState';
import ErrorState     from '../components/ui/ErrorState';
import EmptyState     from '../components/ui/EmptyState';
import Panel          from '../components/ui/Panel';
```

---

## Component Pattern Template

Every data-fetching component must follow this exact pattern:

```jsx
import React, { useState, useCallback } from 'react';
import { useApi }        from '../hooks/useApi';
import { useSocket }     from '../hooks/useSocket';
import { useInterval }   from '../hooks/useInterval';
import { getSomeData }   from '../services/api';
import LoadingState      from '../components/ui/LoadingState';
import ErrorState        from '../components/ui/ErrorState';
import EmptyState        from '../components/ui/EmptyState';
import { POLL_INTERVAL } from '../utils/constants';

export default function SomeComponent() {
  const { data, loading, error, refetch } = useApi(getSomeData);

  // Polling
  useInterval(refetch, POLL_INTERVAL);

  // Real-time socket updates
  const handleNewItem = useCallback((payload) => {
    const item = payload.data; // ALWAYS .data, never payload directly
    // update state
  }, []);
  useSocket('some:event', handleNewItem);

  if (loading) return <LoadingState />;
  if (error)   return <ErrorState message={error} onRetry={refetch} />;
  if (!data || data.length === 0) return <EmptyState message="No items found." />;

  return (
    // render
  );
}
```

---

## Common Mistakes to Avoid

| Wrong | Correct |
|-------|--------|
| `response.data` | `response.data.data` |
| `svc.name` | `svc.service` |
| `payload.attackType` | `payload.data.attackType` |
| `attack._id` (from socket) | `attack.id` (socket uses no underscore) |
| `new Date(ts).toLocaleString()` | `formatDate(ts)` from utils/format.js |
| `#f44747` hardcoded | `var(--color-critical)` |
| `detectedBy: 'rules_engine'` | `detectedBy: 'rule'` |
| Inline loading text | `<LoadingState />` |
| `return null` for empty | `<EmptyState message="..." />` |
| Direct `io()` call | Import from `services/socket.js` |
| Direct `axios.get()` | Import fn from `services/api.js` |
| `JSON.parse(explanation)` without try/catch | `parseExplanation(explanation)` |
| `attacksBySeverity.High` | `attacksBySeverity.high` (lowercase) |
| `confidence` as-is | `Math.round(confidence * 100)` + `%` |

---

## Per-Page Quick Reference

| Page | Route | Key API | Key Socket |
|------|-------|---------|------------|
| Landing | `/` | `getStats`, `getRecentAttacks` | none |
| Dashboard | `/dashboard` | `getStats`, `getServiceStatus`, `getRecentAttacks`, `getAlerts` | `attack:new`, `alert:new`, `service:status` |
| Attacks | `/attacks` | `getRecentAttacks` | `attack:new` |
| Forensics | `/attacks/:id` | `getForensics(id)` | none |
| Alerts | `/alerts` | `getAlerts`, `markAlertRead` | `alert:new` |
| Logs | `/logs` | `getRecentLogs` | none |
| Services | `/services` | `getServiceStatus`, `getHealth` | `service:status` |
| Settings | `/settings` | none | none |
| Docs | `/docs` | none | none |
| NotFound | `*` | none | none |
