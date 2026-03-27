/**
 * Attacks — redesigned with full design system.
 * All logic preserved: socket feed, filters, pagination indicator.
 */
import React, { useState, useCallback } from 'react';
import { useNavigate }  from 'react-router-dom';
import { useApi }       from '../hooks/useApi';
import { useSocket }    from '../hooks/useSocket';
import { useInterval }  from '../hooks/useInterval';
import { getRecentAttacks } from '../services/api';
import { formatDate, formatConf } from '../utils/format';
import { ATTACK_TYPES, ATTACK_STATUSES, SEVERITY_LEVELS } from '../utils/constants';
import Panel           from '../components/ui/Panel';
import SeverityBadge   from '../components/ui/SeverityBadge';
import StatusBadge     from '../components/ui/StatusBadge';
import EmptyState      from '../components/ui/EmptyState';
import LoadingState    from '../components/ui/LoadingState';
import ErrorState      from '../components/ui/ErrorState';
import PageWrapper     from '../components/layout/PageWrapper';

const POLL = 30000;

export default function Attacks() {
  const navigate = useNavigate();
  const { data: raw, loading, error, refetch } = useApi(() => getRecentAttacks(200));
  const [attacks, setAttacks] = useState([]);
  const [filter, setFilter]   = useState({ severity: '', type: '', status: '', search: '' });

  React.useEffect(() => { if (raw) setAttacks(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('attack:new', useCallback((payload) => {
    const a = payload.data;
    setAttacks(prev => [{ ...a, _id: a.id }, ...prev].slice(0, 200));
  }, []));

  const filtered = attacks.filter(a => {
    if (filter.severity && a.severity !== filter.severity)   return false;
    if (filter.type     && a.attackType !== filter.type)     return false;
    if (filter.status   && a.status !== filter.status)       return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!a.ip?.includes(q) && !a.attackType?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <PageWrapper>
      <div className="page-container">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">Attacks</h1>
            <p className="page-subtitle">
              Showing {filtered.length} of {attacks.length} recorded attacks
            </p>
          </div>
        </div>

        <Panel flush>
          {/* Filter Bar */}
          <div style={styles.filterBar}>
            <input
              type="text"
              placeholder="Search IP or type…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              style={styles.searchInput}
            />
            <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
              <option value="">All Severity</option>
              {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
              <option value="">All Types</option>
              {ATTACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              {ATTACK_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {(filter.search || filter.severity || filter.type || filter.status) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilter({ severity: '', type: '', status: '', search: '' })}
              >
                ✕ Clear
              </button>
            )}
            <span style={styles.countLabel}>
              {filtered.length} / {attacks.length}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingState message="Loading attacks..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState message="No attacks match the current filter." icon="🛡" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source IP</th>
                    <th>Attack Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Detected By</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr key={a._id}>
                      <td style={styles.cellMono}>{formatDate(a.createdAt)}</td>
                      <td><code className="ip-addr">{a.ip}</code></td>
                      <td><span className="attack-tag">{a.attackType}</span></td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td><StatusBadge  status={a.status}    /></td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                        {a.detectedBy || '—'}
                      </td>
                      <td style={styles.cellMono}>{formatConf(a.confidence)}</td>
                      <td>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '2px 10px' }}
                          onClick={() => navigate(`/attacks/${a._id}`)}
                        >
                          Investigate →
                        </button>
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
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    flexWrap: 'wrap',
  },
  searchInput: {
    minWidth: '200px',
    flex: 1,
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
