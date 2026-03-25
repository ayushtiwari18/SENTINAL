import React from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getStats, getRecentAttacks } from '../services/api';
import { formatDate } from '../utils/format';

export default function Landing() {
  const stats   = useApi(getStats);
  const attacks = useApi(() => getRecentAttacks(5));

  return (
    <div style={{ padding: 40 }}>
      <h1>SENTINAL</h1>
      <p>Real-time web security monitoring.</p>
      <Link to="/dashboard">Open Dashboard</Link>

      <hr />
      <h3>Live Stats</h3>
      {stats.loading && <p>Loading...</p>}
      {stats.error   && <p>Error: {stats.error}</p>}
      {stats.data    && (
        <ul>
          <li>Total Attacks: {stats.data.totalAttacks}</li>
          <li>Total Logs: {stats.data.totalLogs}</li>
        </ul>
      )}

      <h3>Recent Attacks</h3>
      {attacks.loading && <p>Loading...</p>}
      {attacks.error   && <p>Error: {attacks.error}</p>}
      {attacks.data    && (
        <table border="1" cellPadding="6">
          <thead><tr><th>Time</th><th>IP</th><th>Type</th><th>Severity</th></tr></thead>
          <tbody>
            {attacks.data.map(a => (
              <tr key={a._id}>
                <td>{formatDate(a.createdAt)}</td>
                <td>{a.ip}</td>
                <td>{a.attackType}</td>
                <td>{a.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
