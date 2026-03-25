# Route: `*` — 404 Not Found

## Purpose
Handles any URL that doesn't match a defined route.
Should feel like part of the same product — not jarring or generic.

## Inspiration
- https://vercel.com/404 — minimal, dark, on-brand
- https://linear.app (any bad URL) — clean, single CTA back to app

---

## Layout

```
[Full page centered vertically + horizontally]

  [Mono tag, small, --color-text-muted]  ERROR_CODE: 404

  [Large mono number, --color-accent, 96px]  404

  [Body text, --color-text-secondary, 16px]
  "Route not found."
  "The page you're looking for doesn't exist or has been moved."

  [Two buttons]
  [primary]  ← Back to Dashboard
  [ghost]    View Docs

  [Footer-style line, --color-text-muted, 12px]
  SENTINAL / Security Operations
```

---

## Animation

- Fade + scale-up entrance for the 404 number:
  `opacity: 0→1`, `scale: 0.92→1`, `duration: 0.3s`
- Stagger buttons: delay `0.15s` after number
- No other animation

---

## Components

```
src/pages/NotFound.jsx
```

No sub-components. Self-contained. No Navbar/Footer (outside AppLayout).

---

## API Calls

None.

---

## AI Build Instructions

```
You are building the 404 Not Found page for SENTINAL.

Rules:
- This page is outside AppLayout — no Navbar, no Footer
- Full-page centered layout: height 100vh, flexbox column center
- Background: var(--color-bg) (#0a0a0a)

Content:
  1. Small label: "ERROR_CODE: 404" — mono font, --color-text-muted, 11px
  2. Large "404" — JetBrains Mono, 96px, --color-accent, font-weight 600
  3. Message: "Route not found." — Inter, 16px, --color-text
  4. Sub-message: "The page you're looking for doesn't exist." — 14px, --color-text-secondary
  5. Two buttons:
     - Primary: "← Back to Dashboard" → navigates to /dashboard via useNavigate
     - Ghost: "View Docs" → navigates to /docs
  6. Footer label: "SENTINAL / Security Operations" — 12px, --color-text-muted

Animation (framer-motion):
  - Wrap content in motion.div
  - Initial: { opacity: 0, scale: 0.92 }
  - Animate: { opacity: 1, scale: 1 }
  - Transition: { duration: 0.3 }
  - Buttons stagger: delay 0.15s after wrapper

No API calls. No socket. No imports from api.js or socket.js.
Use useNavigate from react-router-dom for button actions.
```
