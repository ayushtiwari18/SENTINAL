import React, { useState, useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getAlerts, markAlertRead } from '../services/api';
import { formatDate } from '../utils/format';
import { Link } from 'react-router-dom';

const POLL = 30000;

export default function Alerts() {
  const { data: raw, loading, error, refetch } = useApi(() => getAlerts(100));
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({ severity: '', read: '' });

  React.useEffect(() => { if (raw) setAlerts(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('alert:new', useCallback((payload) => {
    const a = payload.data;
    setAlerts(prev => [{ ...a, _id: a.id, isRead: false }, ...prev]);
  }, []));

  const markRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    } catch (e) { console.error(e); }
  };

  const filtered = alerts.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.read === 'unread' && a.isRead)  return false;
    if (filter.read === 'read'   && !a.isRead) return false;
    return true;
  });

  const unread = alerts.filter(a => !a.isRead).length;

  if (loading) return <p>Loading alerts...</p>;
  if (error)   return <p>Error: {error} <button onClick={refetch}>Retry</button></p>;

  return (
    <div>
      <h2>Alerts — {unread} unread</h2>

      <div style={{ marginBottom: 10, display: 'flex', gap: 8 }}>
        <select value={filter.severity} onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}>
          <option value="">All Severity</option>
          {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filter.read} onChange={e => setFilter(f => ({ ...f, read: e.target.value }))}>
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <table border="1" cellPadding="6">
        <thead><tr><th>Time</th><th>Severity</th><th>Title</th><th>Type</th><th>Attack</th><th>Read</th><th></th></tr></thead>
        <tbody>
          {filtered.map(a => (
            <tr key={a._id} style={{ opacity: a.isRead ? 0.5 : 1 }}>
              <td>{formatDate(a.createdAt)}</td>
              <td>{a.severity}</td>
              <td>{a.title}</td>
              <td>{a.type}</td>
              <td>{a.attackId?._id ? <Link to={`/attacks/${a.attackId._id}`}>View</Link> : '—'}</td>
              <td>{a.isRead ? 'yes' : 'no'}</td>
              <td>{!a.isRead && <button onClick={() => markRead(a._id)}>Mark Read</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p>No alerts.</p>}
    </div>
  );
}
