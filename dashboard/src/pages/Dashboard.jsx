import React, { useState, useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getStats, getRecentAttacks, getAlerts, getServiceStatus } from '../services/api';
import { formatDate, formatConf } from '../utils/format';
import { Link } from 'react-router-dom';

const POLL = 30000;

export default function Dashboard() {
  const stats    = useApi(getStats);
  const services = useApi(getServiceStatus);
  const alertsApi = useApi(() => getAlerts(5));

  const [attacks, setAttacks] = useState([]);
  const [loadingAtk, setLoadingAtk] = useState(true);

  const fetchAttacks = useCallback(async () => {
    try { const d = await getRecentAttacks(20); setAttacks(d); }
    catch (e) { console.error(e); }
    finally { setLoadingAtk(false); }
  }, []);

  React.useEffect(() => { fetchAttacks(); }, [fetchAttacks]);
  useInterval(fetchAttacks, POLL);
  useInterval(stats.refetch, POLL);

  useSocket('attack:new', useCallback((payload) => {
    const a = payload.data;
    setAttacks(prev => [{ ...a, _id: a.id }, ...prev].slice(0, 50));
  }, []));

  useSocket('alert:new', useCallback(() => {
    alertsApi.refetch();
  }, [alertsApi.refetch]));

  return (
    <div>
      <h2>Dashboard</h2>

      <h4>Stats</h4>
      {stats.loading ? <p>Loading...</p> : stats.error ? <p>{stats.error}</p> : (
        <ul>
          <li>Total Attacks: {stats.data?.totalAttacks}</li>
          <li>Total Logs: {stats.data?.totalLogs}</li>
          <li>Critical Alerts: {stats.data?.criticalAlerts}</li>
        </ul>
      )}

      <h4>Service Health</h4>
      {services.loading ? <p>Loading...</p> : services.error ? <p>{services.error}</p> : (
        <ul>
          {services.data?.services?.map(s => (
            <li key={s.service}>{s.service}: {s.status} ({s.responseTimeMs}ms)</li>
          ))}
        </ul>
      )}

      <h4>Live Attack Feed</h4>
      {loadingAtk ? <p>Loading...</p> : (
        <table border="1" cellPadding="6">
          <thead><tr><th>Time</th><th>IP</th><th>Type</th><th>Severity</th><th>Status</th><th>Confidence</th><th></th></tr></thead>
          <tbody>
            {attacks.map(a => (
              <tr key={a._id}>
                <td>{formatDate(a.createdAt || a.timestamp)}</td>
                <td><code>{a.ip}</code></td>
                <td>{a.attackType}</td>
                <td>{a.severity}</td>
                <td>{a.status}</td>
                <td>{formatConf(a.confidence)}</td>
                <td><Link to={`/attacks/${a._id}`}>View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h4>Recent Alerts</h4>
      {alertsApi.loading ? <p>Loading...</p> : alertsApi.error ? <p>{alertsApi.error}</p> : (
        <ul>
          {alertsApi.data?.map(a => (
            <li key={a._id}>[{a.severity}] {a.title} — {formatDate(a.createdAt)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
