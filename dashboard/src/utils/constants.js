// ============================================================
// SENTINAL — Application Constants
// Single source of truth for routes, colors, types, and config.
// ============================================================

export const ROUTES = {
  LANDING:      '/',
  DASHBOARD:    '/dashboard',
  ATTACKS:      '/attacks',
  FORENSICS:    (id) => `/attacks/${id}`,
  ALERTS:       '/alerts',
  LOGS:         '/logs',
  PCAP:         '/pcap',
  ACTION_QUEUE: '/action-queue',
  AUDIT:        '/audit',
  SERVICES:     '/services',
  SETTINGS:     '/settings',
  SIMULATE:     '/simulate',
  DOCS:         '/docs',
  COPILOT:      '/copilot',
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
  'sqli',
  'xss',
  'traversal',
  'command_injection',
  'ssrf',
  'lfi_rfi',
  'brute_force',
  'hpp',
  'xxe',
  'webshell',
  'unknown',
];

export const SEVERITY_LEVELS  = ['low', 'medium', 'high', 'critical'];
export const ATTACK_STATUSES  = ['attempt', 'successful', 'blocked'];
export const DETECTED_BY_OPTIONS = ['rule', 'ml', 'both'];

export const POLL_INTERVAL    = 30_000; // 30s
export const FEED_LIMIT       = 50;
export const LOG_LIMIT        = 100;
export const ALERT_LIMIT      = 100;
export const AUDIT_LIMIT      = 100;

export const NAV_LINKS = [
  { to: ROUTES.DASHBOARD,    label: 'Dashboard',    icon: 'LayoutDashboard' },
  { to: ROUTES.ATTACKS,      label: 'Attacks',      icon: 'Zap',            badge: null },
  { to: ROUTES.ALERTS,       label: 'Alerts',       icon: 'Bell',           badge: 'alerts' },
  { to: ROUTES.LOGS,         label: 'Logs',         icon: 'ScrollText' },
  { to: ROUTES.PCAP,         label: 'PCAP',         icon: 'FileSearch' },
  { to: ROUTES.ACTION_QUEUE, label: 'Actions',      icon: 'ListChecks',     badge: 'queue' },
  { to: ROUTES.AUDIT,        label: 'Audit',        icon: 'ClipboardList' },
  { to: ROUTES.SERVICES,     label: 'Services',     icon: 'Activity' },
  { to: ROUTES.COPILOT,      label: 'AI Copilot',   icon: 'Bot',            ai: true },
  { to: ROUTES.SIMULATE,     label: 'Simulate',     icon: 'Sword',          danger: true },
  { to: ROUTES.SETTINGS,     label: 'Settings',     icon: 'Settings' },
];

export const SERVICE_NAMES = {
  gateway:   'Gateway API',
  detection: 'Detection Engine',
  armoriq:   'SENTINAL Response Engine',
  pcap:      'PCAP Processor',
  mongodb:   'MongoDB Atlas',
};
