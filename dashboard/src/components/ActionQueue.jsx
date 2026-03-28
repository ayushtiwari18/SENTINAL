/**
 * ActionQueue — DEBUG BUILD
 * Console logs added at every step to trace why Approve/Reject fires no network request.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPendingActions, approveAction, rejectAction } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import SeverityBadge from './ui/SeverityBadge';
import EmptyState    from './ui/EmptyState';
import LoadingState  from './ui/LoadingState';

console.log('[ActionQueue] MODULE LOADED');

const RISK_META = {
  permanent_ban_ip:      { label: 'HIGH RISK',      color: 'var(--color-high)',      border: 'var(--color-high)' },
  shutdown_endpoint:     { label: 'CRITICAL RISK',  color: 'var(--color-critical)',  border: 'var(--color-critical)' },
  purge_all_sessions:    { label: 'MEDIUM RISK',    color: 'var(--color-medium)',    border: 'var(--color-medium)' },
  modify_firewall_rules: { label: 'CRITICAL RISK',  color: 'var(--color-critical)',  border: 'var(--color-critical)' },
};

export default function ActionQueue() {
  console.log('[ActionQueue] RENDER');

  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [removing,   setRemoving]   = useState(new Set());
  const [confirm,    setConfirm]    = useState(null);
  const [processing, setProcessing] = useState(false);
  const [modalError, setModalError] = useState(null);

  console.log('[ActionQueue] state — loading:', loading, 'items:', items.length, 'confirm:', confirm, 'processing:', processing);

  const load = async () => {
    console.log('[ActionQueue] load() called');
    try {
      const data = await getPendingActions();
      console.log('[ActionQueue] getPendingActions response:', data);
      setItems(data || []);
    } catch (e) {
      console.error('[ActionQueue] getPendingActions ERROR:', e.message, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[ActionQueue] useEffect mount — calling load()');
    load();
  }, []);

  useSocket('action:pending', useCallback((payload) => {
    console.log('[ActionQueue] socket action:pending received:', payload);
    const item = payload.data ?? payload;
    setItems(prev => prev.find(i => i._id === item._id) ? prev : [item, ...prev]);
  }, []));

  const fadeOut = (id) => {
    console.log('[ActionQueue] fadeOut id:', id);
    setRemoving(prev => new Set([...prev, id]));
    setTimeout(() => {
      setItems(prev => prev.filter(i => i._id !== id));
      setRemoving(prev => { const s = new Set(prev); s.delete(id); return s; });
    }, 350);
  };

  const handleConfirm = async () => {
    console.log('[ActionQueue] handleConfirm called — confirm:', confirm, 'processing:', processing);
    if (!confirm || processing) {
      console.warn('[ActionQueue] handleConfirm EARLY EXIT — confirm:', confirm, 'processing:', processing);
      return;
    }
    const { id, type } = confirm;
    console.log('[ActionQueue] calling API — type:', type, 'id:', id);

    setProcessing(true);
    setModalError(null);

    try {
      let result;
      if (type === 'approve') {
        console.log('[ActionQueue] calling approveAction(', id, ')');
        result = await approveAction(id);
        console.log('[ActionQueue] approveAction SUCCESS:', result);
      } else {
        console.log('[ActionQueue] calling rejectAction(', id, ')');
        result = await rejectAction(id);
        console.log('[ActionQueue] rejectAction SUCCESS:', result);
      }
      setConfirm(null);
      setProcessing(false);
      fadeOut(id);
    } catch (e) {
      console.error('[ActionQueue] API CALL FAILED:', e.message, e?.response?.status, e?.response?.data, e);
      const msg = e?.response?.data?.message || e.message || 'Request failed. Please try again.';
      setModalError(`${type === 'approve' ? 'Approve' : 'Reject'} failed: ${msg}`);
      setProcessing(false);
    }
  };

  const handleCancelModal = () => {
    console.log('[ActionQueue] handleCancelModal — processing:', processing);
    if (processing) return;
    setConfirm(null);
    setModalError(null);
  };

  const handleApproveClick = (item) => {
    console.log('[ActionQueue] APPROVE BUTTON CLICKED — item._id:', item._id, 'action:', item.action);
    setModalError(null);
    setConfirm({ id: item._id, action: item.action, type: 'approve' });
    console.log('[ActionQueue] setConfirm called with approve');
  };

  const handleRejectClick = (item) => {
    console.log('[ActionQueue] REJECT BUTTON CLICKED — item._id:', item._id, 'action:', item.action);
    setModalError(null);
    setConfirm({ id: item._id, action: item.action, type: 'reject' });
    console.log('[ActionQueue] setConfirm called with reject');
  };

  console.log('[ActionQueue] PRE-RENDER CHECK — loading:', loading, 'items.length:', items.length);

  if (loading) {
    console.log('[ActionQueue] returning LoadingState');
    return <LoadingState message="Loading action queue..." />;
  }
  if (!items.length) {
    console.log('[ActionQueue] returning EmptyState');
    return (
      <EmptyState
        message="No pending actions — ArmorIQ has not blocked anything requiring review."
        icon="✅"
      />
    );
  }

  console.log('[ActionQueue] rendering', items.length, 'items, confirm state:', JSON.stringify(confirm));

  return (
    <>
      {confirm && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={styles.modalTitle}>
              {confirm.type === 'approve' ? '✅ Confirm Approve' : '❌ Confirm Reject'}
            </h3>
            <p style={styles.modalBody}>
              Action: <code style={{ color: 'var(--color-text)', fontFamily: 'var(--font-mono)' }}>{confirm.action}</code>
            </p>
            <p style={{ ...styles.modalBody, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-5)' }}>
              {confirm.type === 'approve'
                ? 'This will authorise ArmorIQ to execute this action. Are you sure?'
                : 'This will permanently reject this action. It will not be executed.'}
            </p>

            {modalError && (
              <div style={styles.modalError}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={styles.modalActions}>
              <button
                className="btn btn-ghost"
                onClick={() => { console.log('[ActionQueue] Cancel clicked'); handleCancelModal(); }}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className={`btn ${confirm.type === 'approve' ? '' : 'btn-danger'}`}
                style={{
                  ...(confirm.type === 'approve' ? { background: 'var(--color-online)', color: '#000' } : {}),
                  opacity: processing ? 0.6 : 1,
                  cursor:  processing ? 'not-allowed' : 'pointer',
                }}
                onClick={() => { console.log('[ActionQueue] YES button clicked — calling handleConfirm'); handleConfirm(); }}
                disabled={processing}
              >
                {processing
                  ? (confirm.type === 'approve' ? 'Approving…' : 'Rejecting…')
                  : (confirm.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={styles.list}>
        {items.map((item) => {
          const risk     = RISK_META[item.action] || { label: 'BLOCKED', color: 'var(--color-critical)', border: 'var(--color-critical)' };
          const isFading = removing.has(item._id);

          return (
            <div
              key={item._id}
              style={{
                ...styles.card,
                borderColor: risk.border,
                opacity:     isFading ? 0 : 1,
                transform:   isFading ? 'translateX(40px)' : 'translateX(0)',
                transition:  'opacity 350ms ease, transform 350ms ease',
              }}
            >
              <div style={styles.cardBody}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.badgeRow}>
                    <span style={{ ...styles.riskBadge, color: risk.color, borderColor: risk.color }}>
                      {risk.label}
                    </span>
                    <code style={styles.actionCode}>{item.action}</code>
                    {item.attackType && (
                      <span className="attack-tag">{item.attackType}</span>
                    )}
                    {item.severity && <SeverityBadge severity={item.severity} />}
                  </div>

                  <div style={styles.details}>
                    <span style={styles.detailLabel}>Target IP</span>
                    <code className="ip-addr">{item.ip}</code>
                  </div>
                  <div style={styles.details}>
                    <span style={styles.detailLabel}>Agent Reason</span>
                    <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{item.agentReason}</span>
                  </div>
                  <div style={styles.details}>
                    <span style={styles.detailLabel}>Blocked Because</span>
                    <span style={{ color: 'var(--color-critical)', fontSize: 'var(--text-sm)' }}>{item.blockedReason}</span>
                  </div>

                  {item.attackId && (
                    <Link to={`/attacks/${item.attackId}`} style={styles.attackLink}>
                      View Attack →
                    </Link>
                  )}
                </div>

                <div style={styles.btnCol}>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-online)', color: '#000', fontWeight: 'var(--weight-semibold)' }}
                    onClick={() => handleApproveClick(item)}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleRejectClick(item)}
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>

              <div style={styles.cardFooter}>
                Queued: <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(item.createdAt).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' },
  card: {
    background: 'var(--color-surface)',
    border: '1px solid',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4)',
  },
  cardBody: { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-4)' },
  badgeRow: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' },
  riskBadge: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    letterSpacing: 'var(--tracking-widest)',
    border: '1px solid',
    borderRadius: 'var(--radius-sm)',
    padding: '2px 8px',
    textTransform: 'uppercase',
  },
  actionCode: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-sm)',
  },
  details: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-2)',
    fontSize: 'var(--text-sm)',
  },
  detailLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
    flexShrink: 0,
    minWidth: '110px',
  },
  attackLink: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-accent)',
    textDecoration: 'none',
    marginTop: 'var(--space-1)',
    display: 'inline-block',
  },
  btnCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    flexShrink: 0,
  },
  cardFooter: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    marginTop: 'var(--space-3)',
    borderTop: '1px solid var(--color-border)',
    paddingTop: 'var(--space-2)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(6px)',
  },
  modal: {
    background: 'var(--color-surface-raised)',
    border: '1px solid var(--color-border-strong)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-6)',
    width: '100%',
    maxWidth: '420px',
    boxShadow: 'var(--shadow-lg)',
  },
  modalTitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--color-text)',
    marginBottom: 'var(--space-3)',
  },
  modalBody: {
    fontSize: 'var(--text-base)',
    color: 'var(--color-text-secondary)',
    marginBottom: 'var(--space-2)',
  },
  modalError: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-critical)',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid var(--color-critical)',
    borderRadius: 'var(--radius-md)',
    padding: '8px 12px',
    marginBottom: 'var(--space-4)',
  },
  modalActions: {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
  },
};
