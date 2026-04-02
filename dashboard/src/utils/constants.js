// ============================================================
// SENTINAL — Application Constants
// ============================================================

export const ROUTES = {
  LANDING:      '/',
  DASHBOARD:    '/dashboard',
  EXPLORE:      '/explore',
  ATTACKS:      '/attacks',
  FORENSICS:    (id) => `/attacks/${id}`,
  ALERTS:       '/alerts',
  LOGS:         '/logs',
  PCAP:         '/pcap',
  ACTION_QUEUE: '/action-queue',
  AUDIT:        '/audit',
  BLOCKLIST:    '/blocklist',
  GEO:          '/geo',
  SERVICES:     '/services',
  SETTINGS:     '/settings',
  SIMULATE:     '/simulate',
  DOCS:         '/docs',
  COPILOT:      '/copilot',
  CORRELATION:  '/correlation',
};

export const SEVERITY_COLORS = {
  critical: 'var(--color-critical)',
  high:     'var(--color-high)',
  medium:   'var(--color-medium)',
  low:      'var(--color-low)',
};

export const SEVERITY_BG = {
  critical: 'var(--color-critical-dim)',
  high:     'var(--color-high-dim)',
  medium:   'var(--color-medium-dim)',
  low:      'var(--color-low-dim)',
};

export const STATUS_COLORS = {
  blocked:    'var(--color-online)',
  successful: 'var(--color-critical)',
  attempt:    'var(--color-medium)',
  online:     'var(--color-online)',
  offline:    'var(--color-offline)',
  degraded:   'var(--color-degraded)',
  warning:    'var(--color-warning)',
};

export const STATUS_BADGE_CLASS = {
  blocked:    'badge-online',
  successful: 'badge-critical',
  attempt:    'badge-medium',
  online:     'badge-online',
  offline:    'badge-offline',
  degraded:   'badge-degraded',
};

export const SEVERITY_BADGE_CLASS = {
  critical: 'badge-critical',
  high:     'badge-high',
  medium:   'badge-medium',
  low:      'badge-low',
};

export const ATTACK_TYPES = [
  'sqli', 'xss', 'traversal', 'command_injection',
  'ssrf', 'lfi_rfi', 'brute_force', 'hpp', 'xxe', 'webshell', 'unknown',
];

export const SEVERITY_LEVELS       = ['low', 'medium', 'high', 'critical'];
export const ATTACK_STATUSES       = ['attempt', 'successful', 'blocked'];
export const DETECTED_BY_OPTIONS   = ['rule', 'ml', 'both'];

export const POLL_INTERVAL = 30_000;
export const FEED_LIMIT    = 50;
export const LOG_LIMIT     = 100;
export const ALERT_LIMIT   = 100;
export const AUDIT_LIMIT   = 100;

// ── NAV_LINKS — single source of truth for Navbar & mobile menu ──────────────
// Consumed by: dashboard/src/components/layout/Navbar.jsx
// icon values must match keys in the `icons` map inside Navbar.jsx
export const NAV_LINKS = [
  // ── Monitor ────────────────────────────────────────────────────────────────
  { to: ROUTES.DASHBOARD,    label: 'Dashboard',   icon: 'LayoutDashboard' },
  { to: ROUTES.ATTACKS,      label: 'Attacks',     icon: 'Zap' },
  { to: ROUTES.ALERTS,       label: 'Alerts',      icon: 'Bell',         badge: 'alerts' },
  { to: ROUTES.LOGS,         label: 'Logs',        icon: 'ScrollText' },
  { to: ROUTES.GEO,          label: 'Geo IP Map',  icon: 'Globe' },

  // ── Investigate ────────────────────────────────────────────────────────────
  { to: ROUTES.EXPLORE,      label: 'Explore',     icon: 'Compass' },
  { to: ROUTES.PCAP,         label: 'PCAP',        icon: 'FileSearch' },

  // ── Enforce ────────────────────────────────────────────────────────────────
  { to: ROUTES.BLOCKLIST,    label: 'Blocklist',   icon: 'ShieldOff',    badge: 'blocklist' },
  { to: ROUTES.ACTION_QUEUE, label: 'Actions',     icon: 'ListChecks',   badge: 'queue' },
  { to: ROUTES.AUDIT,        label: 'Audit',       icon: 'ClipboardList' },
  { to: ROUTES.SIMULATE,     label: 'Simulate',    icon: 'Sword',        danger: true },

  // ── AI ─────────────────────────────────────────────────────────────────────
  { to: ROUTES.COPILOT,      label: 'AI Copilot',  icon: 'Bot',          ai: true },
  { to: ROUTES.CORRELATION,  label: 'Correlation', icon: 'Network',      ai: true },

  // ── System ─────────────────────────────────────────────────────────────────
  { to: ROUTES.SERVICES,     label: 'Services',    icon: 'Activity' },
  { to: ROUTES.SETTINGS,     label: 'Settings',    icon: 'Settings' },
  { to: ROUTES.DOCS,         label: 'Docs',        icon: 'BookOpen' },
];

export const SERVICE_NAMES = {
  gateway:   'Gateway API',
  detection: 'Detection Engine',
  nexus:     'Nexus Agent',
  pcap:      'PCAP Processor',
  mongodb:   'MongoDB Atlas',
};
