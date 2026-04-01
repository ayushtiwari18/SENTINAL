# SENTINAL — Tech Stack & Libraries

> This is the authoritative list of what to install, why, and what NOT to install.
> Do not deviate. Every choice here is deliberate.

---

## Install Command

```bash
cd dashboard
npm install \
  react-router-dom \
  axios \
  socket.io-client \
  recharts \
  framer-motion \
  date-fns \
  lucide-react \
  react-hot-toast
```

---

## Library Reference

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `react` | 18.x | UI framework | Already installed |
| `react-dom` | 18.x | DOM renderer | Already installed |
| `vite` | 5.x | Dev server + bundler | Already installed |
| `react-router-dom` | 6.x | Client-side routing | `BrowserRouter` + nested `Routes` |
| `axios` | 1.x | HTTP client | Already installed. Use interceptors |
| `socket.io-client` | 4.x | WebSocket connection | Already installed. One singleton |
| `recharts` | 2.x | Charts | Already installed. Donut + bar only |
| `framer-motion` | 11.x | Animations | Page transitions, drawer, row fade-in |
| `date-fns` | 3.x | Date formatting | `formatDistanceToNow`, `format` |
| `lucide-react` | latest | Icons | Shield, AlertTriangle, Terminal, etc. |
| `react-hot-toast` | 2.x | Toast notifications | New attack/alert notifications |

---

## DO NOT Install

| Banned | Why |
|--------|-----|
| Tailwind CSS | Conflicts with existing CSS, adds unnecessary complexity for this scale |
| Bootstrap | Heavy, opinionated, wrong aesthetic |
| Material UI / Chakra UI / Ant Design | Full component libraries override our design system |
| GSAP | Framer Motion covers 100% of our needs. GSAP adds 200KB for zero gain here |
| Redux / Zustand / Jotai | No global state needed. Socket + local state in hooks is sufficient |
| SWR | We use custom `useApi` + `useInterval` hooks. Consistent with existing code |
| React Query / TanStack Query | Same reason as SWR. Would require refactoring all existing fetch logic |
| Styled Components / Emotion | We use plain CSS + CSS custom properties |
| react-syntax-highlighter | Manual `<span>` coloring for code blocks is sufficient and 300KB cheaper |
| Three.js / PixiJS | No 3D/canvas needed |

---

## Existing Files to Keep (Do Not Replace)

```
dashboard/src/services/api.js       — Axios instance + all API functions
dashboard/src/services/socket.js    — Single socket.io instance
```

Both are already wired and working. Extend them, never fork them.

---

## Vite Config Notes

Current `vite.config.js` already proxies `/api` to `http://localhost:3000`.
Do NOT change the proxy target unless the backend port changes.

```js
// vite.config.js (current — do not modify)
server: {
  proxy: {
    '/api': { target: 'http://localhost:3000', changeOrigin: true },
    '/socket.io': { target: 'http://localhost:3000', ws: true }
  }
}
```

---

## Node / NPM Versions

- Node: 18.x or 20.x (LTS)
- NPM: 9.x or 10.x
- Do NOT use yarn or pnpm unless existing lockfile is changed
