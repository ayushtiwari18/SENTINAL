# SENTINAL — Frontend Architecture

> This is the structural blueprint. Every new file goes into the right folder.
> When in doubt, check this document first.

---

## Full Folder Structure

```
dashboard/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx           ← top nav bar for /app/* routes
│   │   │   ├── Footer.jsx           ← footer for all routes
│   │   │   ├── AppLayout.jsx        ← wraps all /app/* pages (Navbar + Outlet + Footer)
│   │   │   └── PageWrapper.jsx      ← framer-motion page transition wrapper
│   │   ├── ui/
│   │   │   ├── Panel.jsx            ← reusable panel with header + body
│   │   │   ├── StatCard.jsx         ← single stat with icon + count-up
│   │   │   ├── SeverityBadge.jsx    ← colored badge (low/medium/high/critical)
│   │   │   ├── StatusDot.jsx        ← colored dot + label (online/offline/degraded)
│   │   │   ├── Table.jsx            ← reusable table shell (thead + tbody slot)
│   │   │   ├── EmptyState.jsx       ← empty list message
│   │   │   ├── ErrorState.jsx       ← error message + optional retry
│   │   │   └── LoadingState.jsx     ← loading indicator (text pulse)
│   │   ├── dashboard/
│   │   │   ├── SystemStatus.jsx     ← service health panel (EXISTS - migrate here)
│   │   │   ├── StatsPanel.jsx       ← stats cards + charts (EXISTS - migrate here)
│   │   │   ├── LiveAttackFeed.jsx   ← live attack table (EXISTS - migrate here)
│   │   │   └── AlertsPanel.jsx      ← alert list (EXISTS - migrate here)
│   │   ├── attacks/
│   │   │   ├── AttackTable.jsx      ← full attack history table
│   │   │   ├── AttackFilters.jsx    ← filter bar: type, severity, status, search
│   │   │   └── AttackTypeTag.jsx    ← attack type label with color coding
│   │   ├── forensics/
│   │   │   ├── ForensicsDrawer.jsx  ← slide-in drawer (EXISTS - migrate here)
│   │   │   ├── RawRequestBlock.jsx  ← formatted raw request panel
│   │   │   ├── IpIntelBlock.jsx     ← IP intelligence panel
│   │   │   └── AttackChainTimeline.jsx ← chain timeline table
│   │   └── landing/
│   │       ├── HeroSection.jsx      ← headline, CTAs, counter strip
│   │       ├── HowItWorks.jsx       ← 3-step numbered layout
│   │       ├── FeaturesGrid.jsx     ← 3-column features grid
│   │       └── LiveDemoStrip.jsx    ← last 5 attacks from live system
│   ├── pages/
│   │   ├── Landing.jsx              ← / route
│   │   ├── Dashboard.jsx            ← /dashboard route
│   │   ├── Attacks.jsx              ← /attacks route
│   │   ├── ForensicsPage.jsx        ← /attacks/:id route (full page, not drawer)
│   │   ├── Alerts.jsx               ← /alerts route
│   │   ├── Logs.jsx                 ← /logs route
│   │   ├── Services.jsx             ← /services route
│   │   ├── Settings.jsx             ← /settings route
│   │   ├── Docs.jsx                 ← /docs route
│   │   └── NotFound.jsx             ← * route
│   ├── services/
│   │   ├── api.js                   ← Axios instance + all API functions (EXISTS)
│   │   └── socket.js                ← Socket.io singleton (EXISTS)
│   ├── hooks/
│   │   ├── useApi.js                ← generic fetch hook
│   │   ├── useSocket.js             ← socket event listener hook
│   │   └── useInterval.js           ← polling interval hook
│   ├── utils/
│   │   ├── format.js                ← formatDate, formatConfidence, truncate
│   │   └── constants.js             ← SEVERITY_COLORS, ATTACK_TYPES, ROUTES
│   ├── styles/
│   │   ├── global.css               ← resets + base styles
│   │   ├── variables.css            ← CSS custom properties (ALL colors/spacing)
│   │   └── fonts.css                ← Google Fonts import
│   ├── App.jsx                      ← Router root (REPLACE existing)
│   └── main.jsx                     ← React entry point
├── index.html
├── vite.config.js
└── package.json
```

---

## Routing Setup

