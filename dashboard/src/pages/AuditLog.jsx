/**
 * AuditLog — redesigned with design system.
 * Stat bar as clickable filter pills, full table, auto-refresh.
 */
import { useEffect, useState, useCallback } from 'react';
import { getAuditLog } from '../services/api';
import { useInterval } from '../hooks/useInterval';
import Panel       from '../components/ui/Panel';
import EmptyState  from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState  from '../components/ui/ErrorState';
import PageWrapper from '../components/layout/PageWrapper';

const REFRESH_MS = 10000;

const ALL_ACTIONS = [
  'send_alert','log_attack','rate_limit_ip','flag_for_review',
  'permanent_ban_ip','shutdown_endpoint','purge_all_sessions','modify_firewall_rules',
];

const STATUS_META = {
  ALLOWED:  { color: 'var(--color-online)',   dim: 'rgba(75,181,67,0.1)'  },
  BLOCKED:  { color: 'var(--color-critical)', dim: 'rgba(244,71,71,0.1)'  },
  APPROVED: { color: 'var(--color-accent)',   dim: 'rgba(0,212,170,0.1)'  },
  REJECTED: { color: 'var(--color-text-muted)', dim: 'rgba(120,120,120,0.1)' },
};

export default function AuditLog() {
  const [entries,      setEntries]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const load = useCallback(() => {
    getAuditLog(200)
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useInterval(load, REFRESH_MS);

  const filtered = entries.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterAction && e.action !== filterAction) return false;
    return true;
  });

  const counts = ['ALLOWED','BLOCKED','APPROVED','REJECTED'].reduce((acc, s) => {
    acc[s] = entries.filter(e => e.status === s).length;
    return acc;
  }, {});

  return (
    <PageWrapper>
      <div className="page-container">

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">ArmorIQ Audit Log</h1>
            <p className="page-subtitle">
              Every policy decision made by ArmorIQ — full traceability. Auto-refreshes every 10s.
            </p>
          </div>
        </div>

        {/* Stat pills */}
        {!loading && entries.length > 0 && (
          <div style={styles.pillRow}>
            {['ALLOWED','BLOCKED','APPROVED','REJECTED'].map(s => {
              const m       = STATUS_META[s];
              const active  = filterStatus === s;
              return (
                <button
                  key={s}
                  onClick={() => setFilterStatus(prev => prev === s ? '' : s)}
                  style={{
                    ...styles.pill,
                    color: m.color,
                    background: active ? m.dim : 'var(--color-surface)',
                    border: `1px solid ${active ? m.color : 'var(--color-border)'}`,
                    boxShadow: active ? `0 0 0 1px ${m.color}` : 'none',
                  }}
                >
                  {s}: <strong>{counts[s]}</strong>
                </button>
              );
            })}
            {(filterStatus || filterAction) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setFilterStatus(''); setFilterAction(''); }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        )}

        <Panel flush>
          {/* Action filter bar */}
          {!loading && entries.length > 0 && (
            <div style={styles.filterBar}>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
              >
                <option value="">All Actions</option>
                {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
              <span style={styles.countLabel}>
                {filtered.length} / {entries.length} entries
              </span>
            </div>
          )}

          {loading  ? <LoadingState message="Loading audit log..." /> :
           error    ? <ErrorState message={error} onRetry={load} /> :
           entries.length === 0 ? (
            <EmptyState
              message="No audit entries yet. Run simulate_attack.sh to populate."
              icon="📋"
            />
          ) : filtered.length === 0 ? (
            <EmptyState message="No entries match the current filter." icon="🔍" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Policy Rule</th>
                    <th>IP</th>
                    <th>Triggered By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(entry => (
                    <tr key={entry._id}>
                      <td style={styles.cellMono}>{new Date(entry.createdAt).toLocaleString()}</td>
                      <td>
                        <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)' }}>
                          {entry.action}
                        </code>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: 'var(--weight-bold)',
                          color: STATUS_META[entry.status]?.color || 'var(--color-text-secondary)',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          {entry.status}
                        </span>
                      </td>
                      <td style={styles.cellMono}>{entry.policy_rule_id || '—'}</td>
                      <td><code className="ip-addr">{entry.ip || '—'}</code></td>
                      <td>
                        <span style={{
                          fontSize: 'var(--text-xs)',
                          fontWeight: entry.triggeredBy === 'human' ? 'var(--weight-semibold)' : 'var(--weight-normal)',
                          color: entry.triggeredBy === 'human' ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                          textTransform: 'capitalize',
                        }}>
                          {entry.triggeredBy}
                        </span>
                      </td>
                      <td style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-secondary)', fontSize: 'var(--text-xs)' }} title={entry.reason}>
                        {entry.reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

      </div>
    </PageWrapper>
  );
}

const styles = {
  pillRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-4)',
    alignItems: 'center',
  },
  pill: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--text-sm)',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    fontFamily: 'var(--font-mono)',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    flexWrap: 'wrap',
  },
  countLabel: {
    marginLeft: 'auto',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
  },
  cellMono: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
};
