/**
 * Dashboard — SENTINAL command center overview.
 * Redesigned with full design system: StatCards, Panels,
 * live attack feed, service health, recent alerts.
 */
import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import {
  getStats, getRecentAttacks,
  getAlerts, getServiceStatus
} from '../services/api';
import {
  formatDateShort, formatConf, formatRelTime
} from '../utils/format';
import {
  SEVERITY_BADGE_CLASS, STATUS_BADGE_CLASS, POLL_INTERVAL, FEED_LIMIT
} from '../utils/constants';
import Panel        from '../components/ui/Panel';
import StatCard     from '../components/ui/StatCard';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge  from '../components/ui/StatusBadge';
import StatusDot    from '../components/ui/StatusDot';
import EmptyState   from '../components/ui/EmptyState';
import LoadingState from '../components/ui/LoadingState';
import ErrorState   from '../components/ui/ErrorState';
import PageWrapper  from '../components/layout/PageWrapper';

// ── Inline SVGs ───────────────────────────────────────────────────────────────
const IconZap      = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconBell     = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
const IconActivity = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>;
const IconScroll   = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2H4"/><line x1="12" y1="9" x2="18" y2="9"/><line x1="12" y1="13" x2="18" y2="13"/></svg>;
const IconArrow    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
const IconDot      = () => <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>;

// ── New-row flash animation ───────────────────────────────────────────────────
const FLASH_MS = 1400;
function useFlash() {
  const [flashing, setFlashing] = useState(null);
  const flash = useCallback((id) => {
    setFlashing(id);
    setTimeout(() => setFlashing(null), FLASH_MS);
  }, []);
  return [flashing, flash];
}

