# SENTINAL — Frontend Master Plan

> Production-ready, user-facing security monitoring platform.
> Target: HackByte 4.0 demo + real developer use.

---

## 1. Application Purpose & User Journey

### Who Uses This
- **Security Engineers** — monitor real-time attack feeds, investigate forensics
- **Developers** — integrate the middleware, verify it's working
- **Stakeholders / Judges** — see the system working end-to-end in a demo

### Complete User Flow

```
Landing Page (/)
  ↓  "Go to Dashboard" or "View Docs"
Dashboard (/dashboard)
  ↓  See live stats, attack feed, alerts
  ↓  Click any attack row
Forensics (/forensics/:id)
  ↓  Full attack report, raw request, IP history, chain timeline
  ←  Back to dashboard
Alerts (/alerts)
  ↓  High/critical alert list, mark read
Attacks (/attacks)
  ↓  Full attack history, filter by type/severity/status
Logs (/logs)
  ↓  Raw ingested HTTP logs
Docs (/docs)
  ↓  Integration guide: how to add middleware, API reference
```

---

## 2. Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Landing | Hero, features, how it works, CTA to dashboard |
| `/dashboard` | Dashboard | Live ops view: stats, attack feed, service status, alerts |
| `/attacks` | Attacks | Full paginated attack history with filters |
| `/attacks/:id` | Forensics | Full forensic report for one attack |
| `/alerts` | Alerts | Alert management, mark read |
| `/logs` | Logs | Raw system log viewer |
| `/docs` | Docs | Integration guide + API reference |
| `*` | 404 | Not found page |

---

## 3. Theme & Visual Identity

### Tone
Operational. Clinical. Precision instrument.
Not a SaaS landing page. Not a marketing site.
Think: **Vercel dashboard meets a terminal**.

### Color Palette

```
Background base:   #0a0a0a   (near-black)
Surface:           #111111   (panels)
Border:            #1e1e1e   (subtle lines)
Border strong:     #2a2a2a
Text primary:      #e2e2e2
Text secondary:    #888888
Text muted:        #555555
Accent:            #00d4aa   (teal — SENTINAL brand)
Accent dim:        #00d4aa22 (teal glow for cards)
Danger:            #f44747   (critical/errors)
Warning:           #ce9178   (high severity)
Info:              #9cdcfe   (low/info)
Success:           #4ec9b0   (blocked/online)
Code text:         #9cdcfe
```

### Typography

```
Primary font:    'Inter' (sans-serif) — for all UI text
Mono font:       'JetBrains Mono' or 'Fira Code' — for IPs, payloads, code
Base size:       14px
Line height:     1.6
```

Import both from Google Fonts.

### Spacing
```
Page padding:   24px
Panel padding:  16px
Card gap:       12px
Table row:      8px 12px
```

### Borders
- All panels: `1px solid #1e1e1e`
- No rounded corners above 4px
- No shadows
- No gradients anywhere except hero section teal glow

---

## 4. Libraries to Install

```bash
npm install \
  react-router-dom \
  axios \
  socket.io-client \
  recharts \
  framer-motion \
  date-fns \
  lucide-react
```

### Why Each

| Library | Why |
|---------|-----|
| `react-router-dom` v6 | Multi-page routing |
| `axios` | HTTP calls, interceptors |
| `socket.io-client` | Real-time events |
| `recharts` | Donut/line charts for stats |
| `framer-motion` | Entrance animations, drawer slide, table row fade-in |
| `date-fns` | Human-readable time formatting (`formatDistanceToNow`) |
| `lucide-react` | Clean icon set (Shield, AlertTriangle, Terminal, etc.) |

### Do NOT Install
- Tailwind, Bootstrap, Material UI, Chakra UI, Ant Design
- Any full component library
- GSAP (framer-motion covers what we need without the complexity)

---

## 5. Animation Rules (Framer Motion)

Use animation **only** for:
1. Page transitions — fade + slide up (duration: 0.25s)
2. New row in attack feed — fade in from top (duration: 0.2s)
3. Forensics drawer — slide in from right (duration: 0.25s)
4. Alert badge pulse — scale pulse when new alert arrives
5. Stat card count — number count-up on first load
6. Hero section — stagger fade-in of headline + CTA

Do NOT use:
- Scroll-triggered animations
- Parallax
- Rotating elements
- Loading spinners with animation (use plain text “Loading...”)

---

## 6. Folder Structure

