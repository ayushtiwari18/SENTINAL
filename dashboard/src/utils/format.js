export const formatDate    = (ts) => ts ? new Date(ts).toLocaleString() : '—';
export const formatRelTime = (ts) => ts ? new Date(ts).toLocaleString() : '—';
export const formatConf    = (c)  => c  != null ? `${Math.round(c * 100)}%` : '—';
export const truncate      = (s, n = 60) => s && s.length > n ? s.slice(0, n) + '…' : (s || '—');
export const fmtJson       = (obj) => { try { return JSON.stringify(obj, null, 2); } catch { return String(obj); } };
export const parseExplanation = (raw) => {
  try { return JSON.parse(raw); }
  catch { return { summary: raw || '(no explanation)' }; }
};
