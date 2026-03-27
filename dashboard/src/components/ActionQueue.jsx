/**
 * ActionQueue — ArmorIQ blocked actions with confirm modal + attack link.
 * Full design system redesign. All business logic preserved.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPendingActions, approveAction, rejectAction } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import SeverityBadge from './ui/SeverityBadge';
import EmptyState    from './ui/EmptyState';
import LoadingState  from './ui/LoadingState';

const RISK_META = {
  permanent_ban_ip:      { label: 'HIGH RISK',      color: 'var(--color-high)',      border: 'var(--color-high)' },
  shutdown_endpoint:     { label: 'CRITICAL RISK',  color: 'var(--color-critical)',  border: 'var(--color-critical)' },
  purge_all_sessions:    { label: 'MEDIUM RISK',    color: 'var(--color-medium)',    border: 'var(--color-medium)' },
  modify_firewall_rules: { label: 'CRITICAL RISK',  color: 'var(--color-critical)',  border: 'var(--color-critical)' },
};

export default function ActionQueue() {
  const [items,    setItems]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState(new Set());
  const [confirm,  setConfirm]  = useState(null);

  const load = async () => {
    try {
      const data = await getPendingActions();
      setItems(data || []);
    } catch (e) {
      console.error('[ActionQueue]', e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useSocket('action:pending', useCallback((payload) => {
    const item = payload.data ?? payload;
    setItems(prev => prev.find(i => i._id === item._id) ? prev : [item, ...prev]);
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

  if (loading) return <LoadingState message="Loading action queue..." />;
  if (!items.length) return (
    <EmptyState
      message="No pending actions — ArmorIQ has not blocked anything requiring review."
      icon="✅"
    />
  );

  return (
    <>
      {/* Confirm Modal */}
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
            <div style={styles.modalActions}>
              <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Cancel</button>
              <button
                className={`btn ${confirm.type === 'approve' ? '' : 'btn-danger'}`}
                style={confirm.type === 'approve' ? { background: 'var(--color-online)', color: '#000' } : {}}
                onClick={handleConfirm}
              >
                {confirm.type === 'approve' ? 'Yes, Approve' : 'Yes, Reject'}
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
                  {/* Badge row */}
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

                  {/* Detail rows */}
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

                {/* Action buttons */}
                <div style={styles.btnCol}>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--color-online)', color: '#000', fontWeight: 'var(--weight-semibold)' }}
                    onClick={() => setConfirm({ id: item._id, action: item.action, type: 'approve' })}
                  >
                    ✅ Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setConfirm({ id: item._id, action: item.action, type: 'reject' })}
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
    zIndex: 'var(--z-modal)',
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
  modalActions: {
    display: 'flex',
    gap: 'var(--space-3)',
    justifyContent: 'flex-end',
  },
};
