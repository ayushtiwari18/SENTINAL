/**
 * ActionQueue — Displays ArmorIQ blocked actions awaiting human approval.
 * Receives live updates via socket 'action:pending' event.
 * Lets analysts APPROVE or REJECT each pending action.
 */
import { useEffect, useState } from 'react';
import { getPendingActions, approveAction, rejectAction } from '../services/api';
import socket from '../services/socket';

const RISK_COLOURS = {
  permanent_ban_ip:      'bg-orange-900 border-orange-600',
  shutdown_endpoint:     'bg-red-900 border-red-600',
  purge_all_sessions:    'bg-yellow-900 border-yellow-600',
  modify_firewall_rules: 'bg-red-900 border-red-600',
};

export default function ActionQueue() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await getPendingActions();
      setItems(data || []);
    } catch (e) {
      console.error('[ActionQueue] fetch failed:', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();

    // Live update: new action blocked by ArmorIQ
    const handler = (payload) => {
      setItems(prev => [payload.data, ...prev]);
    };
    socket.on('action:pending', handler);
    return () => socket.off('action:pending', handler);
  }, []);

  const handleApprove = async (id) => {
    try {
      await approveAction(id);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (e) {
      alert('Approve failed: ' + e.message);
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectAction(id);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (e) {
      alert('Reject failed: ' + e.message);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading action queue...</p>;

  if (!items.length) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-4 text-center text-gray-400 text-sm">
        ✅ No pending actions — ArmorIQ has not blocked anything requiring review.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item._id}
          className={`rounded-lg border p-4 ${
            RISK_COLOURS[item.action] || 'bg-gray-800 border-gray-600'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider bg-red-700 text-white px-2 py-0.5 rounded">
                  BLOCKED BY ARMORIQ
                </span>
                <span className="font-mono font-semibold text-white">{item.action}</span>
              </div>
              <p className="text-sm text-gray-300 mb-1">
                <span className="text-gray-500">Target IP:</span> {item.ip}
              </p>
              <p className="text-sm text-gray-300 mb-1">
                <span className="text-gray-500">Agent reason:</span> {item.agentReason}
              </p>
              <p className="text-sm text-red-300">
                <span className="text-gray-500">Blocked because:</span> {item.blockedReason}
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => handleApprove(item._id)}
                className="px-3 py-1 text-sm font-semibold rounded bg-green-600 hover:bg-green-500 text-white transition"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => handleReject(item._id)}
                className="px-3 py-1 text-sm font-semibold rounded bg-gray-600 hover:bg-gray-500 text-white transition"
              >
                ❌ Reject
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Queued: {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
