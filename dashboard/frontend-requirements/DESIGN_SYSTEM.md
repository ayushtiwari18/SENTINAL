# SENTINAL — Design System

> Every color, font, spacing, and component variant is defined here.
> When building any component, reference this file — never hardcode values.

---

## Visual Identity

**Tone**: Operational. Clinical. Precision instrument.
Think: **Vercel dashboard meets a security terminal**.
Not a SaaS marketing product. Not a consumer app.

**Inspiration**:
- https://vercel.com/dashboard — dark, minimal, information-first
- https://linear.app — sharp edges, purposeful motion
- https://grafana.com — data-dense, no decoration
- https://warp.dev — terminal aesthetic in a web UI

---

## Colors

Define all colors as CSS custom properties in `src/styles/variables.css`.
Never hardcode hex values in components.

```css
/* src/styles/variables.css */
:root {
  /* Backgrounds */
  --color-bg:            #0a0a0a;   /* page background */
  --color-surface:       #111111;   /* panels, cards */
  --color-surface-raised:#161616;   /* hover states, nested panels */
  --color-overlay:       #1a1a1a;   /* modals, drawers */

  /* Borders */
  --color-border:        #1e1e1e;   /* default border */
  --color-border-strong: #2a2a2a;   /* header/footer separator */
  --color-border-focus:  #00d4aa44; /* input focus ring */

  /* Text */
  --color-text:          #e2e2e2;   /* primary text */
  --color-text-secondary:#888888;   /* labels, secondary info */
  --color-text-muted:    #555555;   /* disabled, very secondary */
  --color-text-inverse:  #0a0a0a;   /* text on accent background */

  /* Accent */
  --color-accent:        #00d4aa;   /* teal — SENTINAL brand */
  --color-accent-dim:    #00d4aa22; /* teal glow / highlight bg */
  --color-accent-hover:  #00efc0;   /* lighter teal on hover */

  /* Severity */
  --color-critical:      #f44747;   /* critical severity */
  --color-high:          #ce9178;   /* high severity */
  --color-medium:        #dcdcaa;   /* medium severity */
  --color-low:           #9cdcfe;   /* low severity */

  /* Status */
  --color-online:        #4ec9b0;   /* service online, attack blocked */
  --color-offline:       #f44747;   /* service offline */
  --color-degraded:      #ce9178;   /* degraded state */

  /* Code */
  --color-code-text:     #9cdcfe;   /* inline code values */
  --color-code-bg:       #0d0d0d;   /* code block background */
  --color-code-string:   #ce9178;   /* string literals in code */
  --color-code-keyword:  #569cd6;   /* keywords in code */
  --color-code-comment:  #6a9955;   /* comments in code */
}
```

### Severity Color Map
```js
// src/utils/constants.js
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
```

---

## Typography

```css
/* src/styles/fonts.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-bg);
}

code, pre, .mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 13px;
}
```

### Type Scale

| Use | Size | Weight | Class/Style |
|-----|------|--------|-------------|
| Page title | 20px | 600 | `.page-title` |
| Section heading | 16px | 600 | `h2`, `.section-title` |
| Panel title | 13px | 500 | `.panel-title` |
| Body text | 14px | 400 | default |
| Secondary label | 12px | 400 | `.label` |
| Table data | 13px | 400 | `td` |
| Mono value (IP, payload) | 13px mono | 400 | `code`, `.mono` |
| Badge text | 11px | 500 | `.badge` |

---

## Spacing

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  24px;
--space-6:  32px;
--space-7:  48px;
```

- Page padding: `--space-5` (24px)
- Panel padding: `--space-4` (16px)
- Card gap: `--space-3` (12px)
- Table row: `8px 12px`

---

## Border Rules

- All panels: `1px solid var(--color-border)`
- Max border radius: `4px` — on panels and buttons
- No `border-radius` on tables, code blocks, or data cells
- No box shadows
- No gradients (exception: hero section accent glow only)

---

## Component Specs

### Panel
```jsx
// src/components/ui/Panel.jsx
// Props: title (string), actions (ReactNode), children
// Style: surface bg, border, padding
<div className="panel">
  <div className="panel-header">
    <span className="panel-title">{title}</span>
    <div className="panel-actions">{actions}</div>
  </div>
  <div className="panel-body">{children}</div>
