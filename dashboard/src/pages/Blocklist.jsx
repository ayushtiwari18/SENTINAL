/**
 * SENTINAL — Blocklist Page
 * Route: /blocklist
 *
 * Features:
 *  - View all currently active blocked IPs
 *  - Manual block: enter an IP + optional reason + duration
 *  - Unblock (human override): DELETE /api/blocklist/:ip
 *  - Auto-refresh every 30 seconds
 *  - Live badge count in Navbar via window event
 */
import { useEffect, useState, useCallback } from 'react';
import {
  getBlocklist,
  blockIP,
  unblockIP,
} from '../services/api';

const SEV_COLOR = {
  brute_force:   '#ef4444',
  sql_injection: '#f97316',
  xss:           '#eab308',
  ddos:          '#8b5cf6',
  default:       '#6b7280',
};

function attackColor(type = '') {
  return SEV_COLOR[type] ?? SEV_COLOR.default;
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function expiryLabel(expiresAt) {
  if (!expiresAt) return <span style={styles.tagPermanent}>Permanent</span>;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0)  return <span style={styles.tagExpired}>Expired</span>;
  const mins = Math.round(diff / 60000);
  if (mins < 60)  return <span style={styles.tagTemp}>Expires in {mins}m</span>;
  return <span style={styles.tagTemp}>Expires in {Math.round(mins / 60)}h</span>;
}

