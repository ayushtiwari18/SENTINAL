/**
 * Alerts — redesigned with full design system.
 * All logic preserved: socket, mark-read, mark-all-read, filters.
 */
import React, { useState, useCallback } from 'react';
import { Link }        from 'react-router-dom';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getAlerts, markAlertRead } from '../services/api';
import { formatDate }  from '../utils/format';
import Panel           from '../components/ui/Panel';
import SeverityBadge   from '../components/ui/SeverityBadge';
import EmptyState      from '../components/ui/EmptyState';
import LoadingState    from '../components/ui/LoadingState';
import ErrorState      from '../components/ui/ErrorState';
import PageWrapper     from '../components/layout/PageWrapper';

const POLL = 30000;

const TYPE_COLOR = {
  Nexus_action:  'var(--color-accent)',
  attack_detected: 'var(--color-high)',
  service_down:    'var(--color-critical)',
  rate_limit:      'var(--color-warning)',
  anomaly:         'var(--color-medium)',
};

export default function Alerts() {
  const { data: raw, loading, error, refetch } = useApi(() => getAlerts(200));
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({ severity: '', read: '', type: '' });

  React.useEffect(() => { if (raw) setAlerts(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('alert:new', useCallback((payload) => {
    const a = payload.data ?? payload;
    setAlerts(prev => [{ ...a, _id: a.id ?? a._id, isRead: false }, ...prev]);
  }, []));

  const markRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unread = alerts.filter(a => !a.isRead);
    await Promise.allSettled(unread.map(a => markAlertRead(a._id)));
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const filtered = alerts.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.type     && a.type     !== filter.type)     return false;
    if (filter.read === 'unread' && a.isRead)              return false;
    if (filter.read === 'read'   && !a.isRead)             return false;
    return true;
  });

  const unread = alerts.filter(a => !a.isRead).length;

  const attackHref = (a) => {
    const id = a.attackId?._id ?? a.attackId;
    return id ? `/attacks/${id}` : null;
  };

  return (
    <PageWrapper>
      <div className="page-container">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">
              Alerts
              {unread > 0 && (
                <span style={styles.unreadPill}>{unread} unread</span>
              )}
            </h1>
            <p className="page-subtitle">Attack detections and Nexus enforcement alerts.</p>
          </div>
          {unread > 0 && (
            <div className="page-actions">
              <button onClick={markAllRead} className="btn btn-ghost btn-sm">
                ✓ Mark All Read
              </button>
            </div>
          )}
        </div>

        <Panel flush>
          {/* Filter Bar */}
          <div style={styles.filterBar}>
            <select
              value={filter.severity}
              onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
            >
              <option value="">All Severity</option>
              {['critical','high','medium','low'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filter.type}
              onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
            >
              <option value="">All Types</option>
              {['attack_detected','Nexus_action','service_down','rate_limit','anomaly'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filter.read}
              onChange={e => setFilter(f => ({ ...f, read: e.target.value }))}
            >
              <option value="">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <span style={styles.filterCount}>
              {filtered.length} / {alerts.length}
            </span>
          </div>

          {/* Content */}
          {loading ? (
            <LoadingState message="Loading alerts..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState message="No alerts match the current filter." icon="🔔" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Attack</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(a => (
                    <tr
                      key={a._id}
                      style={{
                        opacity: a.isRead ? 0.5 : 1,
                        background: a.type === 'Nexus_action' && !a.isRead
                          ? 'rgba(0,212,170,0.04)' : 'transparent',
                      }}
                    >
                      <td style={styles.cellMono}>{formatDate(a.createdAt)}</td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td style={{ color: 'var(--color-text)', fontWeight: 'var(--weight-medium)' }}>
                        {a.title}
                      </td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-xs)',
                          color: TYPE_COLOR[a.type] || 'var(--color-text-secondary)',
                        }}>
                          {a.type}
                        </span>
                      </td>
                      <td>
                        {attackHref(a)
                          ? <Link to={attackHref(a)} style={styles.linkBtn}>View →</Link>
                          : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                      </td>
                      <td>
                        {a.isRead
                          ? <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>read</span>
                          : <span style={{ color: 'var(--color-online)', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>new</span>}
                      </td>
                      <td>
                        {!a.isRead && (
                          <button
                            onClick={() => markRead(a._id)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px' }}
                          >
                            Mark Read
                          </button>
                        )}
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
  unreadPill: {
    marginLeft: 'var(--space-3)',
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-sm)',
    fontWeight: 'var(--weight-semibold)',
    background: 'var(--color-critical)',
    color: '#fff',
    verticalAlign: 'middle',
  },
  filterBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    flexWrap: 'wrap',
  },
  filterCount: {
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
  linkBtn: {
    color: 'var(--color-accent)',
    fontSize: 'var(--text-xs)',
    textDecoration: 'none',
  },
};
