# SENTINAL — Future Routes (Post-MVP)

> These routes are NOT built yet.
> They are planned for after the current frontend MVP is complete.
> Do not start building these until all current routes are done and working.

---

## Why This File Exists

As features get added to the backend (Nexus agent, auth, PCAP processor, rate limiting),
this file tracks what frontend surfaces they will need.
When a backend feature is ready, move it to an active route doc.

---

## Planned Routes

### `/login` — Authentication
**Blocked by**: Auth system not yet in backend
**When ready**: Add to AppLayout as a guard. All `/app/*` routes require auth.
**UI**: Email + password form. No OAuth for now.
**API**: `POST /api/auth/login` → returns JWT. Store in `localStorage` as `sentinal_token`.
**Pattern**: Redirect to `/dashboard` on success. Redirect to `/login` on 401.

---

### `/actions` — Nexus Action Queue
**Blocked by**: Nexus agent (service 5) not built
**When ready**: Shows pending AI-suggested actions (block IP, rate limit, alert admin).
**UI**: Table of action items. Each has: type, target, reason, [Approve] [Reject] buttons.
**API**:
  - `GET /api/actions` → list pending actions
  - `POST /api/actions/:id/approve` → execute action
  - `POST /api/actions/:id/reject` → dismiss action
**Socket**: `action:pending` event when Nexus suggests a new action.

---

### `/network` — PCAP / Network Traffic
**Blocked by**: PCAP processor (service 2) not built
**When ready**: Shows network-level traffic captured by Scapy.
**UI**: Timeline of packets, protocol breakdown chart, anomaly markers.
**API**: `GET /api/network/events` → network event list
**Socket**: `network:event` for live packet stream.

---

### `/analytics` — Historical Analytics
**Blocked by**: No analytics/aggregation API endpoint yet
**When ready**: Time-series charts, attack trends, top attacker IPs, top attack types.
**UI**: Date range picker, multiple recharts line/bar charts.
**API**: `GET /api/analytics?from=&to=` → aggregated stats over time range

---

### `/projects` — Multi-Project Management
**Blocked by**: Single-project backend (no project/org model)
**When ready**: List all projects using the middleware. Switch between them.
**UI**: Project cards, click to scope dashboard to that project.
**API**: `GET /api/projects`, `POST /api/projects`, `PUT /api/projects/:id`

---

### `/profile` or `/account` — User Account
**Blocked by**: Auth system
**When ready**: API key management, notification preferences, password change.

---

### `/docs` — Integration Guide (upgrade)
**Currently**: Static markdown-style page
**Upgrade**: Add interactive API tester. User pastes `projectId` and tests ingest live.
**API**: Uses `POST /api/logs/ingest` with test payload.

---

## Upgrade Notes for Current Routes

### `/attacks` — Pagination
- Currently: loads last 100, client-side filter
- Future: cursor-based pagination API (`GET /api/attacks?after=cursor&limit=25`)
- When adding: update `getRecentAttacks` in `api.js`, add pagination controls to `AttackFilters.jsx`

### `/logs` — Pagination
- Same pattern as attacks pagination above

### `/alerts` — Bulk Actions
- Mark All Read needs a dedicated API endpoint: `POST /api/alerts/read-all`
- Currently: workaround with sequential PATCH calls

### `/services` — Service Restart
- Future: [Restart] button per service via `POST /api/services/:name/restart`
- Currently: read-only

### `/dashboard` — Stats Upgrade
- Future: time-range selector (last 1h / 24h / 7d / 30d)
- Requires: `GET /api/stats?range=24h`
- Currently: all-time stats only
