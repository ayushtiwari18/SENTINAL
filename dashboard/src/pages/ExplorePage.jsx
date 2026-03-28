/**
 * ExplorePage — Threat Explorer
 * SolarWinds-inspired dark table with investigation drawer.
 * Uses existing getRecentAttacks() — zero new backend endpoints.
 */
import React, { useState, useCallback, useMemo } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getRecentAttacks } from '../services/api';
import { formatDate, formatRelTime, formatConf, truncate } from '../utils/format';
import { SEVERITY_LEVELS, ATTACK_TYPES } from '../utils/constants';
import SeverityBadge   from '../components/ui/SeverityBadge';
import PageWrapper     from '../components/layout/PageWrapper';
import LoadingState    from '../components/ui/LoadingState';
import ErrorState      from '../components/ui/ErrorState';
import EmptyState      from '../components/ui/EmptyState';
import ThreatInvestigationDrawer from '../components/ThreatInvestigationDrawer';

const POLL = 20000;

const SEV_COLOR = {
  critical: '#f44747',
  high:     '#ce9178',
  medium:   '#dcdcaa',
  low:      '#9cdcfe',
};

const ENTITY_TYPE_MAP = {
  sqli:              'SQL Injection Node',
  xss:               'XSS Node',
  traversal:         'Path Traversal',
  command_injection: 'Command Injection',
  ssrf:              'SSRF Node',
  lfi_rfi:           'LFI/RFI Node',
  brute_force:       'Brute Force Node',
  hpp:               'HTTP Pollution Node',
  xxe:               'XXE Node',
  webshell:          'Webshell Node',
  recon:             'Recon Node',
  ddos:              'DDoS Node',
  unknown:           'Unknown Node',
};

// ── Live pulse dot ───────────────────────────────────────────────────────────
function PulseDot({ color }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color, display: 'inline-block',
        boxShadow: `0 0 6px ${color}`,
      }} />
      <span style={{
        position: 'absolute', width: 8, height: 8, borderRadius: '50%',
        background: color, opacity: 0.4,
        animation: 'pulse-ring 1.8s ease-out infinite',
      }} />
    </span>
  );
}

// ── Stats bar at the top ─────────────────────────────────────────────────────
function StatCard({ label, value, color, icon }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: `1px solid ${color}33`,
      borderRadius: 'var(--radius-xl)',
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: `0 0 20px ${color}0d`,
      flex: 1, minWidth: 140,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1, fontFamily: 'var(--font-mono)' }}>
          {value}
        </div>
        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 3 }}>
          {label}
        </div>
      </div>
    </div>
  );
}

// ── Severity filter pill ─────────────────────────────────────────────────────
function SevPill({ label, active, color, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 'var(--radius-full)',
        border: `1px solid ${active ? color : 'var(--color-border)'}`,
        background: active ? `${color}22` : 'transparent',
        color: active ? color : 'var(--color-text-muted)',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5,
        transition: 'all var(--transition-fast)',
      }}
    >
      {label}
      {count > 0 && (
        <span style={{
          background: active ? color : 'var(--color-surface-raised)',
          color: active ? '#000' : 'var(--color-text-muted)',
          borderRadius: 'var(--radius-full)', padding: '0 5px',
          fontSize: 9, fontWeight: 700,
        }}>{count}</span>
      )}
    </button>
  );
}

