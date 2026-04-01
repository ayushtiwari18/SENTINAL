/**
 * ThreatInvestigationDrawer
 * Slides in from the right when a threat row is clicked.
 * Shows: attack details, risk timeline, entity interactions, remediations.
 */
import React, { useEffect, useRef } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  Tooltip, ReferenceLine, Dot
} from 'recharts';
import { formatDate, formatRelTime, formatConf, parseExplanation } from '../utils/format';
import SeverityBadge from './ui/SeverityBadge';
import StatusBadge   from './ui/StatusBadge';

// ── Severity → colour map ────────────────────────────────────────────────────
const SEV_COLOR = {
  critical: '#f44747',
  high:     '#ce9178',
  medium:   '#dcdcaa',
  low:      '#9cdcfe',
};

// Build a fake 24-hr risk timeline from attack data
function buildTimeline(attack) {
  const pts = [];
  const now = Date.now();
  for (let i = 23; i >= 0; i--) {
    const t = now - i * 3_600_000;
    const label = `${new Date(t).getHours()}:00`;
    const isNear = attack.createdAt &&
      Math.abs(new Date(attack.createdAt).getTime() - t) < 3_600_000;
    pts.push({
      label,
      risk: isNear ? (attack.severity === 'critical' ? 3 : attack.severity === 'high' ? 2 : 1) : 0,
    });
  }
  return pts;
}

// ── Custom dot on the timeline ───────────────────────────────────────────────
function RiskDot(props) {
  const { cx, cy, payload } = props;
  if (!payload.risk) return null;
  const colors = ['', '#dcdcaa', '#ce9178', '#f44747'];
  const r = payload.risk === 3 ? 6 : payload.risk === 2 ? 5 : 4;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 3} fill={colors[payload.risk]} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={r}     fill={colors[payload.risk]} />
    </g>
  );
}

// ── Entity pair row ──────────────────────────────────────────────────────────
function EntityRow({ src, tgt, type, time }) {
  return (
    <div style={dr.entityRow}>
      <div style={dr.entityCell}>
        <span style={dr.entityLabel}>SOURCE</span>
        <span style={dr.entityValue}>{src}</span>
      </div>
      <div style={dr.entityArrow}>→</div>
      <div style={dr.entityCell}>
        <span style={dr.entityLabel}>TARGET</span>
        <span style={dr.entityValue}>{tgt}</span>
      </div>
      <div style={dr.entityType}>
        <span style={dr.tag}>{type}</span>
        {time && <span style={dr.entityTime}>{formatRelTime(time)}</span>}
      </div>
    </div>
  );
}