export default function Blocklist() {
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [unblocking, setUnblocking] = useState(null); // ip string being unblocked

  // Manual block form
  const [form, setForm] = useState({ ip: '', reason: '', durationMinutes: '60' });
  const [blocking, setBlocking] = useState(false);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await getBlocklist();
      setList(data || []);
      setError(null);
    } catch (e) {
      setError('Failed to load blocklist: ' + (e?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const handleUnblock = async (ip) => {
    if (!window.confirm(`Unblock ${ip}? This will allow traffic from this IP immediately.`)) return;
    setUnblocking(ip);
    try {
      await unblockIP(ip);
      setList(prev => prev.filter(e => e.ip !== ip));
    } catch (e) {
      alert('Unblock failed: ' + (e?.message || 'Unknown error'));
    } finally {
      setUnblocking(null);
    }
  };

  const handleBlock = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    const ip = form.ip.trim();
    if (!ip) return setFormError('IP address is required.');
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F:]+)$/;
    if (!ipRegex.test(ip)) return setFormError('Enter a valid IPv4 or IPv6 address.');

    setBlocking(true);
    try {
      await blockIP({
        ip,
        reason:          form.reason.trim() || 'Manually blocked via dashboard',
        durationMinutes: form.durationMinutes ? parseInt(form.durationMinutes, 10) : null,
        blockedBy:       'human-dashboard',
      });
      setFormSuccess(`${ip} has been blocked.`);
      setForm({ ip: '', reason: '', durationMinutes: '60' });
      load();
    } catch (err) {
      setFormError('Block failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setBlocking(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🚫 IP Blocklist</h1>
          <p style={styles.subtitle}>
            Active blocked IPs enforced by SENTINAL middleware. Blocks expire automatically or can be removed manually.
          </p>
        </div>
        <div style={styles.countBadge}>
          {list.length} Active Block{list.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* ── Manual Block Form ── */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>➕ Block an IP Manually</h2>
        <form onSubmit={handleBlock} style={styles.form}>
          <div style={styles.formRow}>
            <div style={styles.formGroup}>
              <label style={styles.label}>IP Address *</label>
              <input
                style={styles.input}
                placeholder="e.g. 192.168.1.100"
                value={form.ip}
                onChange={e => setForm(f => ({ ...f, ip: e.target.value }))}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Reason</label>
              <input
                style={styles.input}
                placeholder="Optional reason"
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <div style={{ ...styles.formGroup, maxWidth: 160 }}>
              <label style={styles.label}>Duration (minutes, 0 = permanent)</label>
              <input
                style={styles.input}
                type="number"
                min="0"
                placeholder="60"
                value={form.durationMinutes}
                onChange={e => setForm(f => ({ ...f, durationMinutes: e.target.value }))}
              />
            </div>
            <button
              type="submit"
              style={{ ...styles.btn, ...styles.btnDanger, alignSelf: 'flex-end' }}
              disabled={blocking}
            >
              {blocking ? 'Blocking…' : '🚫 Block IP'}
            </button>
          </div>
          {formError   && <p style={styles.errorMsg}>{formError}</p>}
          {formSuccess && <p style={styles.successMsg}>{formSuccess}</p>}
        </form>
      </div>

      {/* ── Blocklist Table ── */}
      <div style={styles.card}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>🔒 Active Blocks</h2>
          <button style={{ ...styles.btn, ...styles.btnGhost }} onClick={load}>
            ↻ Refresh
          </button>
        </div>

        {loading && <p style={styles.muted}>Loading…</p>}
        {error   && <p style={styles.errorMsg}>{error}</p>}

        {!loading && !error && list.length === 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 40 }}>✅</span>
            <p>No IPs are currently blocked.</p>
          </div>
        )}

        {!loading && list.length > 0 && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['IP Address', 'Attack Type', 'Reason', 'Blocked', 'Expires', 'Blocked By', 'Action'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(entry => (
                  <tr key={entry._id || entry.ip} style={styles.tr}>
                    <td style={styles.td}>
                      <span style={styles.ipBadge}>{entry.ip}</span>
                    </td>
                    <td style={styles.td}>
                      {entry.attackType ? (
                        <span style={{ ...styles.typeBadge, background: attackColor(entry.attackType) + '22', color: attackColor(entry.attackType), border: `1px solid ${attackColor(entry.attackType)}44` }}>
                          {entry.attackType}
                        </span>
                      ) : <span style={styles.muted}>—</span>}
                    </td>
                    <td style={{ ...styles.td, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {entry.reason || <span style={styles.muted}>—</span>}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.muted}>{timeAgo(entry.blockedAt)}</span>
                    </td>
                    <td style={styles.td}>{expiryLabel(entry.expiresAt)}</td>
                    <td style={styles.td}>
                      <span style={styles.blockedBy}>{entry.blockedBy || '—'}</span>
                    </td>
                    <td style={styles.td}>
                      <button
                        style={{ ...styles.btn, ...styles.btnUnblock }}
                        onClick={() => handleUnblock(entry.ip)}
                        disabled={unblocking === entry.ip}
                      >
                        {unblocking === entry.ip ? 'Unblocking…' : '✅ Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: { padding: '24px 28px', color: '#e2e8f0', maxWidth: 1200, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: '#f8fafc', letterSpacing: 0.3 },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: '#94a3b8' },
  countBadge: { background: '#dc262622', border: '1px solid #dc262644', color: '#f87171', borderRadius: 8, padding: '6px 16px', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' },
  card: { background: '#111827', border: '1px solid #1f2937', borderRadius: 10, padding: '20px 24px', marginBottom: 20 },
  cardTitle: { margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: '#cbd5e1' },
  form: {},
  formRow: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 160 },
  label: { fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  input: { background: '#1f2937', border: '1px solid #374151', borderRadius: 6, padding: '8px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none' },
  btn: { padding: '8px 16px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' },
  btnDanger:  { background: '#dc2626', color: '#fff' },
  btnUnblock: { background: '#065f4622', border: '1px solid #10b98144', color: '#34d399', fontSize: 11 },
  btnGhost:   { background: 'transparent', border: '1px solid #374151', color: '#94a3b8' },
  errorMsg:   { color: '#f87171', fontSize: 12, marginTop: 8 },
  successMsg: { color: '#34d399', fontSize: 12, marginTop: 8 },
  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #1f2937', fontWeight: 600 },
  tr: { borderBottom: '1px solid #1a2236' },
  td: { padding: '10px 12px', verticalAlign: 'middle' },
  ipBadge:   { background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '2px 8px', fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0' },
  typeBadge: { borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 },
  tagPermanent: { background: '#7c3aed22', border: '1px solid #7c3aed44', color: '#a78bfa', borderRadius: 4, padding: '2px 8px', fontSize: 11 },
  tagTemp:      { background: '#0284c722', border: '1px solid #0284c744', color: '#38bdf8', borderRadius: 4, padding: '2px 8px', fontSize: 11 },
  tagExpired:   { background: '#37415122', border: '1px solid #37415144', color: '#6b7280', borderRadius: 4, padding: '2px 8px', fontSize: 11 },
  blockedBy:    { fontSize: 11, color: '#64748b' },
  muted:        { color: '#4b5563', fontSize: 12 },
  empty:        { textAlign: 'center', padding: '40px 0', color: '#4b5563', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
};
