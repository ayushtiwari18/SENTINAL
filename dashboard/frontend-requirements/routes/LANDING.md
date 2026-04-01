# Route: `/` — Landing Page

## Purpose
The public-facing entry point. Explains what SENTINAL is, how it works,
and drives developers to the dashboard or integration docs.

## Inspiration / Tone
- https://vercel.com — minimal hero, direct copy
- https://linear.app — dark, technical, confident
- https://grafana.com — operational product, not marketing

This is a **technical product page for developers**, not a consumer app.

---

## Sections (top to bottom)

### 1. Navbar (no sidebar — top nav only on landing)
```
Left:  SENTINAL [logo/wordmark]
Right: [Dashboard] [Docs] [GitHub]
```
- Logo: monospace text `SENTINAL` in #00d4aa
- Links: plain text, hover underline
- Sticky on scroll
- On mobile: hamburger

### 2. Hero Section
```
[Tag: Open Source Security Monitoring]

Headline:
  Detect. Understand. Respond.
  One line of code.

Subheadline:
  Add SENTINAL middleware to your Express app and get real-time
  attack detection, AI forensics, and a live operations dashboard—instantly.

[CTA: Open Dashboard]  [Secondary: Read the Docs]

[Live counter strip: X attacks detected today | X logs ingested | X services monitored]
```

**Animation**: Stagger fade-in — tag → headline → sub → CTAs → counter strip (framer-motion, 0.2s each, delay 0.1s)

**Data for counter strip**:
- `GET /api/stats`
- Keys: `totalAttacks`, `totalLogs`
- Hardcode `services monitored: 3` until service-status is richer

### 3. One-Line Integration
```
How it works in 30 seconds:

[Code block]
const sentinal = require('@sentinal/middleware');
app.use(sentinal({ projectId: 'my-app', gatewayUrl: 'http://localhost:3000' }));

That's it. Every request is now monitored.
```
- Mono font, syntax highlighted manually with `<span>` color tags
- No syntax highlighter library needed
- Copy-to-clipboard button (plain JS navigator.clipboard)

### 4. Features Grid (3 columns)
```
[⚡ Real-Time Detection]   [AI Forensics]    [🛡️ Auto-Response (soon)]
[45+ attack patterns]    [LLM explains]    [Nexus agent]
[ML + rules engine]      [full chain]      [approve/reject]
```
Using lucide-react icons.
No API call needed — static content.

### 5. How It Works (3 steps)
```
1. Middleware captures every request
2. Detection Engine analyzes (rules + ML + LLM)
3. Dashboard shows attack + forensics in real time
```
Simple numbered layout with connecting line between steps.

### 6. Live Demo Strip
```
See it working right now:
[Last 5 attacks from the live system]
```
- `GET /api/attacks/recent?limit=5`
- Response key: `data` (array of AttackEvent)
- Display: tiny table — time | IP | type | severity
- Auto-refreshes every 30s
- If API is down: hide this section silently

### 7. Footer
```
Left:   SENTINAL © 2026
Center: [Dashboard] [Docs] [Alerts] [GitHub]
Right:  Built for HackByte 4.0
```

---

## Files Needed
```
src/pages/Landing.jsx
src/components/landing/HeroSection.jsx
src/components/landing/HowItWorks.jsx
src/components/landing/FeaturesGrid.jsx
src/components/landing/LiveDemoStrip.jsx
```

---

## API Calls on This Page

| Call | Endpoint | Keys Used |
|------|----------|-----------|
| Stats counter | `GET /api/stats` | `data.totalAttacks`, `data.totalLogs` |
| Live demo strip | `GET /api/attacks/recent` | `data[].ip`, `data[].attackType`, `data[].severity`, `data[].createdAt` |

**Error handling**: If either call fails, hide that section silently.
Do NOT show an error banner on the landing page.

---

## AI Build Instructions

```
You are building the Landing page for SENTINAL, a developer security tool.
Tone: dark, minimal, technical. Like Vercel or Linear, not a SaaS marketing page.

Rules:
- Use framer-motion for stagger entrance animations on hero only
- Use lucide-react for icons
- Inter font for text, JetBrains Mono for code
- Colors from variables.css (--color-accent, --color-bg, etc.)
- No Tailwind, no component libraries
- Use plain CSS modules or inline styles
- API calls go through src/services/api.js only
- Socket is NOT used on this page
- Fetch stats on mount for counter strip
- Fetch recent attacks for live demo strip
- Both fetches fail silently (hide section, no error shown to user)
- CTA button routes to /dashboard via react-router-dom Link
- Docs link routes to /docs
- All imports use relative paths from src/
```
