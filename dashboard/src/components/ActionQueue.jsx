/**
 * ActionQueue — ArmorIQ blocked actions with confirm modal + attack link.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPendingActions, approveAction, rejectAction } from '../services/api';
import { useSocket } from '../hooks/useSocket';

const RISK_COLOURS = {
  permanent_ban_ip:      'bg-orange-900 border-orange-600',
  shutdown_endpoint:     'bg-red-900 border-red-600',
  purge_all_sessions:    'bg-yellow-900 border-yellow-600',
  modify_firewall_rules: 'bg-red-900 border-red-600',
};

const RISK_LABEL = {
  permanent_ban_ip:      { label: 'HIGH RISK',      cls: 'bg-orange-700' },
  shutdown_endpoint:     { label: 'CRITICAL RISK',  cls: 'bg-red-700' },
  purge_all_sessions:    { label: 'MEDIUM RISK',    cls: 'bg-yellow-700' },
  modify_firewall_rules: { label: 'CRITICAL RISK',  cls: 'bg-red-700' },
};

export default function ActionQueue() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState(new Set()); // IDs fading out
  const [confirm,  setConfirm]  = useState(null);      // { id, action, type: 'approve'|'reject' }

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

  useEffect(() => { load(); }, []);

  useSocket('action:pending', useCallback((payload) => {
    const item = payload.data ?? payload;
    setItems(prev => {
      if (prev.find(i => i._id === item._id)) return prev;
      return [item, ...prev];
    });
  }, []));

  const fadeOut = (id) => {
    setRemoving(prev => new Set([...prev, id]));
    setTimeout(() => {
      setItems(prev => prev.filter(i => i._id !== id));
      setRemoving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 350);
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const { id, type } = confirm;
    setConfirm(null);
    try {
      if (type === 'approve') await approveAction(id);
      else                    await rejectAction(id);
      fadeOut(id);
    } catch (e) {
      alert(`${type} failed: ` + e.message);
    }
  };

  if (loading) return <p className="text-gray-400 text-sm">Loading action queue...</p>;

  if (!items.length) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800 p-6 text-center text-gray-400 text-sm">
        ✅ No pending actions — ArmorIQ has not blocked anything requiring review.
      </div>
    );
  }

  return (
    <>
      {/* Confirm Modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-white font-bold text-lg mb-2">
              {confirm.type === 'approve' ? '✅ Confirm Approve' : '❌ Confirm Reject'}
            </h3>
            <p className="text-gray-300 text-sm mb-1">
              Action: <span className="font-mono text-white">{confirm.action}</span>
            </p>
            <p className="text-gray-400 text-sm mb-4">
              {confirm.type === 'approve'
                ? 'This will authorise ArmorIQ to execute this action. Are you sure?'
                : 'This will permanently reject this action. It will not be executed.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirm(null)}
                className="px-4 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-1.5 rounded text-white text-sm font-semibold transition ${
                  confirm.type === 'approve'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-red-700 hover:bg-red-600'
                }`}
              >
                {confirm.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const riskMeta = RISK_LABEL[item.action] || { label: 'BLOCKED', cls: 'bg-red-700' };
          const isFading = removing.has(item._id);
          return (
            <div
              key={item._id}
              style={{ transition: 'opacity 0.35s ease, transform 0.35s ease',
                       opacity: isFading ? 0 : 1,
                       transform: isFading ? 'translateX(40px)' : 'translateX(0)' }}
              className={`rounded-lg border p-4 ${
                RISK_COLOURS[item.action] || 'bg-gray-800 border-gray-600'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges row */}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded ${
                      riskMeta.cls
                    }`}>
                      {riskMeta.label}
                    </span>
                    <span className="font-mono font-semibold text-white text-sm">{item.action}</span>
                    {item.attackType && (
                      <span className="text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded font-mono">
                        {item.attackType}
                      </span>
                    )}
                    {item.severity && (
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                        item.severity === 'critical' ? 'bg-red-700 text-red-100'
                        : item.severity === 'high'   ? 'bg-orange-700 text-orange-100'
                        : 'bg-yellow-700 text-yellow-100'
                      }`}>
                        {item.severity}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <p className="text-sm text-gray-300 mb-1">
                    <span className="text-gray-500">Target IP: </span>{item.ip}
                  </p>
                  <p className="text-sm text-gray-300 mb-1">
                    <span className="text-gray-500">Agent reason: </span>{item.agentReason}
                  </p>
                  <p className="text-sm text-red-300 mb-2">
                    <span className="text-gray-500">Blocked because: </span>{item.blockedReason}
                  </p>

                  {/* Attack link */}
                  {item.attackId && (
                    <Link
                      to={`/attacks/${item.attackId}`}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      View Attack →
                    </Link>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex flex-col gap-2 shrink-0">
                  <button
                    onClick={() => setConfirm({ id: item._id, action: item.action, type: 'approve' })}
                    className="px-3 py-1.5 text-sm font-semibold rounded bg-green-600 hover:bg-green-500 text-white transition"
                  >
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => setConfirm({ id: item._id, action: item.action, type: 'reject' })}
                    className="px-3 py-1.5 text-sm font-semibold rounded bg-red-800 hover:bg-red-700 text-white transition"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                Queued: {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
