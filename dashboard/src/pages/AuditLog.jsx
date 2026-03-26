/**
 * AuditLog Page — ArmorIQ policy decisions with filters + live stat bar.
 */
import { useEffect, useState, useCallback } from 'react';
import { getAuditLog } from '../services/api';
import { useInterval } from '../hooks/useInterval';

const STATUS_STYLES = {
  ALLOWED:  'bg-green-800 text-green-200',
  BLOCKED:  'bg-red-800  text-red-200',
  APPROVED: 'bg-blue-800 text-blue-200',
  REJECTED: 'bg-gray-700 text-gray-300',
};

const ALL_ACTIONS = [
  'send_alert', 'log_attack', 'rate_limit_ip', 'flag_for_review',
  'permanent_ban_ip', 'shutdown_endpoint', 'purge_all_sessions', 'modify_firewall_rules',
];

const REFRESH_MS = 10000;

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const load = useCallback(() => {
    getAuditLog(200)
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);
  useInterval(load, REFRESH_MS);

  const filtered = entries.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    if (filterAction && e.action !== filterAction) return false;
    return true;
  });

  // Stat counts (always from full unfiltered entries)
  const counts = ['ALLOWED','BLOCKED','APPROVED','REJECTED'].reduce((acc, s) => {
    acc[s] = entries.filter(e => e.status === s).length;
    return acc;
  }, {});

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-white">ArmorIQ Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">
          Every policy decision made by ArmorIQ — ALLOWED and BLOCKED actions with full traceability.
        </p>
      </div>

      {/* Stat bar */}
      {!loading && entries.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-4">
          {[['ALLOWED','bg-green-900 border-green-700 text-green-300'],
            ['BLOCKED','bg-red-900 border-red-700 text-red-300'],
            ['APPROVED','bg-blue-900 border-blue-700 text-blue-300'],
            ['REJECTED','bg-gray-800 border-gray-600 text-gray-300']].map(([s, cls]) => (
            <button
              key={s}
              onClick={() => setFilterStatus(prev => prev === s ? '' : s)}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                cls} ${
                filterStatus === s ? 'ring-2 ring-white/30' : 'opacity-80 hover:opacity-100'
              }`}
            >
              {s}: {counts[s]}
            </button>
          ))}
          {(filterStatus || filterAction) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterAction(''); }}
              className="rounded-lg border border-gray-600 px-3 py-2 text-xs text-gray-400 hover:text-white transition"
            >
              ✕ Clear filters
            </button>
          )}
        </div>
      )}

      {/* Action filter */}
      {!loading && entries.length > 0 && (
        <div className="mb-4">
          <select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded px-2 py-1"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <span className="ml-3 text-xs text-gray-500">
            Showing {filtered.length} / {entries.length} entries · auto-refreshes every 10s
          </span>
        </div>
      )}

      {loading && <p className="text-gray-400">Loading audit log...</p>}
      {error   && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="text-gray-500 text-sm">
          No audit entries yet. Run <code className="text-green-400">bash scripts/simulate_attack.sh</code> to populate.
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-800 text-gray-400 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Policy Rule</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3">Triggered By</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map(entry => (
                <tr key={entry._id} className="bg-gray-900 hover:bg-gray-800 transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-white text-xs">{entry.action}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      STATUS_STYLES[entry.status] || 'bg-gray-700 text-gray-300'
                    }`}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {entry.policy_rule_id || '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-300">{entry.ip || '—'}</td>
                  <td className="px-4 py-3 text-xs capitalize">
                    <span className={entry.triggeredBy === 'human' ? 'text-blue-400 font-semibold' : 'text-gray-400'}>
                      {entry.triggeredBy}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate" title={entry.reason}>
                    {entry.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && filtered.length === 0 && entries.length > 0 && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center text-gray-400 text-sm">
          No entries match the current filter.
        </div>
      )}
    </div>
  );
}
