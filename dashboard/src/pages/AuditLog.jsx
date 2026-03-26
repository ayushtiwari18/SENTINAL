/**
 * AuditLog Page — Shows every ArmorIQ policy decision (ALLOWED + BLOCKED).
 * Judges use this to verify enforcement accountability.
 */
import { useEffect, useState } from 'react';
import { getAuditLog } from '../services/api';

const STATUS_STYLES = {
  ALLOWED:  'bg-green-800 text-green-200',
  BLOCKED:  'bg-red-800  text-red-200',
  APPROVED: 'bg-blue-800 text-blue-200',
  REJECTED: 'bg-gray-700 text-gray-300',
};

export default function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    getAuditLog(100)
      .then(setEntries)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">ArmorIQ Audit Log</h1>
        <p className="text-gray-400 text-sm mt-1">
          Every policy decision made by ArmorIQ — ALLOWED and BLOCKED actions with full traceability.
        </p>
      </div>

      {loading && <p className="text-gray-400">Loading audit log...</p>}
      {error   && <p className="text-red-400">Error: {error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="text-gray-500 text-sm">
          No audit entries yet. ArmorIQ will populate this once attacks are detected.
        </p>
      )}

      {!loading && entries.length > 0 && (
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
              {entries.map(entry => (
                <tr key={entry._id} className="bg-gray-900 hover:bg-gray-800 transition">
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-white">{entry.action}</td>
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
                  <td className="px-4 py-3 font-mono text-gray-300">{entry.ip || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 capitalize">{entry.triggeredBy}</td>
                  <td className="px-4 py-3 text-gray-400 max-w-xs truncate" title={entry.reason}>
                    {entry.reason}
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
