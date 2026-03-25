/**
 * StatsPanel
 * Source: GET /api/stats
 * Response: {
 *   totalLogs, totalAttacks, totalAlerts, unreadAlerts,
 *   attacksByType: { sqli: n, xss: n, ... },
 *   attacksBySeverity: { low: n, medium: n, high: n, critical: n },
 *   recentAttacks: [...]
 * }
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getStats } from '../services/api';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const REFRESH_MS = 30000;
const SEV_COLORS = { low: '#9cdcfe', medium: '#dcdcaa', high: '#ce9178', critical: '#f44747' };

export default function StatsPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    console.log('[StatsPanel] Fetching stats');
    try {
      const d = await getStats();
      setData(d);
      setError(null);
    } catch (err) {
      console.error('[StatsPanel] Failed to fetch stats:', err.message);
      setError('Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const t = setInterval(fetch, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetch]);

  const sevChartData = data
    ? Object.entries(data.attacksBySeverity || {}).map(([k, v]) => ({ name: k, value: v }))
    : [];

  const typeChartData = data
    ? Object.entries(data.attacksByType || {}).map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="title">Statistics</span>
      </div>
      <div className="panel-body">
        {loading && <div className="loading">Loading...</div>}
        {error   && <div className="error">Error: {error}</div>}
        {data && (
          <>
            {/* Stat Cards */}
            <div className="stat-grid" style={{ marginBottom: 16 }}>
              <div className="stat-card">
                <div className="label">Total Logs</div>
                <div className="value">{data.totalLogs ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="label">Total Attacks</div>
                <div className="value">{data.totalAttacks ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="label">Total Alerts</div>
                <div className="value">{data.totalAlerts ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="label">Unread Alerts</div>
                <div className="value" style={{ color: data.unreadAlerts > 0 ? '#f44747' : '#d4d4d4' }}>
                  {data.unreadAlerts ?? 0}
                </div>
              </div>
              <div className="stat-card">
                <div className="label">High Severity</div>
                <div className="value sev-high">{data.attacksBySeverity?.high ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="label">Critical Severity</div>
                <div className="value sev-critical">{data.attacksBySeverity?.critical ?? 0}</div>
              </div>
            </div>

            {/* Charts row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Severity Donut */}
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>By Severity</div>
                {sevChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={sevChartData} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2}>
                        {sevChartData.map((entry) => (
                          <Cell key={entry.name} fill={SEV_COLORS[entry.name] || '#555'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }}
                        itemStyle={{ color: '#d4d4d4' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#555', fontSize: 11 }}>No data</div>}
              </div>

              {/* Attack Type Donut */}
              <div>
                <div style={{ fontSize: 10, color: '#666', marginBottom: 4, textTransform: 'uppercase' }}>By Attack Type</div>
                {typeChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={typeChartData} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={2}>
                        {typeChartData.map((_, i) => (
                          <Cell key={i} fill={['#4ec9b0','#9cdcfe','#ce9178','#dcdcaa','#f44747','#c586c0','#569cd6','#6a9955','#d7ba7d','#4fc1ff','#888'][i % 11]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: '#1a1a1a', border: '1px solid #333', fontSize: 11 }}
                        itemStyle={{ color: '#d4d4d4' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <div style={{ color: '#555', fontSize: 11 }}>No data</div>}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
