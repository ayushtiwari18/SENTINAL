/**
 * SENTINAL — Geo-IP Threat Intelligence Map
 * ==========================================
 * Renders a world heatmap of attack origins using Leaflet + react-leaflet.
 * Data fetched from GET /api/geo/heatmap (Node.js → MongoDB aggregation).
 * Stats panel from GET /api/geo/stats.
 *
 * Dependencies (already in package.json after install):
 *   npm install leaflet react-leaflet
 */

import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Severity colour scale ────────────────────────────────────────────────────
function countToColor(count) {
  if (count >= 100) return '#ef4444';   // red-500
  if (count >= 50)  return '#f97316';   // orange-500
  if (count >= 20)  return '#eab308';   // yellow-500
  if (count >= 5)   return '#22c55e';   // green-500
  return '#3b82f6';                      // blue-500
}

function countToRadius(count) {
  if (count >= 100) return 30;
  if (count >= 50)  return 22;
  if (count >= 20)  return 16;
  if (count >= 5)   return 10;
  return 6;
}

export default function GeoThreatMap() {
  const [heatmap,   setHeatmap]   = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [selected,  setSelected]  = useState(null);  // selected country dot
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // ── Dynamic Leaflet import (avoids SSR issues) ─────────────────────────────
  useEffect(() => {
    Promise.all([
      import('leaflet'),
      import('react-leaflet'),
    ]).then(([L]) => {
      // Fix default marker icons
      delete L.default.Icon.Default.prototype._getIconUrl;
      L.default.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      setLeafletLoaded(true);
    });
  }, []);

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

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!leafletLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-96 text-gray-400">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500 mx-auto mb-4" />
          <p>Loading Geo-IP Intelligence...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400 bg-red-900/20 rounded-lg">
        <p className="font-semibold">Failed to load geo data</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={fetchData} className="mt-3 px-4 py-2 bg-red-600 rounded text-white text-sm hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  // ── Lazy-loaded Leaflet components ─────────────────────────────────────────
  // We use a dynamic render trick — import() resolved, so we can require inline
  const { MapContainer, TileLayer, CircleMarker, Popup, Tooltip } = require('react-leaflet');

  const topFlags = stats?.threat_flags || {};

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">🌍 Geo-IP Threat Map</h1>
          <p className="text-gray-400 text-sm mt-1">
            Real-time geographic distribution of attack origins
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* ── Stats Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Tracked',   value: topFlags.total           || 0,    color: 'text-teal-400'   },
          { label: 'TOR Exits',       value: topFlags.tor_attacks     || 0,    color: 'text-purple-400' },
          { label: 'Proxies',         value: topFlags.proxy_attacks   || 0,    color: 'text-yellow-400' },
          { label: 'High Abuse IPs',  value: topFlags.high_abuse      || 0,    color: 'text-red-400'    },
          { label: 'Countries',       value: topFlags.unique_countries || 0,   color: 'text-blue-400'   },
        ].map((card) => (
          <div key={card.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* ── Map ────────────────────────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden" style={{ height: '480px' }}>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          crossOrigin=""
        />
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%', background: '#1a1a2e' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {heatmap.map((point) => (
            point.lat && point.lng ? (
              <CircleMarker
                key={point.country_code}
                center={[point.lat, point.lng]}
                radius={countToRadius(point.count)}
                fillColor={countToColor(point.count)}
                color={countToColor(point.count)}
                weight={1}
                opacity={0.9}
                fillOpacity={0.7}
                eventHandlers={{ click: () => setSelected(point) }}
              >
                <Tooltip direction="top" offset={[0, -8]}>
                  <div className="text-xs">
                    <strong>{point.country}</strong> ({point.country_code})<br />
                    Attacks: {point.count} | Critical: {point.critical}<br />
                    TOR: {point.tor_count} | Proxy: {point.proxy_count}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="text-sm space-y-1 min-w-[180px]">
                    <p className="font-bold text-base">{point.country}</p>
                    <p>Code: <span className="font-mono">{point.country_code}</span></p>
                    <hr />
                    <p>Total Attacks: <strong>{point.count}</strong></p>
                    <p>Critical: <span className="text-red-600">{point.critical}</span></p>
                    <p>High: <span className="text-orange-500">{point.high}</span></p>
                    <p>TOR Exits: {point.tor_count}</p>
                    <p>Proxies: {point.proxy_count}</p>
                    <p>Avg Abuse Score: {point.avg_abuse}%</p>
                  </div>
                </Popup>
              </CircleMarker>
            ) : null
          ))}
        </MapContainer>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 text-sm text-gray-400">
        <span className="font-medium text-gray-300">Attack Volume:</span>
        {[
          { color: '#3b82f6', label: '1–4'   },
          { color: '#22c55e', label: '5–19'  },
          { color: '#eab308', label: '20–49' },
          { color: '#f97316', label: '50–99' },
          { color: '#ef4444', label: '100+'  },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* ── Top Countries Table ─────────────────────────────────────────────── */}
      {stats?.top_countries?.length > 0 && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-white font-semibold">🏴 Top Attacking Countries</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Attacks</th>
                  <th className="px-4 py-3">Share</th>
                </tr>
              </thead>
              <tbody>
                {stats.top_countries.map((c, i) => {
                  const share = topFlags.total ? Math.round((c.count / topFlags.total) * 100) : 0;
                  return (
                    <tr key={c.country_code} className="border-t border-gray-700 hover:bg-gray-750 transition-colors">
                      <td className="px-4 py-3 text-gray-400">#{i + 1}</td>
                      <td className="px-4 py-3 text-white font-medium">{c.country}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono bg-gray-700 px-2 py-0.5 rounded text-xs">{c.country_code}</span>
                      </td>
                      <td className="px-4 py-3 text-white">{c.count.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-teal-500"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs w-8">{share}%</span>
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