```jsx
// src/App.jsx — replace the existing App.jsx entirely
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing      from './pages/Landing';
import Dashboard   from './pages/Dashboard';
import Attacks     from './pages/Attacks';
import ForensicsPage from './pages/ForensicsPage';
import Alerts      from './pages/Alerts';
import Logs        from './pages/Logs';
import Services    from './pages/Services';
import Settings    from './pages/Settings';
import Docs        from './pages/Docs';
import NotFound    from './pages/NotFound';
import AppLayout   from './components/layout/AppLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public — no Navbar */}
        <Route path="/" element={<Landing />} />

        {/* App — shared AppLayout (Navbar + Footer) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/attacks"   element={<Attacks />} />
          <Route path="/attacks/:id" element={<ForensicsPage />} />
          <Route path="/alerts"    element={<Alerts />} />
          <Route path="/logs"      element={<Logs />} />
          <Route path="/services"  element={<Services />} />
          <Route path="/settings"  element={<Settings />} />
          <Route path="/docs"      element={<Docs />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Custom Hooks

### useApi
```js
// src/hooks/useApi.js
import { useState, useEffect, useCallback } from 'react';

export function useApi(apiFn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFn();
      setData(result);
      setError(null);
    } catch (err) {
      console.error('[useApi]', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, deps); // eslint-disable-line

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
}
```

### useSocket
```js
// src/hooks/useSocket.js
import { useEffect } from 'react';
import socket from '../services/socket';

export function useSocket(eventName, handler) {
  useEffect(() => {
    socket.on(eventName, handler);
    return () => socket.off(eventName, handler);
  }, [eventName, handler]);
}
```

### useInterval
```js
// src/hooks/useInterval.js
import { useEffect, useRef } from 'react';

export function useInterval(fn, ms) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => {
    if (!ms) return;
    const id = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
```

---

## Utility Files

### format.js
```js
// src/utils/format.js
import { formatDistanceToNow, format } from 'date-fns';

export const formatDate    = (ts) => ts ? format(new Date(ts), 'MMM d, HH:mm:ss') : '—';
export const formatRelTime = (ts) => ts ? formatDistanceToNow(new Date(ts), { addSuffix: true }) : '—';
export const formatConf    = (c)  => c  != null ? `${Math.round(c * 100)}%` : '—';
export const truncate      = (s, n = 60) => s && s.length > n ? s.slice(0, n) + '…' : (s || '—');
export const fmtJson       = (obj) => { try { return JSON.stringify(obj, null, 2); } catch { return String(obj); } };
export const parseExplanation = (raw) => {
  try { return JSON.parse(raw); }
  catch { return { summary: raw || '(no explanation)' }; }
};
```

### constants.js
```js
// src/utils/constants.js
export const ROUTES = {
  LANDING:   '/',
  DASHBOARD: '/dashboard',
  ATTACKS:   '/attacks',
  FORENSICS: (id) => `/attacks/${id}`,
  ALERTS:    '/alerts',
  LOGS:      '/logs',
  SERVICES:  '/services',
  SETTINGS:  '/settings',
  DOCS:      '/docs',
};

export const SEVERITY_COLORS = {
  critical: 'var(--color-critical)',
  high:     'var(--color-high)',
  medium:   'var(--color-medium)',
  low:      'var(--color-low)',
};

export const STATUS_COLORS = {
  blocked:    'var(--color-online)',
  successful: 'var(--color-critical)',
  attempt:    'var(--color-medium)',
  online:     'var(--color-online)',
  offline:    'var(--color-offline)',
  degraded:   'var(--color-degraded)',
};

export const ATTACK_TYPES = [
  'sqli', 'xss', 'traversal', 'command_injection',
  'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe', 'webshell', 'unknown'
];

export const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];
export const ATTACK_STATUSES = ['attempt', 'successful', 'blocked'];
export const DETECTED_BY     = ['rule', 'ml', 'both'];

export const POLL_INTERVAL = 30000; // 30 seconds — default polling interval
```

---

## Navbar Spec

```
Left:  SENTINAL [logo in --color-accent]
Center: [Dashboard] [Attacks] [Alerts] [Logs] [Services]
Right:  [Docs] [GitHub icon]
```

- Active route: underline in `--color-accent`
- Use `NavLink` from react-router-dom for active state
- Height: 48px
- Border-bottom: `1px solid var(--color-border-strong)`
- No dropdown menus

## Footer Spec

```
Left:   SENTINAL © 2026
Center: [Dashboard] [Docs] [GitHub]
Right:  Built for HackByte 4.0
```

- Height: auto, padding 16px 24px
- Border-top: `1px solid var(--color-border)`
- Font size: 12px, color: `--color-text-muted`
