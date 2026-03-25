import React, { useState, useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useInterval } from '../hooks/useInterval';
import { getRecentLogs } from '../services/api';
import { formatDate, truncate, fmtJson } from '../utils/format';

const POLL = 30000;

export default function Logs() {
  const { data: raw, loading, error, refetch } = useApi(() => getRecentLogs(100));
  const [logs, setLogs]     = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter] = useState({ method: '', search: '' });

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

  if (loading) return <p>Loading logs...</p>;
  if (error)   return <p>Error: {error} <button onClick={refetch}>Retry</button></p>;

  return (
    <div>
      <h2>System Logs — {filtered.length} entries</h2>

      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <input placeholder="Search IP or URL" value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        <select value={filter.method} onChange={e => setFilter(f => ({ ...f, method: e.target.value }))}>
          <option value="">All Methods</option>
          {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <table border="1" cellPadding="6">
        <thead><tr><th>Time</th><th>Method</th><th>URL</th><th>IP</th><th>Code</th><th>ms</th><th></th></tr></thead>
        <tbody>
          {filtered.map(l => (
            <React.Fragment key={l._id}>
              <tr>
                <td>{formatDate(l.createdAt)}</td>
                <td>{l.method}</td>
                <td><code>{truncate(l.url, 80)}</code></td>
                <td><code>{l.ip}</code></td>
                <td>{l.responseCode ?? '—'}</td>
                <td>{l.processingTimeMs ?? '—'}</td>
                <td><button onClick={() => toggle(l._id)}>{expanded.has(l._id) ? 'Collapse' : 'Expand'}</button></td>
              </tr>
              {expanded.has(l._id) && (
                <tr><td colSpan="7">
                  <pre>Headers: {fmtJson(l.headers)}</pre>
                  <pre>Query: {fmtJson(l.queryParams)}</pre>
                  <pre>Body: {fmtJson(l.body)}</pre>
                  <p>Project: {l.projectId}</p>
                </td></tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p>No logs. Is the middleware connected?</p>}
    </div>
  );
}
