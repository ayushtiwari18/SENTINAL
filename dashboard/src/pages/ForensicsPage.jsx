import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getForensics } from '../services/api';
import { formatDate, formatConf, fmtJson, parseExplanation } from '../utils/format';

export default function ForensicsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => getForensics(id), [id]);

  if (loading) return <p>Loading forensic report...</p>;
  if (error)   return <div><p>Error: {error}</p><button onClick={refetch}>Retry</button></div>;
  if (!data)   return <p>No data.</p>;

  const { attack, raw_request, ip_intel, attack_chain } = data;
  const exp = parseExplanation(attack?.explanation);

  return (
    <div>
      <button onClick={() => navigate(-1)}>&larr; Back</button>
      <h2>Forensic Report</h2>
      <p><code>{id}</code> | {attack?.attackType} | {attack?.severity}</p>

      <h4>Attack Summary</h4>
      <table border="1" cellPadding="6">
        <tbody>
          <tr><td>Type</td><td>{attack?.attackType}</td></tr>
          <tr><td>Severity</td><td>{attack?.severity}</td></tr>
          <tr><td>Status</td><td>{attack?.status}</td></tr>
          <tr><td>Detected By</td><td>{attack?.detectedBy}</td></tr>
          <tr><td>Confidence</td><td>{formatConf(attack?.confidence)}</td></tr>
          <tr><td>Timestamp</td><td>{formatDate(attack?.timestamp)}</td></tr>
          <tr><td>Payload</td><td><code>{attack?.payload}</code></td></tr>
        </tbody>
      </table>

      <h4>AI Analysis</h4>
      {exp.summary          && <p><b>Summary:</b> {exp.summary}</p>}
      {exp.what_happened    && <p><b>What Happened:</b> {exp.what_happened}</p>}
      {exp.potential_impact && <p><b>Impact:</b> {exp.potential_impact}</p>}
      {exp.recommended_action && <p><b>Fix:</b> {exp.recommended_action}</p>}
      {exp.rule_triggered   && <p><b>Rule:</b> <code>{exp.rule_triggered}</code></p>}

      <h4>Raw Request</h4>
      {!raw_request ? <p>No raw request data.</p> : (
        <table border="1" cellPadding="6">
          <tbody>
            <tr><td>Method</td><td>{raw_request.method}</td></tr>
            <tr><td>URL</td><td><code>{raw_request.url}</code></td></tr>
            <tr><td>IP</td><td><code>{raw_request.ip}</code></td></tr>
            <tr><td>Response Code</td><td>{raw_request.responseCode ?? '—'}</td></tr>
            <tr><td>Headers</td><td><pre>{fmtJson(raw_request.headers)}</pre></td></tr>
            <tr><td>Query Params</td><td><pre>{fmtJson(raw_request.queryParams)}</pre></td></tr>
            <tr><td>Body</td><td><pre>{fmtJson(raw_request.body)}</pre></td></tr>
          </tbody>
        </table>
      )}

      <h4>IP Intelligence</h4>
      {ip_intel && (
        <table border="1" cellPadding="6">
          <tbody>
            <tr><td>IP</td><td><code>{ip_intel.ip}</code></td></tr>
            <tr><td>Requests (24h)</td><td>{ip_intel.total_requests_24h}</td></tr>
            <tr><td>Total Attacks</td><td>{ip_intel.total_attacks_ever}</td></tr>
            <tr><td>First Attack</td><td>{formatDate(ip_intel.first_attack)}</td></tr>
            <tr><td>Last Attack</td><td>{formatDate(ip_intel.last_attack)}</td></tr>
            <tr><td>Types Seen</td><td>{ip_intel.attack_types_seen?.join(', ') || '—'}</td></tr>
          </tbody>
        </table>
      )}

      <h4>Attack Chain</h4>
      <p><b>Pattern:</b> {attack_chain?.pattern_label}</p>
      {(!attack_chain?.timeline?.length) ? <p>Single isolated request.</p> : (
        <table border="1" cellPadding="6">
          <thead><tr><th>Time</th><th>Method</th><th>URL</th><th>Code</th></tr></thead>
          <tbody>
            {attack_chain.timeline.map((t, i) => (
              <tr key={i}>
                <td>{formatDate(t.time)}</td>
                <td>{t.method}</td>
                <td><code>{t.url}</code></td>
                <td>{t.code ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
