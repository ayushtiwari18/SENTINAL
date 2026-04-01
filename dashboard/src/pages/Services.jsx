/**
 * Services — redesigned with full design system.
 * Service health cards + gateway health panel.
 * All socket and polling logic preserved.
 */
import React, { useCallback } from 'react';
import { useApi }      from '../hooks/useApi';
import { useSocket }   from '../hooks/useSocket';
import { useInterval } from '../hooks/useInterval';
import { getServiceStatus, getHealth } from '../services/api';
import { formatDate, formatMs } from '../utils/format';
import Panel      from '../components/ui/Panel';
import StatusDot  from '../components/ui/StatusDot';
import StatusBadge from '../components/ui/StatusBadge';
import LoadingState from '../components/ui/LoadingState';
import ErrorState  from '../components/ui/ErrorState';
import EmptyState  from '../components/ui/EmptyState';
import PageWrapper from '../components/layout/PageWrapper';

const POLL = 30000;

const SERVICE_LABELS = {
  'gateway':          'API Gateway',
  'detection-engine': 'Detection Engine',
  'pcap-processor':   'PCAP Processor',
  'sentinal-response-engine': 'SENTINAL Response Engine',
};

const SERVICE_ICONS = {
  'gateway':          '🔀',
  'detection-engine': '🔍',
  'pcap-processor':   '📡',
  'sentinal-response-engine': '🤖',
};

export default function Services() {
  const status = useApi(getServiceStatus);
  const health = useApi(getHealth);

  useInterval(status.refetch, POLL);
  useInterval(health.refetch, POLL);

  useSocket('service:status', useCallback(() => {
    status.refetch();
  }, [status.refetch]));

  const d    = status.data;
  const svcs = d?.services || [];

  return (
    <PageWrapper>
      <div className="page-container">

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">Service Health</h1>
            <p className="page-subtitle">
              Overall: <strong style={{ color:
                d?.overall === 'healthy'   ? 'var(--color-online)'
              : d?.overall === 'degraded'  ? 'var(--color-warning)'
              : 'var(--color-critical)'
              }}>{d?.overall || '—'}</strong>
              {d?.checkedAt && (
                <span style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', marginLeft: 'var(--space-3)' }}>
                  checked {formatDate(d.checkedAt)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Service Cards */}
        {status.loading ? (
          <LoadingState message="Checking service health..." />
        ) : status.error ? (
          <ErrorState message={status.error} onRetry={status.refetch} />
        ) : svcs.length === 0 ? (
          <EmptyState message="No services found" />
        ) : (
          <div style={styles.cardGrid}>
            {svcs.map(s => (
              <div
                key={s.service}
                style={{
                  ...styles.serviceCard,
                  borderColor: s.status === 'online'   ? 'var(--color-online)'
                             : s.status === 'degraded' ? 'var(--color-warning)'
                             : 'var(--color-critical)',
                }}
              >
                <div style={styles.cardTop}>
                  <span style={styles.svcIcon}>{SERVICE_ICONS[s.service] || '⚙️'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.svcName}>
                      {SERVICE_LABELS[s.service] || s.service}
                    </div>
                    <code style={styles.svcSlug}>{s.service}</code>
                  </div>
                  <StatusBadge status={s.status} />
                </div>

                <div style={styles.cardMetrics}>
                  <div style={styles.metric}>
                    <span style={styles.metricLabel}>Response Time</span>
                    <span style={styles.metricValue}>
                      {s.responseTimeMs != null ? `${s.responseTimeMs}ms` : '—'}
                    </span>
                  </div>
                  {s.error && (
                    <div style={styles.metric}>
                      <span style={styles.metricLabel}>Error</span>
                      <span style={{ ...styles.metricValue, color: 'var(--color-critical)', fontSize: 'var(--text-xs)' }}>
                        {s.error}
                      </span>
                    </div>
                  )}
                </div>

                <div style={{
                  height: '2px',
                  background: s.status === 'online'   ? 'var(--color-online)'
                            : s.status === 'degraded' ? 'var(--color-warning)'
                            : 'var(--color-critical)',
                  opacity: 0.4,
                  borderRadius: 'var(--radius-full)',
                  marginTop: 'var(--space-3)',
                }} />
              </div>
            ))}
          </div>
        )}

        {/* Gateway Health Panel */}
        <Panel title="Gateway Health" style={{ marginTop: 'var(--space-4)' }}>
          {health.loading ? (
            <LoadingState />
          ) : health.error ? (
            <ErrorState message={health.error} onRetry={health.refetch} />
          ) : health.data ? (
            <div style={styles.healthGrid}>
              <div style={styles.healthItem}>
                <span style={styles.healthLabel}>Database</span>
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: health.data.dbStatus === 'connected' ? 'var(--color-online)' : 'var(--color-critical)',
                }}>
                  {health.data.dbStatus}
                </span>
              </div>
              <div style={styles.healthItem}>
                <span style={styles.healthLabel}>Uptime</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                  {Math.floor(health.data.uptime)}s
                </span>
              </div>
              <div style={styles.healthItem}>
                <span style={styles.healthLabel}>Status</span>
                <StatusBadge status={health.data.status} />
              </div>
            </div>
          ) : null}
        </Panel>

      </div>
    </PageWrapper>
  );
}

const styles = {
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 'var(--space-4)',
  },
  serviceCard: {
    background: 'var(--color-surface)',
    border: '1px solid',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
  },
  cardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  svcIcon: { fontSize: '20px' },
  svcName: {
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text)',
    fontSize: 'var(--text-md)',
  },
  svcSlug: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
  },
  cardMetrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  },
  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
  },
  metricValue: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text)',
  },
  healthGrid: {
    display: 'flex',
    gap: 'var(--space-6)',
    flexWrap: 'wrap',
  },
  healthItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
  healthLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
  },
};
