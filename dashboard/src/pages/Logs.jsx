/**
 * Logs — redesigned with full design system.
 * Expandable rows, method + search filters, mono display.
 */
import React, { useState } from 'react';
import { useApi }      from '../hooks/useApi';
import { useInterval } from '../hooks/useInterval';
import { getRecentLogs } from '../services/api';
import { formatDate, truncate, fmtJson, formatMs } from '../utils/format';
import Panel       from '../components/ui/Panel';
import EmptyState  from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState  from '../components/ui/ErrorState';
import PageWrapper from '../components/layout/PageWrapper';

const POLL = 30000;
const METHODS = ['GET','POST','PUT','PATCH','DELETE'];

const METHOD_COLOR = {
  GET:    'var(--color-online)',
  POST:   'var(--color-accent)',
  PUT:    'var(--color-warning)',
  PATCH:  'var(--color-medium)',
  DELETE: 'var(--color-critical)',
};

export default function Logs() {
  const { data: raw, loading, error, refetch } = useApi(() => getRecentLogs(200));
  const [logs, setLogs]         = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter]     = useState({ method: '', search: '' });

  React.useEffect(() => { if (raw) setLogs(raw); }, [raw]);
  useInterval(refetch, POLL);

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const filtered = logs.filter(l => {
    if (filter.method && l.method !== filter.method) return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!l.ip?.includes(q) && !l.url?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <PageWrapper>
      <div className="page-container">

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">System Logs</h1>
            <p className="page-subtitle">
              {filtered.length} of {logs.length} entries
            </p>
          </div>
        </div>

        <Panel flush>
          {/* Filter Bar */}
          <div style={styles.filterBar}>
            <input
              type="text"
              placeholder="Search IP or URL…"
              value={filter.search}
              onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
              style={styles.searchInput}
            />
            <select value={filter.method} onChange={e => setFilter(f => ({ ...f, method: e.target.value }))}>
              <option value="">All Methods</option>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(filter.search || filter.method) && (
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter({ method: '', search: '' })}>
                ✕ Clear
              </button>
            )}
            <span style={styles.countLabel}>{filtered.length} / {logs.length}</span>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingState message="Loading logs..." />
          ) : error ? (
            <ErrorState message={error} onRetry={refetch} />
          ) : filtered.length === 0 ? (
            <EmptyState message="No logs. Is the middleware connected?" icon="📋" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>URL</th>
                    <th>IP</th>
                    <th>Code</th>
                    <th>Duration</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(l => (
                    <React.Fragment key={l._id}>
                      <tr>
                        <td style={styles.cellMono}>{formatDate(l.createdAt)}</td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            fontWeight: 'var(--weight-bold)',
                            color: METHOD_COLOR[l.method] || 'var(--color-text-secondary)',
                          }}>
                            {l.method}
                          </span>
                        </td>
                        <td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                            {truncate(l.url, 80)}
                          </code>
                        </td>
                        <td><code className="ip-addr">{l.ip}</code></td>
                        <td>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 'var(--text-xs)',
                            color: l.responseCode >= 400 ? 'var(--color-critical)'
                                 : l.responseCode >= 300 ? 'var(--color-warning)'
                                 : 'var(--color-online)',
                          }}>
                            {l.responseCode ?? '—'}
                          </span>
                        </td>
                        <td style={styles.cellMono}>{l.processingTimeMs != null ? `${l.processingTimeMs}ms` : '—'}</td>
                        <td>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px', fontSize: 'var(--text-xs)' }}
                            onClick={() => toggle(l._id)}
                          >
                            {expanded.has(l._id) ? '▲ Collapse' : '▼ Expand'}
                          </button>
                        </td>
                      </tr>
                      {expanded.has(l._id) && (
                        <tr style={{ background: 'var(--color-surface)' }}>
                          <td colSpan="7" style={{ padding: 'var(--space-4)' }}>
                            <div style={styles.expandGrid}>
                              <div>
                                <span style={styles.expandLabel}>Headers</span>
                                <pre style={styles.pre}>{fmtJson(l.headers)}</pre>
                              </div>
                              <div>
                                <span style={styles.expandLabel}>Query Params</span>
                                <pre style={styles.pre}>{fmtJson(l.queryParams)}</pre>
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={styles.expandLabel}>Body</span>
                                <pre style={styles.pre}>{fmtJson(l.body)}</pre>
                              </div>
                            </div>
                            <span style={{ ...styles.expandLabel, marginTop: 'var(--space-2)', display: 'block' }}>
                              Project: {l.projectId || '—'}
                            </span>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
  searchInput: { minWidth: '200px', flex: 1 },
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
  expandGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-3)',
  },
  expandLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
    display: 'block',
    marginBottom: 'var(--space-1)',
  },
  pre: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-code)',
    background: 'var(--color-code-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)',
    margin: 0,
    overflowX: 'auto',
    maxHeight: '160px',
  },
};
