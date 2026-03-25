/**
 * LiveAttackFeed
 * Source:  GET /api/attacks/recent
 * Socket:  attack:new  — payload { event, timestamp, data: { id, ip, attackType, severity, status, detectedBy, confidence, timestamp } }
 *
 * Clicking a row opens ForensicsDrawer.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getRecentAttacks } from '../services/api';
import socket from '../services/socket';
import ForensicsDrawer from './ForensicsDrawer';

const REFRESH_MS = 30000;
const MAX_LIVE   = 100; // cap live feed to prevent memory growth

const sevClass = (s) => `sev-${s}`;

const fmtTime = (ts) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
};

const fmtConf = (c) => {
  if (c == null) return '—';
  return `${Math.round(c * 100)}%`;
};

export default function LiveAttackFeed() {
  const [attacks, setAttacks]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [selected, setSelected]   = useState(null); // attack id for forensics
  const liveCountRef              = useRef(0);

  const load = useCallback(async () => {
    console.log('[LiveAttackFeed] Fetching recent attacks');
    try {
      const data = await getRecentAttacks(20);
      setAttacks(data);
      setError(null);
    } catch (err) {
      console.error('[LiveAttackFeed] Failed to fetch attacks:', err.message);
      setError('Failed to fetch attacks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  // Real-time socket listener
  useEffect(() => {
    const handler = (payload) => {
      console.log('[LiveAttackFeed] attack:new received', payload);
      const attack = payload.data;
      liveCountRef.current += 1;
      setAttacks((prev) => {
        const next = [attack, ...prev];
        return next.slice(0, MAX_LIVE);
      });
    };
    socket.on('attack:new', handler);
    return () => socket.off('attack:new', handler);
  }, []);

  return (
    <>
      <div className="panel">
        <div className="panel-header">
          <span className="title">Live Attack Feed</span>
          <span style={{ color: '#555' }}>{attacks.length} events</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading && <div className="loading" style={{ padding: 12 }}>Loading...</div>}
          {error   && <div className="error">Error: {error}</div>}
          {!loading && !error && attacks.length === 0 && (
            <div className="loading">No attacks recorded.</div>
          )}
          {attacks.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>IP</th>
                    <th>Attack Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th>Detected By</th>
                    <th>Confidence</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {attacks.map((a, i) => (
                    <tr key={a._id || a.id || i}>
                      <td style={{ color: '#666' }}>{fmtTime(a.createdAt || a.timestamp)}</td>
                      <td style={{ fontFamily: 'monospace' }}>{a.ip}</td>
                      <td>{a.attackType}</td>
                      <td className={sevClass(a.severity)}>{a.severity}</td>
                      <td style={{ color: a.status === 'blocked' ? '#4ec9b0' : a.status === 'successful' ? '#f44747' : '#dcdcaa' }}>
                        {a.status}
                      </td>
                      <td style={{ color: '#888' }}>{a.detectedBy}</td>
                      <td style={{ color: '#888' }}>{fmtConf(a.confidence)}</td>
                      <td>
                        <button onClick={() => setSelected(a._id || a.id)}>forensics</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ForensicsDrawer
          attackId={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
