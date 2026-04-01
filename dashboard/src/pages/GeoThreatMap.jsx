/**
 * SENTINAL — Geo-IP Threat Intelligence Map
 * ==========================================
 * react-leaflet v4 + leaflet v1.9  (React 18 compatible)
 * Data from GET /api/geo/heatmap and GET /api/geo/stats
 */

import React, { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';

// Fix Leaflet default icon URLs broken by Vite asset hashing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

function countToColor(count) {
  if (count >= 100) return '#ef4444';
  if (count >= 50)  return '#f97316';
  if (count >= 20)  return '#eab308';
  if (count >= 5)   return '#22c55e';
  return '#3b82f6';
}

function countToRadius(count) {
  if (count >= 100) return 30;
  if (count >= 50)  return 22;
  if (count >= 20)  return 16;
  if (count >= 5)   return 10;
  return 6;
}

export default function GeoThreatMap() {
  const [heatmap,  setHeatmap]  = useState([]);
  const [stats,    setStats]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [heatRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/api/geo/heatmap`),
        axios.get(`${API_BASE}/api/geo/stats`),
      ]);
      setHeatmap(heatRes.data.heatmap  || []);
      setStats(statsRes.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '24rem', color: '#9ca3af' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '3rem', height: '3rem', borderRadius: '50%',
            border: '3px solid #14b8a6', borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem'
          }} />
          <p>Loading Geo-IP Intelligence...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '1.5rem', color: '#f87171', background: 'rgba(239,68,68,0.1)', borderRadius: '0.5rem', margin: '1.5rem' }}>
        <p style={{ fontWeight: 600 }}>Failed to load geo data</p>
        <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>{error}</p>
        <button
          onClick={fetchData}
          style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', background: '#dc2626', borderRadius: '0.375rem', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Retry
        </button>
      </div>
    );
  }

  const flags = stats?.threat_flags || {};

  const statCards = [
    { label: 'Total Tracked',   value: flags.total            || 0, color: '#2dd4bf' },
    { label: 'TOR Exits',       value: flags.tor_attacks      || 0, color: '#a78bfa' },
    { label: 'Proxies',         value: flags.proxy_attacks    || 0, color: '#fbbf24' },
    { label: 'High Abuse IPs',  value: flags.high_abuse       || 0, color: '#f87171' },
    { label: 'Countries',       value: flags.unique_countries || 0, color: '#60a5fa' },
  ];

  const legend = [
    { color: '#3b82f6', label: '1–4'   },
    { color: '#22c55e', label: '5–19'  },
    { color: '#eab308', label: '20–49' },
    { color: '#f97316', label: '50–99' },
    { color: '#ef4444', label: '100+'  },
  ];

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>
            🌍 Geo-IP Threat Map
          </h1>
          <p style={{ color: '#9ca3af', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>
            Real-time geographic distribution of attack origins
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{ padding: '0.5rem 1rem', background: '#0d9488', border: 'none', borderRadius: '0.5rem', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {statCards.map(card => (
          <div key={card.label} style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #374151' }}>
            <p style={{ color: '#9ca3af', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{card.label}</p>
            <p style={{ color: card.color, fontSize: '1.75rem', fontWeight: 700, margin: '0.25rem 0 0' }}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ background: '#1f2937', borderRadius: '0.75rem', border: '1px solid #374151', overflow: 'hidden', height: '480px' }}>
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://carto.com">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {heatmap.map(point =>
            point.lat && point.lng ? (
              <CircleMarker
                key={point.country_code}
                center={[point.lat, point.lng]}
                radius={countToRadius(point.count)}
                pathOptions={{
                  fillColor:   countToColor(point.count),
                  color:       countToColor(point.count),
                  weight:      1,
                  opacity:     0.9,
                  fillOpacity: 0.7,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                    <strong>{point.country}</strong> ({point.country_code})<br />
                    Attacks: {point.count} &nbsp;|&nbsp; Critical: {point.critical}<br />
                    TOR: {point.tor_count} &nbsp;|&nbsp; Proxy: {point.proxy_count}
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ fontSize: '0.875rem', minWidth: '180px', lineHeight: 1.7 }}>
                    <p style={{ fontWeight: 700, fontSize: '1rem', margin: '0 0 4px' }}>{point.country}</p>
                    <p style={{ margin: 0 }}>Code: <code>{point.country_code}</code></p>
                    <hr style={{ margin: '6px 0' }} />
                    <p style={{ margin: 0 }}>Total Attacks: <strong>{point.count}</strong></p>
                    <p style={{ margin: 0, color: '#dc2626' }}>Critical: {point.critical}</p>
                    <p style={{ margin: 0, color: '#ea580c' }}>High: {point.high}</p>
                    <p style={{ margin: 0 }}>TOR Exits: {point.tor_count}</p>
                    <p style={{ margin: 0 }}>Proxies: {point.proxy_count}</p>
                    <p style={{ margin: 0 }}>Avg Abuse Score: {point.avg_abuse}%</p>
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.875rem', color: '#9ca3af', flexWrap: 'wrap' }}>
        <span style={{ color: '#d1d5db', fontWeight: 500 }}>Attack Volume:</span>
        {legend.map(l => (
          <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: l.color, display: 'inline-block' }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Top Countries Table */}
      {stats?.top_countries?.length > 0 && (
        <div style={{ background: '#1f2937', borderRadius: '0.75rem', border: '1px solid #374151', overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #374151' }}>
            <h2 style={{ color: '#fff', fontWeight: 600, margin: 0, fontSize: '1rem' }}>🏴 Top Attacking Countries</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ color: '#9ca3af', textAlign: 'left' }}>
                  {['Rank', 'Country', 'Code', 'Attacks', 'Share'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.top_countries.map((c, i) => {
                  const share = flags.total ? Math.round((c.count / flags.total) * 100) : 0;
                  return (
                    <tr key={c.country_code} style={{ borderTop: '1px solid #374151' }}>
                      <td style={{ padding: '0.75rem 1rem', color: '#9ca3af' }}>#{i + 1}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#fff', fontWeight: 500 }}>{c.country}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <code style={{ background: '#374151', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                          {c.country_code}
                        </code>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{c.count.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, background: '#374151', borderRadius: '9999px', height: '6px' }}>
                            <div style={{ width: `${share}%`, height: '6px', borderRadius: '9999px', background: '#14b8a6' }} />
                          </div>
                          <span style={{ color: '#9ca3af', fontSize: '0.75rem', width: '2.5rem' }}>{share}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