export default function Dashboard() {
  const stats      = useApi(getStats);
  const services   = useApi(getServiceStatus);
  const alertsApi  = useApi(() => getAlerts(6));
  const [attacks,  setAttacks]  = useState([]);
  const [atkLoad,  setAtkLoad]  = useState(true);
  const [flashing, flash]       = useFlash();

  const fetchAttacks = useCallback(async () => {
    try { const d = await getRecentAttacks(FEED_LIMIT); setAttacks(d); }
    catch (e) { console.error('[Dashboard] attacks', e); }
    finally   { setAtkLoad(false); }
  }, []);

  React.useEffect(() => { fetchAttacks(); }, [fetchAttacks]);
  useInterval(fetchAttacks,      POLL_INTERVAL);
  useInterval(stats.refetch,     POLL_INTERVAL);
  useInterval(services.refetch,  POLL_INTERVAL);
  useInterval(alertsApi.refetch, POLL_INTERVAL);

  useSocket('attack:new', useCallback((payload) => {
    const a = payload.data;
    setAttacks(prev => [{ ...a, _id: a.id }, ...prev].slice(0, FEED_LIMIT));
    flash(a.id);
  }, [flash]));

  useSocket('alert:new', useCallback(() => { alertsApi.refetch(); }, [alertsApi.refetch]));

  // Derived stats
  const statData = stats.data;
  const svcList  = services.data?.services || [];
  const onlineCnt = svcList.filter(s => s.status === 'online').length;
  const criticalAlerts = alertsApi.data?.filter(a => a.severity === 'critical' && !a.isRead).length || 0;

  return (
    <PageWrapper>
      <div className="page-container">

        {/* ── Page Header ──────────────────────────────────────────────── */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">Overview</h1>
            <p className="page-subtitle">Real-time security posture — SENTINAL command center</p>
          </div>
          <div className="page-actions">
            <span className="live-indicator">LIVE</span>
            <Link to="/simulate" className="btn btn-danger btn-sm">
              ⚔ Simulate Attack
            </Link>
          </div>
        </div>

        {/* ── Stat Cards ───────────────────────────────────────────────── */}
        <div className="stat-grid section" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))' }}>
          <StatCard
            label="Total Attacks"
            value={statData?.totalAttacks ?? 0}
            icon={<IconZap />}
            color="var(--color-critical)"
            accent
          />
          <StatCard
            label="Total Logs"
            value={statData?.totalLogs ?? 0}
            icon={<IconScroll />}
          />
          <StatCard
            label="Critical Alerts"
            value={statData?.criticalAlerts ?? 0}
            icon={<IconBell />}
            color={statData?.criticalAlerts > 0 ? 'var(--color-critical)' : 'var(--color-text)'}
          />
          <StatCard
            label="Services Online"
            value={`${onlineCnt} / ${svcList.length || '—'}`}
            icon={<IconActivity />}
            color={onlineCnt === svcList.length && svcList.length > 0 ? 'var(--color-online)' : 'var(--color-critical)'}
          />
        </div>

        {/* ── Main 2-column grid ───────────────────────────────────────── */}
        <div style={styles.mainGrid}>

          {/* Live Attack Feed */}
          <Panel
            title={
              <div style={styles.panelTitleRow}>
                <span className="panel-title">Live Attack Feed</span>
                <span className="live-indicator" style={{ fontSize: 'var(--text-xs)' }}>LIVE</span>
              </div>
            }
            actions={
              <Link to="/attacks" className="btn btn-ghost btn-sm" style={styles.viewAllBtn}>
                View all <IconArrow />
              </Link>
            }
            flush
            style={{ gridColumn: 'span 2' }}
          >
            {atkLoad ? (
              <LoadingState message="Fetching attack feed..." />
            ) : attacks.length === 0 ? (
              <EmptyState message="No attacks recorded" icon="🛡" />
            ) : (
              <div style={styles.tableWrap}>
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Source IP</th>
                      <th>Attack Type</th>
                      <th>Severity</th>
                      <th>Status</th>
                      <th>Confidence</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attacks.slice(0, 20).map(a => (
                      <tr
                        key={a._id}
                        style={flashing === (a.id || a._id) ? styles.flashRow : {}}
                      >
                        <td style={styles.cellMono}>{formatDateShort(a.createdAt || a.timestamp)}</td>
                        <td><code className="ip-addr">{a.ip}</code></td>
                        <td><span className="attack-tag">{a.attackType}</span></td>
                        <td><SeverityBadge severity={a.severity} /></td>
                        <td><StatusBadge  status={a.status}   /></td>
                        <td style={styles.cellMono}>{formatConf(a.confidence)}</td>
                        <td>
                          <Link
                            to={`/attacks/${a._id}`}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px' }}
                          >
                            →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* Service Health */}
          <Panel
            title="Service Health"
            actions={
              <Link to="/services" className="btn btn-ghost btn-sm" style={styles.viewAllBtn}>
                Details <IconArrow />
              </Link>
            }
          >
            {services.loading ? (
              <LoadingState />
            ) : services.error ? (
              <ErrorState message={services.error} onRetry={services.refetch} />
            ) : svcList.length === 0 ? (
              <EmptyState message="No services found" />
            ) : (
              <div style={styles.svcList}>
                {svcList.map(s => (
                  <div key={s.service} style={styles.svcRow}>
                    <StatusDot status={s.status} label={s.service} />
                    <span style={styles.svcMs}>
                      {s.responseTimeMs != null ? `${s.responseTimeMs}ms` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Recent Alerts */}
          <Panel
            title="Recent Alerts"
            actions={
              <Link to="/alerts" className="btn btn-ghost btn-sm" style={styles.viewAllBtn}>
                View all <IconArrow />
              </Link>
            }
          >
            {alertsApi.loading ? (
              <LoadingState />
            ) : alertsApi.error ? (
              <ErrorState message={alertsApi.error} onRetry={alertsApi.refetch} />
            ) : (alertsApi.data || []).length === 0 ? (
              <EmptyState message="No recent alerts" icon="🔔" />
            ) : (
              <div style={styles.alertList}>
                {(alertsApi.data || []).map(a => (
                  <div
                    key={a._id}
                    style={{
                      ...styles.alertRow,
                      opacity: a.isRead ? 0.55 : 1,
                    }}
                  >
                    <div style={styles.alertDot(a.severity)} />
                    <div style={styles.alertBody}>
                      <span style={styles.alertTitle}>{a.title || 'Alert'}</span>
                      <span style={styles.alertMeta}>
                        <SeverityBadge severity={a.severity} />
                        <span style={styles.alertTime}>{formatRelTime(a.createdAt)}</span>
                      </span>
                    </div>
                    {!a.isRead && <span style={styles.unreadDot} />}
                  </div>
                ))}
              </div>
            )}
          </Panel>

        </div>
      </div>
    </PageWrapper>
  );
}

const styles = {
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
  },
  panelTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  cellMono: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
  },
  flashRow: {
    animation: 'rowFlash 1.4s ease forwards',
    background: 'var(--color-critical-dim)',
  },
  viewAllBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    fontSize: 'var(--text-xs)',
  },
  svcList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  svcRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-2) 0',
    borderBottom: '1px solid var(--color-border)',
  },
  svcMs: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
  },
  alertList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
  alertRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) 0',
    borderBottom: '1px solid var(--color-border)',
  },
  alertDot: (severity) => ({
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: '5px',
    background: severity === 'critical' ? 'var(--color-critical)'
              : severity === 'high'     ? 'var(--color-high)'
              : severity === 'medium'   ? 'var(--color-medium)'
              : 'var(--color-low)',
  }),
  alertBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
    minWidth: 0,
  },
  alertTitle: {
    fontSize: 'var(--text-base)',
    color: 'var(--color-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  alertMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
  },
  alertTime: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  unreadDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--color-accent)',
    flexShrink: 0,
    alignSelf: 'center',
  },
};

// Inject row flash keyframe
if (typeof document !== 'undefined') {
  const id = '__sentinal-row-flash';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes rowFlash {
        0%   { background: var(--color-critical-dim); }
        60%  { background: var(--color-critical-dim); }
        100% { background: transparent; }
      }
    `;
    document.head.appendChild(s);
  }
}