</div>
```

### SeverityBadge
```jsx
// src/components/ui/SeverityBadge.jsx
// Props: severity ('low'|'medium'|'high'|'critical')
// Shows: colored text label
// Colors: from SEVERITY_COLORS constant
<span className={`badge sev-${severity}`}>{severity}</span>
```

### StatusDot
```jsx
// src/components/ui/StatusDot.jsx
// Props: status ('online'|'offline'|'degraded')
// Shows: small filled circle + text
<span className={`status-dot status-${status}`} />
```

### StatCard
```jsx
// src/components/ui/StatCard.jsx
// Props: label (string), value (number|string), icon (ReactNode), color (string)
// Shows: icon + number + label
// Animation: count-up on mount via framer-motion
```

### EmptyState
```jsx
// src/components/ui/EmptyState.jsx
// Props: message (string), icon (ReactNode optional)
// Use: whenever a list/table has 0 items
// Never return null for empty lists — always show EmptyState
<div className="empty-state">
  <span className="empty-icon">{icon || '—'}</span>
  <span className="empty-message">{message}</span>
</div>
```

### LoadingState
```jsx
// src/components/ui/LoadingState.jsx
// Props: message (string, default 'Loading...')
// No spinner. Plain text pulse animation.
<div className="loading-state">{message}</div>
```

### ErrorState
```jsx
// src/components/ui/ErrorState.jsx
// Props: message (string), onRetry (fn optional)
// Always log to console too.
<div className="error-state">
  <span>{message}</span>
  {onRetry && <button onClick={onRetry}>Retry</button>}
</div>
```

---

## Button Variants

```css
.btn           { border: 1px solid var(--color-border-strong); background: transparent; color: var(--color-text); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; }
.btn:hover     { border-color: var(--color-accent); color: var(--color-accent); }
.btn-primary   { background: var(--color-accent); color: var(--color-text-inverse); border-color: var(--color-accent); }
.btn-primary:hover { background: var(--color-accent-hover); }
.btn-danger    { color: var(--color-critical); border-color: var(--color-critical); }
.btn-sm        { padding: 3px 8px; font-size: 11px; }
```

---

## Table Style

```css
table  { width: 100%; border-collapse: collapse; font-size: 13px; }
th     { text-align: left; padding: 8px 12px; color: var(--color-text-secondary); font-weight: 500; border-bottom: 1px solid var(--color-border-strong); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
td     { padding: 8px 12px; border-bottom: 1px solid var(--color-border); color: var(--color-text); vertical-align: top; }
tr:hover td { background: var(--color-surface-raised); cursor: pointer; }
```

---

## Animation Guidelines (Framer Motion)

### Use ONLY for:
1. **Page transition** — `opacity: 0→1`, `y: 16→0`, duration `0.2s`
2. **New row in live feed** — `opacity: 0→1`, `y: -8→0`, duration `0.15s`
3. **Drawer open** — `x: 100%→0`, duration `0.25s`, ease `easeOut`
4. **Alert badge pulse** — `scale: 1→1.15→1` when new alert arrives
5. **Hero stagger** — tag → headline → sub → CTAs, delay `0.1s` each
6. **Stat count-up** — number animates 0→value on mount

### Do NOT use:
- Scroll-triggered animations anywhere in the app
- Parallax effects
- Rotating/spinning elements
- Looping animations
- Hover animations on table rows (use CSS `:hover` only)
- Exit animations on route change (enter only)

### Standard page transition wrapper:
```jsx
// src/components/layout/PageWrapper.jsx
import { motion } from 'framer-motion';
const PAGE_VARIANTS = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};
export default function PageWrapper({ children }) {
  return (
    <motion.div variants={PAGE_VARIANTS} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
```
