# Route: `/settings` — Settings

## Purpose
Lets the operator configure frontend behavior and connection settings.
Phase 1 (now): local-only settings stored in localStorage.
Phase 2 (future): project/org settings via API.

## Inspiration
- https://linear.app/settings — clean left-nav settings layout
- https://vercel.com/account — section-based settings, no modal

---

## Layout

```
[PageWrapper fade-in]

Page Title: "Settings"

Section 1: Connection
  Gateway URL:   [text input]  default: http://localhost:3000
  [Save]  [Test Connection]
  Status: "Connected" | "Unreachable"

Section 2: Display
  Polling Interval:   [select: 10s | 30s | 60s]  default: 30s
  Max Feed Rows:      [select: 20 | 50 | 100]     default: 50

Section 3: Notifications
  [Toggle] Show toast on new attack
  [Toggle] Show toast on new alert
  [Toggle] Sound (future — disabled for now)

Section 4: About
  Version: 1.0.0
  Backend: http://localhost:3000
  Dashboard: http://localhost:5173
  Built for HackByte 4.0
  [GitHub link]
```

---

## State Management

All settings live in `localStorage` under the key `sentinal_settings`.

```js
const DEFAULT_SETTINGS = {
  gatewayUrl:       'http://localhost:3000',
  pollIntervalMs:   30000,
  maxFeedRows:      50,
  toastOnAttack:    true,
  toastOnAlert:     true,
};
```

On mount: read from localStorage, fall back to defaults.
On save: write to localStorage, show toast "Settings saved".

---

## Components

```
src/pages/Settings.jsx
src/components/ui/Panel.jsx
```

No sub-components needed. Settings page is self-contained.

---

## API Calls

### Test Connection
- **Endpoint**: `GET /api/health`
- **Function**: `getHealth()` from `services/api.js`
- **Trigger**: Only when user clicks "Test Connection" button
- **Success**: Show "Connected — uptime Xs" in green
- **Failure**: Show "Unreachable — check gateway URL" in red

No other API calls on this page.

---

## Field Mapping

| Setting | localStorage Key | Default | Input Type |
|---------|-----------------|---------|------------|
| Gateway URL | `gatewayUrl` | `http://localhost:3000` | text input |
| Poll Interval | `pollIntervalMs` | `30000` | select |
| Max Feed Rows | `maxFeedRows` | `50` | select |
| Toast on Attack | `toastOnAttack` | `true` | toggle/checkbox |
| Toast on Alert | `toastOnAlert` | `true` | toggle/checkbox |

---

## States

| State | Display |
|-------|---------|
| Connection test loading | Button shows "Testing..." (disabled) |
| Connection test success | "✓ Connected — uptime 342s" in `--color-online` |
| Connection test failure | "✗ Unreachable" in `--color-critical` |
| Settings saved | `react-hot-toast` success toast: "Settings saved" |
| Settings reset | Toast: "Settings reset to defaults" |

---

## AI Build Instructions

```
You are building the Settings page for SENTINAL.

Rules:
- Route: /settings
- Wrap in PageWrapper for fade-in
- AppLayout (Navbar + Footer) already wraps this via router

State:
- All settings stored in localStorage under key 'sentinal_settings'
- On mount: JSON.parse(localStorage.getItem('sentinal_settings')) || DEFAULT_SETTINGS
- On save: JSON.stringify and set in localStorage, show react-hot-toast success

Sections (use Panel component for each):
1. Connection — gatewayUrl text input + "Test Connection" button
   - Test calls getHealth() from services/api.js
   - Show result inline below input
2. Display — pollIntervalMs select (10000/30000/60000 → show as 10s/30s/60s)
            — maxFeedRows select (20/50/100)
3. Notifications — toastOnAttack toggle, toastOnAlert toggle
4. About — static version info panel

Import react-hot-toast for save feedback.
Never redirect on save — stay on the same page.
Add a "Reset to Defaults" button at the bottom of the page.
No API calls except the optional health check test.
No socket events on this page.
```
