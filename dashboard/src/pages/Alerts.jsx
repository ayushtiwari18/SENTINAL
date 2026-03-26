/**
 * Alerts page — fully styled with Tailwind.
 * Features: severity chips, type badges, type filter, mark-all-read, armoriq_action highlight.
 */
import React, { useState, useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getAlerts, markAlertRead } from '../services/api';
import { formatDate } from '../utils/format';
import { Link } from 'react-router-dom';

const POLL = 30000;

const SEV_STYLE = {
  critical: 'bg-red-700 text-red-100',
  high:     'bg-orange-700 text-orange-100',
  medium:   'bg-yellow-700 text-yellow-100',
  low:      'bg-blue-700 text-blue-100',
};

const TYPE_STYLE = {
  armoriq_action:  'bg-purple-800 text-purple-200',
  attack_detected: 'bg-gray-700 text-gray-300',
  service_down:    'bg-red-900 text-red-300',
  rate_limit:      'bg-yellow-900 text-yellow-300',
  anomaly:         'bg-indigo-900 text-indigo-300',
};

export default function Alerts() {
  const { data: raw, loading, error, refetch } = useApi(() => getAlerts(200));
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState({ severity: '', read: '', type: '' });

  React.useEffect(() => { if (raw) setAlerts(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('alert:new', useCallback((payload) => {
    const a = payload.data ?? payload;
    setAlerts(prev => [{ ...a, _id: a.id ?? a._id, isRead: false }, ...prev]);
  }, []));

  const markRead = async (id) => {
    try {
      await markAlertRead(id);
      setAlerts(prev => prev.map(a => a._id === id ? { ...a, isRead: true } : a));
    } catch (e) { console.error(e); }
  };

  const markAllRead = async () => {
    const unread = alerts.filter(a => !a.isRead);
    await Promise.allSettled(unread.map(a => markAlertRead(a._id)));
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })));
  };

  const filtered = alerts.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.type     && a.type     !== filter.type)     return false;
    if (filter.read === 'unread' && a.isRead)              return false;
    if (filter.read === 'read'   && !a.isRead)             return false;
    return true;
  });

  const unread = alerts.filter(a => !a.isRead).length;

  const attackHref = (a) => {
    const id = a.attackId?._id ?? a.attackId;
    return id ? `/attacks/${id}` : null;
  };

  if (loading) return <p className="p-6 text-gray-400">Loading alerts...</p>;
  if (error)   return (
    <div className="p-6">
      <p className="text-red-400">Error: {error}</p>
      <button onClick={refetch} className="mt-2 text-sm text-blue-400 underline">Retry</button>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Alerts
            {unread > 0 && (
              <span className="ml-3 px-2 py-0.5 rounded-full text-sm font-semibold bg-red-700 text-white">
                {unread} unread
              </span>
            )}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Attack detections and ArmorIQ enforcement alerts.
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAllRead}
            className="px-3 py-1.5 text-sm rounded bg-gray-700 hover:bg-gray-600 text-white transition"
          >
            ✓ Mark All Read
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={filter.severity}
          onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
        >
          <option value="">All Severity</option>
          {['critical','high','medium','low'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filter.type}
          onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
        >
          <option value="">All Types</option>
          <option value="attack_detected">attack_detected</option>
          <option value="armoriq_action">armoriq_action</option>
          <option value="service_down">service_down</option>
          <option value="rate_limit">rate_limit</option>
          <option value="anomaly">anomaly</option>
        </select>

        <select
          value={filter.read}
          onChange={e => setFilter(f => ({ ...f, read: e.target.value }))}
          className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center text-gray-400 text-sm">
          No alerts match the current filter.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Attack</th>
                <th className="px-4 py-3">Read</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map(a => (
                <tr
                  key={a._id}
                  className={`transition ${
                    a.isRead
                      ? 'bg-gray-900 opacity-50'
                      : a.type === 'armoriq_action'
                        ? 'bg-purple-950 hover:bg-purple-900'
                        : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      SEV_STYLE[a.severity] || 'bg-gray-700 text-gray-300'
                    }`}>
                      {a.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{a.title}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                      TYPE_STYLE[a.type] || 'bg-gray-700 text-gray-300'
                    }`}>
                      {a.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {attackHref(a)
                      ? <Link to={attackHref(a)} className="text-blue-400 hover:underline text-xs">View →</Link>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.isRead
                      ? <span className="text-gray-500">read</span>
                      : <span className="text-green-400 font-semibold">new</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {!a.isRead && (
                      <button
                        onClick={() => markRead(a._id)}
                        className="px-2 py-0.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-white transition"
                      >
                        Mark Read
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
