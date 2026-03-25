import React, { useState, useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getRecentAttacks } from '../services/api';
import { formatDate, formatConf } from '../utils/format';
import { useNavigate } from 'react-router-dom';

const POLL = 30000;

export default function Attacks() {
  const navigate = useNavigate();
  const { data: raw, loading, error, refetch } = useApi(() => getRecentAttacks(100));
  const [attacks, setAttacks] = useState([]);
  const [filter, setFilter]   = useState({ severity: '', type: '', status: '', search: '' });

  React.useEffect(() => { if (raw) setAttacks(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('attack:new', useCallback((payload) => {
    const a = payload.data;
    setAttacks(prev => [{ ...a, _id: a.id }, ...prev].slice(0, 200));
  }, []));

  const filtered = attacks.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.type     && a.attackType !== filter.type)   return false;
    if (filter.status   && a.status !== filter.status)     return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!a.ip?.includes(q) && !a.attackType?.includes(q)) return false;
    }
    return true;
  });

  if (loading) return <p>Loading attacks...</p>;
  if (error)   return <p>Error: {error} <button onClick={refetch}>Retry</button></p>;

  return (
    <div>
      <h2>Attacks</h2>

      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <input placeholder="Search IP or type" value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All Severity</option>
          {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          {['sqli','xss','traversal','command_injection','ssrf','lfi_rfi','brute_force','hpp','xxe','webshell','unknown'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          {['attempt','successful','blocked'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <p>Showing {filtered.length} of {attacks.length} attacks</p>

      <table border="1" cellPadding="6">
        <thead><tr><th>Time</th><th>IP</th><th>Type</th><th>Severity</th><th>Status</th><th>By</th><th>Confidence</th><th></th></tr></thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a._id}>
              <td>{formatDate(a.createdAt)}</td>
              <td><code>{a.ip}</code></td>
              <td>{a.attackType}</td>
              <td>{a.severity}</td>
              <td>{a.status}</td>
              <td>{a.detectedBy}</td>
              <td>{formatConf(a.confidence)}</td>
              <td><button onClick={() => navigate(`/attacks/${a._id}`)}>Investigate</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