// ── Table row ────────────────────────────────────────────────────────────────
function ThreatRow({ attack, index, onInvestigate, selected }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sevColor = SEV_COLOR[attack.severity] || '#888';
  const isEven = index % 2 === 0;

  return (
    <tr
      style={{
        background: selected
          ? `${sevColor}12`
          : isEven ? 'transparent' : 'var(--color-surface)',
        borderLeft: selected ? `3px solid ${sevColor}` : '3px solid transparent',
        cursor: 'pointer',
        transition: 'background var(--transition-fast)',
      }}
      onClick={() => onInvestigate(attack)}
      onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--color-surface-raised)'; }}
      onMouseLeave={e => { if (!selected) e.currentTarget.style.background = isEven ? 'transparent' : 'var(--color-surface)'; }}
    >
      {/* Checkbox */}
      <td style={{ width: 40, textAlign: 'center' }}>
        <input
          type="checkbox" checked={selected}
          onChange={() => {}}
          onClick={e => e.stopPropagation()}
          style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
        />
      </td>

      {/* Entity Type */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: sevColor, flexShrink: 0,
          }} />
          <span style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
            {ENTITY_TYPE_MAP[attack.attackType] || 'Unknown Node'}
          </span>
        </div>
      </td>

      {/* Alert Setting (attack description) */}
      <td style={{ maxWidth: 220 }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: selected ? sevColor : 'var(--color-text-secondary)',
          fontWeight: selected ? 700 : 400,
        }}>
          {truncate(attack.attackType?.replace(/_/g,' ').toUpperCase() + ': ' + (attack.payload || attack.ip || ''), 48)}
        </span>
      </td>

      {/* Severity */}
      <td>
        <span style={{
          padding: '3px 10px', borderRadius: 'var(--radius-full)',
          background: `${sevColor}22`,
          color: sevColor,
          border: `1px solid ${sevColor}44`,
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          {attack.severity}
        </span>
      </td>

      {/* Active Since */}
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
        {formatDate(attack.createdAt)}
      </td>

      {/* Source IP */}
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PulseDot color={sevColor} />
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-code-text)' }}>
            {truncate(attack.ip || '—', 18)}
          </code>
        </div>
      </td>

      {/* Confidence */}
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--color-text-muted)' }}>
        {formatConf(attack.confidence)}
      </td>

      {/* Action menu */}
      <td style={{ textAlign: 'right', paddingRight: 12 }} onClick={e => e.stopPropagation()}>
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <button
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1,
              borderRadius: 'var(--radius-md)', padding: '2px 6px',
              transition: 'color var(--transition-fast)',
            }}
            onClick={() => setMenuOpen(v => !v)}
          >⋮</button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute', right: 0, top: '100%', zIndex: 200,
                background: 'var(--color-surface-high)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                minWidth: 160, overflow: 'hidden',
              }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              {[
                { icon: '🔍', label: 'Investigate', action: () => { onInvestigate(attack); setMenuOpen(false); } },
                { icon: '🚫', label: 'Block IP',    action: () => setMenuOpen(false) },
                { icon: '✓',  label: 'Mark Resolved', action: () => setMenuOpen(false) },
                { icon: '📋', label: 'Copy IP',     action: () => { navigator.clipboard?.writeText(attack.ip || ''); setMenuOpen(false); } },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 14px',
                    background: 'transparent', border: 'none',
                    color: 'var(--color-text-secondary)', fontSize: 12,
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-raised)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ExplorePage() {
  const { data: raw, loading, error, refetch } = useApi(() => getRecentAttacks(300));
  const [attacks, setAttacks]     = useState([]);
  const [selected, setSelected]   = useState(null);   // drawer target
  const [filter, setFilter]       = useState({ severity: '', type: '', search: '' });
  const [page, setPage]           = useState(1);
  const PAGE_SIZE = 20;

  React.useEffect(() => { if (raw) setAttacks(raw); }, [raw]);
  useInterval(refetch, POLL);

  useSocket('attack:new', useCallback((payload) => {
    const a = payload.data;
    setAttacks(prev => [{ ...a, _id: a.id }, ...prev].slice(0, 300));
  }, []));

  // Stats
  const stats = useMemo(() => ({
    total:    attacks.length,
    critical: attacks.filter(a => a.severity === 'critical').length,
    high:     attacks.filter(a => a.severity === 'high').length,
    medium:   attacks.filter(a => a.severity === 'medium').length,
    low:      attacks.filter(a => a.severity === 'low').length,
  }), [attacks]);

  // Filtered list
  const filtered = useMemo(() => attacks.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.type     && a.attackType !== filter.type)   return false;
    if (filter.search) {
      const q = filter.search.toLowerCase();
      if (!a.ip?.includes(q) &&
          !a.attackType?.toLowerCase().includes(q) &&
          !a.payload?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [attacks, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset page on filter change
  React.useEffect(() => setPage(1), [filter]);

  return (
    <PageWrapper>
      {/* Pulse keyframe */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
      `}</style>

      <div className="page-container">

        {/* ── Page Header ── */}
        <div className="page-header" style={{ marginBottom: 20 }}>
          <div className="page-title-group">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                background: 'var(--color-accent-dim)', border: '1px solid var(--color-accent-glow)',
                borderRadius: 'var(--radius-md)', padding: '4px 8px', fontSize: 14,
              }}>🧭</span>
              Threat Explorer
            </h1>
            <p className="page-subtitle">
              Real-time network threat surface · {attacks.length} threats indexed
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={refetch}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              ↻ Refresh
            </button>
            <button
              className="btn btn-sm"
              style={{ background: 'var(--color-accent)', color: '#000', fontWeight: 700, border: 'none', padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              + Add Filter
            </button>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <StatCard icon="🔴" label="Critical" value={stats.critical} color="#f44747" />
          <StatCard icon="🟠" label="High"     value={stats.high}     color="#ce9178" />
          <StatCard icon="🟡" label="Medium"   value={stats.medium}   color="#dcdcaa" />
          <StatCard icon="🔵" label="Low"      value={stats.low}      color="#9cdcfe" />
          <StatCard icon="📡" label="Total Threats" value={stats.total} color="#00d4aa" />
        </div>

        {/* ── Main Panel ── */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-md)',
        }}>

          {/* Panel Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Network Threat Devices
            </span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <PulseDot color="#00d4aa" />
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Live</span>
            </div>
          </div>

          {/* Filter toolbar */}
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '10px 16px',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap',
          }}>
            {/* Search */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
              <span style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--color-text-muted)', fontSize: 13,
              }}>⌕</span>
              <input
                type="text"
                placeholder="Search by IP, attack type, payload…"
                value={filter.search}
                onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                style={{ paddingLeft: 28, width: '100%' }}
              />
            </div>

            {/* Severity pills */}
            <div style={{ display: 'flex', gap: 5 }}>
              {['critical','high','medium','low'].map(s => (
                <SevPill
                  key={s} label={s}
                  color={SEV_COLOR[s]}
                  count={attacks.filter(a => a.severity === s).length}
                  active={filter.severity === s}
                  onClick={() => setFilter(f => ({ ...f, severity: f.severity === s ? '' : s }))}
                />
              ))}
            </div>

            {/* Type filter */}
            <select
              value={filter.type}
              onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}
              style={{ minWidth: 130 }}
            >
              <option value="">All Types</option>
              {ATTACK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Clear */}
            {(filter.search || filter.severity || filter.type) && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilter({ severity: '', type: '', search: '' })}
              >✕ Clear</button>
            )}

            {/* Count */}
            <span style={{
              marginLeft: 'auto', fontFamily: 'var(--font-mono)',
              fontSize: 11, color: 'var(--color-text-muted)',
            }}>
              {filtered.length} / {attacks.length}
            </span>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ padding: 40 }}><LoadingState message="Scanning threat surface…" /></div>
          ) : error ? (
            <div style={{ padding: 40 }}><ErrorState message={error} onRetry={refetch} /></div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40 }}><EmptyState message="No threats match the current filter." icon="🛡️" /></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {[
                      { w: 40,  label: '' },
                      { w: 180, label: 'Entity Type' },
                      { w: 240, label: 'Alert Setting' },
                      { w: 100, label: 'Severity' },
                      { w: 160, label: 'Active Since' },
                      { w: 160, label: 'Source' },
                      { w: 80,  label: 'Confidence' },
                      { w: 50,  label: 'Action' },
                    ].map(col => (
                      <th
                        key={col.label}
                        style={{
                          width: col.w, padding: '8px 12px', textAlign: 'left',
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--color-text-muted)',
                          textTransform: 'uppercase', letterSpacing: '0.1em',
                          background: 'var(--color-surface)',
                          position: 'sticky', top: 0, zIndex: 1,
                          borderBottom: '1px solid var(--color-border)',
                        }}
                      >{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((attack, idx) => (
                    <ThreatRow
                      key={attack._id}
                      attack={attack}
                      index={idx}
                      selected={selected?._id === attack._id}
                      onInvestigate={setSelected}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination footer */}
          {filtered.length > PAGE_SIZE && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px',
              borderTop: '1px solid var(--color-border)',
              background: 'var(--color-surface-raised)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                Page {page} of {totalPages} · {filtered.length} results
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => p - 1)}
                  style={{ opacity: page === 1 ? 0.4 : 1 }}
                >← Prev</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button
                      key={p}
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPage(p)}
                      style={{
                        background: p === page ? 'var(--color-accent-dim)' : 'transparent',
                        color:      p === page ? 'var(--color-accent)'     : 'var(--color-text-muted)',
                        border:     p === page ? '1px solid var(--color-accent-glow)' : '1px solid transparent',
                        minWidth: 28, textAlign: 'center',
                      }}
                    >{p}</button>
                  );
                })}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(p => p + 1)}
                  style={{ opacity: page === totalPages ? 0.4 : 1 }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Investigation Drawer */}
      <ThreatInvestigationDrawer
        attack={selected}
        onClose={() => setSelected(null)}
      />
    </PageWrapper>
  );
}
