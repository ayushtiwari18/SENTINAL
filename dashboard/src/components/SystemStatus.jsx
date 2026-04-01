/**
 * SystemStatus
 * Source: GET /api/service-status
 * Response: { overall, services: [{ name, status, latencyMs, lastChecked }], checkedAt }
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getServiceStatus } from '../services/api';

const REFRESH_MS = 30000;

export default function SystemStatus() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetch = useCallback(async () => {
    console.log('[SystemStatus] Fetching service status');
    try {
      const d = await getServiceStatus();
      setData(d);
      setError(null);
    } catch (err) {
      console.error('[SystemStatus] Failed to fetch service status:', err.message);
      setError('Failed to fetch service status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetch]);

  const statusClass = (s) => {
    if (s === 'online')  return 'status-online';
    if (s === 'offline') return 'status-offline';
    return 'status-degraded';
  };

  const statusLabel = (s) => {
    if (s === 'online')  return '● ONLINE';
    if (s === 'offline') return '● OFFLINE';
    return '● DEGRADED';
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="title">Service Status</span>
        {data && (
          <span className={data.overall === 'healthy' ? 'status-online' : 'status-degraded'}>
            {data.overall?.toUpperCase()}
          </span>
        )}
      </div>
      <div className="panel-body">
        {loading && <div className="loading">Loading...</div>}
        {error   && <div className="error">Error: {error}</div>}
        {data && (
          <table>
            <thead>
              <tr>
                <th>Service</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Last Checked</th>
              </tr>
            </thead>
            <tbody>
              {data.services.map((svc) => (
                <tr key={svc.name}>
                  <td>{svc.name}</td>
                  <td className={statusClass(svc.status)}>{statusLabel(svc.status)}</td>
                  <td>{svc.latencyMs != null ? `${svc.latencyMs}ms` : '—'}</td>
                  <td style={{ color: '#666' }}>
                    {svc.lastChecked ? new Date(svc.lastChecked).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && (
          <div style={{ marginTop: 6, fontSize: 10, color: '#555' }}>
            Checked at {new Date(data.checkedAt).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}