// ── Main Drawer ──────────────────────────────────────────────────────────────
export default function ThreatInvestigationDrawer({ attack, onClose }) {
  const drawerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = attack ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [attack]);

  const open = !!attack;
  const timeline = attack ? buildTimeline(attack) : [];
  const sevColor = attack ? (SEV_COLOR[attack.severity] || '#888') : '#888';
  const explanation = attack ? parseExplanation(attack.explanation) : {};

  const entities = attack ? [
    { src: attack.ip || '—',         tgt: 'Gateway',          type: 'INITIAL_ACCESS',   time: attack.createdAt },
    { src: attack.ip || '—',         tgt: attack.attackType,  type: attack.attackType?.toUpperCase() || 'THREAT', time: attack.createdAt },
    { src: 'Detection Engine',       tgt: 'Attack Log',       type: 'LOGGED',           time: attack.createdAt },
    { src: 'Attack Log',             tgt: 'Alert System',     type: 'ALERT_TRIGGERED',  time: attack.createdAt },
  ] : [];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ ...dr.backdrop, opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none' }}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        style={{
          ...dr.drawer,
          transform: open ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* ── Header ── */}
        <div style={dr.header}>
          <div style={dr.headerLeft}>
            <div style={{ ...dr.sevDot, background: sevColor, boxShadow: `0 0 10px ${sevColor}88` }} />
            <div>
              <h2 style={dr.title}>{attack?.attackType?.toUpperCase().replace(/_/g,' ') || '—'}</h2>
              <span style={dr.subtitle}>ID: {attack?._id?.slice(-8) || '—'} · {formatRelTime(attack?.createdAt)}</span>
            </div>
          </div>
          <div style={dr.headerActions}>
            <button style={{ ...dr.actionBtn, background: '#1a2a1a', color: '#4ec9b0', border: '1px solid #4ec9b044' }}
              onClick={() => window.open(`/attacks/${attack?._id}`, '_blank')}>
              🔍 Investigate
            </button>
            <button style={{ ...dr.actionBtn, background: '#2a1a1a', color: '#f44747', border: '1px solid #f4474744' }}>
              🚫 Block IP
            </button>
            <button style={dr.closeBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        {/* ── Scrollable Body ── */}
        <div style={dr.body}>

          {/* Meta cards */}
          <div style={dr.metaGrid}>
            {[
              { label: 'Severity',    value: <SeverityBadge severity={attack?.severity} /> },
              { label: 'Status',      value: <StatusBadge   status={attack?.status} /> },
              { label: 'Confidence',  value: formatConf(attack?.confidence) },
              { label: 'Detected By', value: attack?.detectedBy || '—' },
              { label: 'Source IP',   value: <code style={dr.code}>{attack?.ip || '—'}</code> },
              { label: 'Detected At', value: formatDate(attack?.createdAt) },
            ].map(({ label, value }) => (
              <div key={label} style={dr.metaCard}>
                <span style={dr.metaLabel}>{label}</span>
                <span style={dr.metaValue}>{value}</span>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div style={dr.tagsRow}>
            {['Threat Detected', attack?.attackType, attack?.severity, attack?.detectedBy]
              .filter(Boolean).map(t => (
                <span key={t} style={{
                  ...dr.tag,
                  background: t === attack?.severity
                    ? `${sevColor}22` : 'var(--color-surface-raised)',
                  color: t === attack?.severity ? sevColor : 'var(--color-text-secondary)',
                  border: `1px solid ${t === attack?.severity ? `${sevColor}44` : 'var(--color-border)'}`,
                }}>{t}</span>
              ))}
          </div>

          {/* Risk Timeline */}
          <div style={dr.section}>
            <div style={dr.sectionHeader}>
              <span style={dr.sectionTitle}>Interactions Over Time</span>
              <div style={dr.legendRow}>
                {[['No Risk','#333'],['Some Risk','#dcdcaa'],['At Risk','#f44747']].map(([l,c])=>(
                  <span key={l} style={dr.legendItem}>
                    <span style={{ ...dr.legendDot, background: c }} />{l}
                  </span>
                ))}
              </div>
            </div>
            <div style={dr.chartWrap}>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={timeline} margin={{ top: 8, right: 8, left: -32, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#555' }} interval={5} />
                  <YAxis domain={[0, 3]} hide />
                  <Tooltip
                    contentStyle={{ background: '#111', border: '1px solid #222', fontSize: 11 }}
                    formatter={(v) => [['—','Some Risk','High Risk','Critical'][v], 'Risk']}
                  />
                  <ReferenceLine y={1} stroke="#dcdcaa22" strokeDasharray="3 3" />
                  <ReferenceLine y={2} stroke="#ce917822" strokeDasharray="3 3" />
                  <Line
                    type="monotone" dataKey="risk"
                    stroke={sevColor} strokeWidth={1.5}
                    dot={<RiskDot />} activeDot={{ r: 5, fill: sevColor }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explanation */}
          {explanation?.summary && (
            <div style={dr.section}>
              <span style={dr.sectionTitle}>Analysis</span>
              <p style={dr.analysisText}>{explanation.summary}</p>
              {explanation.recommended_action && (
                <div style={dr.remediation}>
                  <span style={dr.remediationLabel}>💡 Recommended Action</span>
                  <p style={dr.remediationText}>{explanation.recommended_action}</p>
                </div>
              )}
            </div>
          )}

          {/* Entities & Interactions */}
          <div style={dr.section}>
            <div style={dr.sectionHeader}>
              <span style={dr.sectionTitle}>Entities & Interactions</span>
              <span style={dr.sectionCount}>{entities.length} interactions</span>
            </div>
            <div style={dr.entityList}>
              {entities.map((e, i) => (
                <EntityRow key={i} {...e} />
              ))}
            </div>
          </div>

          {/* Payload */}
          {attack?.payload && (
            <div style={dr.section}>
              <span style={dr.sectionTitle}>Attack Payload</span>
              <pre style={dr.pre}>{attack.payload}</pre>
            </div>
          )}

        </div>
      </div>
    </>
  );
}

// ── Drawer Styles ────────────────────────────────────────────────────────────
const dr = {
  backdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.65)',
    backdropFilter: 'blur(2px)',
    zIndex: 'var(--z-overlay)',
    transition: 'opacity var(--transition-drawer)',
  },
  drawer: {
    position: 'fixed', top: 0, right: 0, bottom: 0,
    width: 'min(680px, 95vw)',
    background: 'var(--color-overlay)',
    borderLeft: '1px solid var(--color-border-strong)',
    boxShadow: '-8px 0 40px rgba(0,0,0,0.7)',
    zIndex: 'var(--z-drawer)',
    display: 'flex', flexDirection: 'column',
    transition: 'transform var(--transition-drawer)',
    willChange: 'transform',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '20px 24px',
    borderBottom: '1px solid var(--color-border-strong)',
    background: 'var(--color-surface)',
    flexShrink: 0,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  sevDot: { width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 2 },
  title: { fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', color: 'var(--color-text)', margin: 0, letterSpacing: 1 },
  subtitle: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  actionBtn: {
    padding: '5px 12px', borderRadius: 'var(--radius-md)',
    fontSize: 11, fontWeight: 600, cursor: 'pointer',
    transition: 'opacity var(--transition-fast)',
  },
  closeBtn: {
    background: 'transparent', border: '1px solid var(--color-border)',
    color: 'var(--color-text-muted)', borderRadius: 'var(--radius-md)',
    padding: '4px 10px', cursor: 'pointer', fontSize: 14,
  },
  body: { flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 },
  metaGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  metaCard: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)', padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  metaLabel: { fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  metaValue: { fontSize: 'var(--text-sm)', color: 'var(--color-text)', fontWeight: 500 },
  tagsRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tag: {
    padding: '3px 10px', borderRadius: 'var(--radius-full)',
    fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  section: {
    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xl)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' },
  sectionCount: { fontSize: 10, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' },
  chartWrap: { borderRadius: 'var(--radius-md)', background: 'var(--color-code-bg)', padding: '4px 0' },
  legendRow: { display: 'flex', gap: 12 },
  legendItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--color-text-muted)' },
  legendDot: { width: 7, height: 7, borderRadius: '50%' },
  entityList: { display: 'flex', flexDirection: 'column', gap: 2 },
  entityRow: {
    display: 'grid', gridTemplateColumns: '1fr 20px 1fr 140px',
    alignItems: 'center', gap: 8,
    padding: '8px 10px', borderRadius: 'var(--radius-md)',
    background: 'var(--color-surface-raised)',
    transition: 'background var(--transition-fast)',
  },
  entityCell: { display: 'flex', flexDirection: 'column', gap: 2 },
  entityLabel: { fontSize: 9, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  entityValue: { fontSize: 11, color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontWeight: 500 },
  entityArrow: { color: 'var(--color-accent)', fontWeight: 700, textAlign: 'center', fontSize: 14 },
  entityType: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 },
  entityTime: { fontSize: 9, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' },
  analysisText: { fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 },
  remediation: {
    background: 'var(--color-accent-dim)', border: '1px solid var(--color-accent-glow)',
    borderRadius: 'var(--radius-md)', padding: '10px 12px',
  },
  remediationLabel: { fontSize: 10, fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 },
  remediationText: { fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 },
  code: { fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-code-text)' },
  pre: {
    fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-code-text)',
    background: 'var(--color-code-bg)', border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)', padding: '10px 12px', margin: 0,
    overflowX: 'auto', maxHeight: 120, lineHeight: 1.6,
  },
};
