// ============================================================
// SENTINAL — Format Utilities
// All date, number, text formatting used across the app.
// ============================================================

// ── Date / Time ───────────────────────────────────────────────
export const formatDate = (ts) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const se = String(d.getSeconds()).padStart(2, '0');
    return `${d.getFullYear()}-${mo}-${dy} ${hr}:${mi}:${se}`;
  } catch { return '—'; }
};

export const formatDateShort = (ts) => {
  if (!ts) return '—';
  try {
    const d = new Date(ts);
    const mo = d.toLocaleString('default', { month: 'short' });
    const dy = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mo} ${dy}, ${hr}:${mi}`;
  } catch { return '—'; }
};

export const formatRelTime = (ts) => {
  if (!ts) return '—';
  try {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60_000)   return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  } catch { return '—'; }
};

export const formatTimestamp = (ts) => {
  if (!ts) return '—';
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch { return '—'; }
};

// ── Numbers ───────────────────────────────────────────────────
export const formatConf = (c) =>
  c != null ? `${Math.round(c * 100)}%` : '—';

export const formatNumber = (n) =>
  n != null ? Number(n).toLocaleString() : '—';

export const formatBytes = (bytes) => {
  if (bytes == null) return '—';
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatMs = (ms) =>
  ms != null ? `${ms}ms` : '—';

// ── Text ──────────────────────────────────────────────────────
export const truncate = (s, n = 60) =>
  s && s.length > n ? s.slice(0, n) + '…' : (s || '—');

export const capitalize = (s) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

export const fmtJson = (obj) => {
  try { return JSON.stringify(obj, null, 2); }
  catch { return String(obj); }
};

export const parseExplanation = (raw) => {
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { return { summary: raw || '(no explanation)' }; }
};

// ── IP ────────────────────────────────────────────────────────
export const isPrivateIp = (ip) => {
  if (!ip) return false;
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.') ||
    ip === '127.0.0.1' ||
    ip === 'localhost'
  );
};
