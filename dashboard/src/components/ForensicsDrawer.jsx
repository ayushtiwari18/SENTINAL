/**
 * ForensicsDrawer
 * Source: GET /api/attacks/:id/forensics
 * Response.data: {
 *   attack: { id, attackType, severity, confidence, status, detectedBy, payload, explanation, timestamp },
 *   raw_request: { method, url, ip, headers, body, queryParams, responseCode } | null,
 *   ip_intel: { ip, total_requests_24h, total_attacks_ever, first_attack, last_attack, attack_types_seen },
 *   attack_chain: { timeline: [...], pattern_label, all_attacks: [...] }
 * }
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getForensics } from '../services/api';

export default function ForensicsDrawer({ attackId, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const load = useCallback(async () => {
    console.log(`[ForensicsDrawer] Fetching forensics for ${attackId}`);
    try {
      const d = await getForensics(attackId);
      setData(d);
      setError(null);
    } catch (err) {
      console.error('[ForensicsDrawer] Failed to fetch forensics:', err.message);
      setError('Failed to load forensics report');
    } finally {
      setLoading(false);
    }
  }, [attackId]);

  useEffect(() => { load(); }, [load]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const fmtJson = (obj) => {
    if (!obj) return 'null';
    try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
  };

  const sevClass = (s) => `sev-${s}`;

  return (
    <div className="drawer-overlay">
      <button className="drawer-close" onClick={onClose} title="Close (Esc)">×</button>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: '#555', textTransform: 'uppercase', marginBottom: 4 }}>Forensics Report</div>
        <div style={{ fontSize: 11, color: '#444' }}>ID: {attackId}</div>
      </div>

      {loading && <div className="loading">Loading...</div>}
      {error   && <div className="error">Error: {error}</div>}

      {data && (
        <>
          {/* Attack Summary */}
          <h3>Attack Summary</h3>
          <table style={{ marginBottom: 16 }}>
            <tbody>
              <tr><td style={{ color: '#666', width: 130 }}>Type</td>        <td>{data.attack.attackType}</td></tr>
              <tr><td style={{ color: '#666' }}>Severity</td>    <td className={sevClass(data.attack.severity)}>{data.attack.severity}</td></tr>
              <tr><td style={{ color: '#666' }}>Status</td>      <td>{data.attack.status}</td></tr>
              <tr><td style={{ color: '#666' }}>Confidence</td>  <td>{data.attack.confidence != null ? `${Math.round(data.attack.confidence * 100)}%` : '—'}</td></tr>
              <tr><td style={{ color: '#666' }}>Detected By</td> <td>{data.attack.detectedBy}</td></tr>
              <tr><td style={{ color: '#666' }}>Time</td>        <td style={{ color: '#666' }}>{data.attack.timestamp ? new Date(data.attack.timestamp).toLocaleString() : '—'}</td></tr>
            </tbody>
          </table>

          {/* Payload */}
          <h3>Payload</h3>
          <pre style={{ marginBottom: 16 }}>{data.attack.payload || '(empty)'}</pre>

          {/* Explanation */}
          <h3>Explanation</h3>
          <pre style={{ marginBottom: 16 }}>
            {(() => {
              try {
                const parsed = JSON.parse(data.attack.explanation);
                return fmtJson(parsed);
              } catch {
                return data.attack.explanation || '(none)';
              }
            })()}
          </pre>

          {/* Raw Request */}
          <h3>Raw Request</h3>
          {data.raw_request ? (
            <table style={{ marginBottom: 16 }}>
              <tbody>
                <tr><td style={{ color: '#666', width: 130 }}>Method</td>        <td>{data.raw_request.method}</td></tr>
                <tr><td style={{ color: '#666' }}>URL</td>          <td style={{ wordBreak: 'break-all' }}>{data.raw_request.url}</td></tr>
                <tr><td style={{ color: '#666' }}>IP</td>           <td>{data.raw_request.ip}</td></tr>
                <tr><td style={{ color: '#666' }}>Response Code</td><td>{data.raw_request.responseCode ?? '—'}</td></tr>
                <tr><td style={{ color: '#666' }}>Headers</td>      <td><pre style={{ margin: 0 }}>{fmtJson(data.raw_request.headers)}</pre></td></tr>
                <tr><td style={{ color: '#666' }}>Query Params</td> <td><pre style={{ margin: 0 }}>{fmtJson(data.raw_request.queryParams)}</pre></td></tr>
                <tr><td style={{ color: '#666' }}>Body</td>         <td><pre style={{ margin: 0 }}>{fmtJson(data.raw_request.body)}</pre></td></tr>
              </tbody>
            </table>
          ) : <div style={{ color: '#555', marginBottom: 16 }}>No raw request data.</div>}

          {/* IP Intelligence */}
          <h3>IP Intelligence</h3>
          <table style={{ marginBottom: 16 }}>
            <tbody>
              <tr><td style={{ color: '#666', width: 180 }}>IP</td>                    <td>{data.ip_intel.ip}</td></tr>
              <tr><td style={{ color: '#666' }}>Requests (24h)</td>      <td>{data.ip_intel.total_requests_24h}</td></tr>
              <tr><td style={{ color: '#666' }}>Total Attacks (ever)</td> <td>{data.ip_intel.total_attacks_ever}</td></tr>
              <tr><td style={{ color: '#666' }}>First Attack</td>         <td style={{ color: '#666' }}>{data.ip_intel.first_attack ? new Date(data.ip_intel.first_attack).toLocaleString() : '—'}</td></tr>
              <tr><td style={{ color: '#666' }}>Last Attack</td>          <td style={{ color: '#666' }}>{data.ip_intel.last_attack ? new Date(data.ip_intel.last_attack).toLocaleString() : '—'}</td></tr>
              <tr><td style={{ color: '#666' }}>Attack Types Seen</td>    <td>{(data.ip_intel.attack_types_seen || []).join(', ') || '—'}</td></tr>
            </tbody>
          </table>

          {/* Attack Chain */}
          <h3>Attack Chain</h3>
          <div style={{ marginBottom: 8 }}>
            <span style={{ color: '#888', fontSize: 11 }}>Pattern: </span>
            <span style={{ color: '#dcdcaa' }}>{data.attack_chain.pattern_label}</span>
          </div>
          {data.attack_chain.timeline.length > 0 ? (
            <div style={{ overflowX: 'auto', marginBottom: 16 }}>
              <table>
                <thead>
                  <tr><th>Time</th><th>Method</th><th>URL</th><th>Code</th></tr>
                </thead>
                <tbody>
                  {data.attack_chain.timeline.slice(0, 20).map((item, i) => (
                    <tr key={i}>
                      <td style={{ color: '#666' }}>{item.time ? new Date(item.time).toLocaleTimeString() : '—'}</td>
                      <td>{item.method}</td>
                      <td style={{ wordBreak: 'break-all', maxWidth: 220 }}>{item.url}</td>
                      <td>{item.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div style={{ color: '#555', marginBottom: 16 }}>No timeline data.</div>}
        </>
      )}
    </div>
  );
}
