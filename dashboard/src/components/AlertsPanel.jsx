/**
 * AlertsPanel
 * Source: GET /api/alerts
 * Socket: alert:new — payload { event, timestamp, data: { id, title, severity, type, timestamp } }
 * Response.data: Alert[] — each has: _id, attackId, title, message, severity, type, isRead, createdAt
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getAlerts, markAlertRead } from '../services/api';
import socket from '../services/socket';

const REFRESH_MS = 30000;

const sevClass = (s) => `sev-${s}`;

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

export default function AlertsPanel() {
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    console.log('[AlertsPanel] Fetching alerts');
    try {
      const data = await getAlerts(30);
      setAlerts(data);
      setError(null);
    } catch (err) {
      console.error('[AlertsPanel] Failed to fetch alerts:', err.message);
      setError('Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Real-time listener
  useEffect(() => {
    const handler = (payload) => {
      console.log('[AlertsPanel] alert:new received', payload);
      const alert = payload.data;
      setAlerts((prev) => [{ ...alert, _id: alert.id, isRead: false }, ...prev].slice(0, 100));
    };
    socket.on('alert:new', handler);
    return () => socket.off('alert:new', handler);
  }, []);

  const handleMarkRead = async (alertId) => {
    try {
      await markAlertRead(alertId);
      setAlerts((prev) => prev.map((a) => a._id === alertId ? { ...a, isRead: true } : a));
    } catch (err) {
      console.error('[AlertsPanel] Failed to mark alert read:', err.message);
    }
  };

  const unread = alerts.filter((a) => !a.isRead).length;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="title">Alerts</span>
        <span style={{ color: unread > 0 ? '#f44747' : '#555' }}>
          {unread > 0 ? `${unread} unread` : 'all read'}
        </span>
      </div>
      <div className="panel-body" style={{ padding: 0 }}>
        {loading && <div className="loading" style={{ padding: 12 }}>Loading...</div>}
        {error   && <div className="error">Error: {error}</div>}
        {!loading && !error && alerts.length === 0 && (
          <div className="loading">No alerts.</div>
        )}
        {alerts.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>Type</th>
                  <th>Read</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={a._id || i} style={{ opacity: a.isRead ? 0.5 : 1 }}>
                    <td style={{ color: '#666' }}>{fmtTime(a.createdAt)}</td>
                    <td>{a.title}</td>
                    <td className={sevClass(a.severity)}>{a.severity}</td>
                    <td style={{ color: '#888' }}>{a.type}</td>
                    <td style={{ color: a.isRead ? '#4ec9b0' : '#f44747' }}>
                      {a.isRead ? 'yes' : 'no'}
                    </td>
                    <td>
                      {!a.isRead && (
                        <button onClick={() => handleMarkRead(a._id)}>mark read</button>
                      )}
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