```
dashboard/
├── public/
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   ├── Footer.jsx
│   │   │   └── PageWrapper.jsx
│   │   ├── ui/
│   │   │   ├── Panel.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── SeverityBadge.jsx
│   │   │   ├── StatusDot.jsx
│   │   │   ├── Table.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── ErrorState.jsx
│   │   │   └── LoadingState.jsx
│   │   ├── dashboard/
│   │   │   ├── SystemStatus.jsx
│   │   │   ├── StatsPanel.jsx
│   │   │   ├── LiveAttackFeed.jsx
│   │   │   └── AlertsPanel.jsx
│   │   ├── attacks/
│   │   │   ├── AttackTable.jsx
│   │   │   ├── AttackFilters.jsx
│   │   │   └── AttackTypeTag.jsx
│   │   ├── forensics/
│   │   │   ├── ForensicsDrawer.jsx   (existing, move here)
│   │   │   ├── RawRequestBlock.jsx
│   │   │   ├── IpIntelBlock.jsx
│   │   │   └── AttackChainTimeline.jsx
│   │   └── landing/
│   │       ├── HeroSection.jsx
│   │       ├── HowItWorks.jsx
│   │       ├── FeaturesGrid.jsx
│   │       └── LiveDemoStrip.jsx
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Attacks.jsx
│   │   ├── ForensicsPage.jsx
│   │   ├── Alerts.jsx
│   │   ├── Logs.jsx
│   │   ├── Docs.jsx
│   │   └── NotFound.jsx
│   ├── services/
│   │   ├── api.js               (existing)
│   │   └── socket.js            (existing)
│   ├── hooks/
│   │   ├── useApi.js            (generic fetch hook)
│   │   ├── useSocket.js         (socket event listener hook)
│   │   └── useInterval.js       (polling hook)
│   ├── utils/
│   │   ├── format.js            (formatDate, formatConfidence, truncate)
│   │   └── constants.js         (SEVERITY_COLORS, ATTACK_TYPES, ROUTES)
│   ├── styles/
│   │   ├── global.css
│   │   ├── variables.css        (CSS custom properties)
│   │   └── fonts.css
│   ├── App.jsx               (router root)
│   └── main.jsx
├── index.html
├── vite.config.js
└── package.json
```

---

## 7. Routing Setup (react-router-dom v6)

```jsx
// App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

<BrowserRouter>
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route element={<AppLayout />}>
      <Route path="/dashboard"     element={<Dashboard />} />
      <Route path="/attacks"       element={<Attacks />} />
      <Route path="/attacks/:id"   element={<ForensicsPage />} />
      <Route path="/alerts"        element={<Alerts />} />
      <Route path="/logs"          element={<Logs />} />
      <Route path="/docs"          element={<Docs />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes>
</BrowserRouter>
```

Landing page has its own layout (no navbar).
All dashboard routes share `AppLayout` (Navbar + Footer + PageWrapper).

---

## 8. Custom Hooks Pattern

Every data-fetching component must use `useApi`:

```js
// hooks/useApi.js
export function useApi(apiFn, deps = [], interval = null) {
  // returns { data, loading, error, refetch }
}
```

Every socket listener must use `useSocket`:

```js
// hooks/useSocket.js
export function useSocket(eventName, handler) {
  // attaches socket.on, cleans up on unmount
}
```

---

## 9. What Exists Already (Do Not Rebuild)

These files already exist and work. Migrate them into the new structure:
- `components/SystemStatus.jsx` → move to `components/dashboard/`
- `components/StatsPanel.jsx` → move to `components/dashboard/`
- `components/LiveAttackFeed.jsx` → move to `components/dashboard/`
- `components/AlertsPanel.jsx` → move to `components/dashboard/`
- `components/ForensicsDrawer.jsx` → move to `components/forensics/` and promote to full page
- `services/api.js` → keep, extend
- `services/socket.js` → keep as-is

---

## 10. Pitfalls & Consistency Rules

1. **Never call axios directly in a component** — always go through `services/api.js`
2. **Never create a second socket instance** — always import from `services/socket.js`
3. **Date formatting** — always use `format.js` utilities. Never write `new Date().toLocaleString()` inline
4. **Severity colors** — always import from `utils/constants.js`. Never hardcode `#f44747` inline
5. **API response unwrapping** — all Gateway responses are `{ success, message, data }`. Always use `res.data.data`, not `res.data`
6. **Socket payload** — all events are `{ event, timestamp, data: {...} }`. Always read `payload.data`, not `payload` directly
7. **Attack type enum** — values are: `sqli xss traversal command_injection ssrf lfi_rfi brute_force hpp xxe webshell unknown`
8. **Loading state** — use `<LoadingState />` component, never custom inline spinners
9. **Error state** — use `<ErrorState message={} />` component, always log to console too
10. **Empty state** — use `<EmptyState />` component, never return null for empty lists
