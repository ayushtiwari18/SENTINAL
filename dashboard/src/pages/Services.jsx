import React, { useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getServiceStatus, getHealth } from '../services/api';
import { formatDate } from '../utils/format';

const POLL = 30000;

const SERVICE_LABELS = {
  'gateway': 'API Gateway', 'detection-engine': 'Detection Engine',
  'pcap-processor': 'PCAP Processor', 'armoriq-agent': 'ArmorIQ Agent',
};

export default function Services() {
  const status = useApi(getServiceStatus);
  const health = useApi(getHealth);

  useInterval(status.refetch, POLL);
  useInterval(health.refetch, POLL);

  useSocket('service:status', useCallback((payload) => {
    // refetch on any service status event
    status.refetch();
  }, [status.refetch]));

  if (status.loading) return <p>Checking service health...</p>;
  if (status.error)   return <p>Error: {status.error} <button onClick={status.refetch}>Retry</button></p>;

  const d = status.data;

  return (
    <div>
      <h2>Service Health</h2>
      <p>Overall: <b>{d?.overall}</b> | Checked: {formatDate(d?.checkedAt)}</p>

      <table border="1" cellPadding="6">
        <thead><tr><th>Service</th><th>Status</th><th>Response Time</th><th>Error</th></tr></thead>
        <tbody>
          {d?.services?.map(s => (
            <tr key={s.service}>
              <td>{SERVICE_LABELS[s.service] || s.service}</td>
              <td>{s.status}</td>
              <td>{s.responseTimeMs}ms</td>
              <td>{s.error || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Gateway Health</h4>
      {health.data && (
        <ul>
          <li>DB: {health.data.dbStatus}</li>
          <li>Uptime: {Math.floor(health.data.uptime)}s</li>
          <li>Status: {health.data.status}</li>
        </ul>
      )}
    </div>
  );
}
