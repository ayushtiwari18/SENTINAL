/**
 * CorrelationPage.jsx — Attack Correlation Engine
 * Calls POST /api/gemini/correlate, renders campaign cards,
 * shared infrastructure table, attack chains, and risk score.
 */
import { useState, useCallback } from 'react';
import PageWrapper  from '../components/layout/PageWrapper';
import Panel        from '../components/ui/Panel';
import { geminiCorrelate } from '../services/api';

const SEV_COLOR = {
  critical: 'var(--color-critical)',
  high:     'var(--color-high)',
  medium:   'var(--color-medium)',
  low:      'var(--color-low)',
};

const RISK_LABEL = (score) => {
  if (score >= 80) return { label: 'CRITICAL', color: 'var(--color-critical)' };
  if (score >= 60) return { label: 'HIGH',     color: 'var(--color-high)' };
  if (score >= 40) return { label: 'MEDIUM',   color: 'var(--color-medium)' };
  return               { label: 'LOW',      color: 'var(--color-low)' };
};

export default function CorrelationPage() {
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [copilotQ, setCopilotQ] = useState(null); // deep-link to copilot

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await geminiCorrelate();
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Correlation analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const askCopilot = (campaign) => {
    const q = `Tell me more about the campaign "${campaign.name}" involving IPs ${campaign.sourceIps.join(', ')} using ${campaign.attackTypes.join(', ')} attacks.`;
    setCopilotQ(q);
    // Copy to clipboard so analyst can paste into Co-Pilot tab
    try { navigator.clipboard.writeText(q); } catch {}
  };

  const risk = result ? RISK_LABEL(result.riskScore || 0) : null;

  return (
    <PageWrapper>
      <div className="page-container">

        {/* Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">🕰 Attack Correlation Engine</h1>
            <p className="page-subtitle">
              Gemini analyses up to 200 recent attacks to identify coordinated campaigns,
              shared attacker infrastructure, and multi-stage attack chains.
            </p>
          </div>
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={runAnalysis}
              disabled={loading}
              style={{ minWidth: 180 }}
            >
              {loading ? '⏳ Analysing…' : '🧠 Run Correlation'}
            </button>
          </div>
        </div>

        {/* Clipboard hint */}
        {copilotQ && (
          <div style={styles.hint}>
            ✅ Question copied to clipboard — paste it in the <strong>AI Copilot</strong> tab for deeper analysis.
            <button style={styles.hintClose} onClick={() => setCopilotQ(null)}>dismiss</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* Initial empty state */}
        {!loading && !result && !error && (
          <Panel>
            <div style={styles.emptyState}>
              <span style={{ fontSize: 48 }}>🕰</span>
              <h3 style={{ color: 'var(--color-text)', margin: 'var(--space-3) 0 var(--space-2)' }}>
                No analysis yet
              </h3>
              <p style={{ color: 'var(--color-text-muted)', maxWidth: 400, textAlign: 'center' }}>
                Click <strong>Run Correlation</strong> to have Gemini analyse your attack telemetry
                for coordinated campaigns and shared attacker infrastructure.
              </p>
            </div>
          </Panel>
        )}

        {/* Loading state */}
        {loading && (
          <Panel>
            <div style={styles.emptyState}>
              <div style={styles.spinner} />
              <p style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-4)' }}>
                Gemini is correlating your attack data… this may take 10–30 seconds.
              </p>
            </div>
          </Panel>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Risk Score Banner */}
            <div style={{ ...styles.riskBanner, borderColor: risk.color }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Overall Risk Score</div>
                <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', color: risk.color, lineHeight: 1.1 }}>
                  {result.riskScore}<span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>/100</span>
                </div>
              </div>
              <div style={{ ...styles.riskLabel, background: risk.color }}>{risk.label}</div>
              <div style={{ flex: 1, color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                {result.summary}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)' }}>
                {result.generated ? '🧠 Gemini·grounded' : '📊 Static analysis'} · {result.attackCount} events
              </div>
            </div>

            {/* Campaigns */}
            <Panel title={`🎯 Detected Campaigns (${result.campaigns?.length || 0})`}>
              {(!result.campaigns || result.campaigns.length === 0) ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  No distinct campaigns detected in current data.
                </p>
              ) : (
                <div style={styles.campaignGrid}>
                  {result.campaigns.map((c, i) => (
                    <div key={i} style={{ ...styles.campaignCard, borderTopColor: SEV_COLOR[c.severity] || 'var(--color-border)' }}>
                      <div style={styles.campaignHeader}>
                        <span style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-base)', color: 'var(--color-text)' }}>{c.name}</span>
                        <span style={{ ...styles.sevBadge, background: SEV_COLOR[c.severity] || 'var(--color-border)' }}>{c.severity}</span>
                      </div>
                      <div style={styles.campaignMeta}>
                        <span>📍 {c.sourceIps?.join(', ') || '—'}</span>
                        <span>⚡ {c.attackTypes?.join(', ') || '—'}</span>
                        <span>📊 {c.eventCount || '?'} events</span>
                      </div>
                      {c.firstSeen && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', marginBottom: 'var(--space-2)' }}>
                          {new Date(c.firstSeen).toLocaleString()} → {c.lastSeen ? new Date(c.lastSeen).toLocaleString() : 'ongoing'}
                        </div>
                      )}
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 var(--space-3)' }}>
                        {c.assessment}
                      </p>
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
                        onClick={() => askCopilot(c)}
                      >
                        💬 Ask Co-Pilot about this campaign
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Shared Infrastructure */}
            {result.sharedInfrastructure?.length > 0 && (
              <Panel title="🌐 Shared Infrastructure">
                {result.sharedInfrastructure.map((s, i) => (
                  <div key={i} style={styles.infraItem}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-high)' }}>
                      {s.ips?.join(' — ')}
                    </span>
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 'var(--space-4)' }}>
                      {s.evidence}
                    </span>
                  </div>
                ))}
              </Panel>
            )}

            {/* Attack Chains */}
            {result.attackChains?.length > 0 && (
              <Panel title="⛓️ Attack Chains">
                {result.attackChains.map((chain, i) => (
                  <div key={i} style={styles.chainItem}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                      {chain.sequence?.map((step, j) => (
                        <span key={j} style={styles.chainStep}>
                          {j > 0 && <span style={{ color: 'var(--color-text-faint)', margin: '0 var(--space-1)' }}>→</span>}
                          {step}
                        </span>
                      ))}
                    </div>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', margin: 0 }}>{chain.description}</p>
                  </div>
                ))}
              </Panel>
            )}
          </>
        )}

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </PageWrapper>
  );
}

const styles = {
  hint: {
    padding: 'var(--space-3) var(--space-4)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-online)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text)',
    marginBottom: 'var(--space-4)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
  },
  hintClose: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: 'var(--text-xs)',
  },
  errorBox: {
    padding: 'var(--space-4)',
    background: 'var(--color-critical-dim)',
    border: '1px solid var(--color-critical)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-critical)',
    fontSize: 'var(--text-sm)',
    marginBottom: 'var(--space-4)',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'var(--space-16) var(--space-8)',
  },
  spinner: {
    width: 40,
    height: 40,
    border: '3px solid var(--color-border)',
    borderTopColor: 'var(--color-primary)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  riskBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-6)',
    padding: 'var(--space-5) var(--space-6)',
    background: 'var(--color-surface)',
    border: '2px solid',
    borderRadius: 'var(--radius-lg)',
    marginBottom: 'var(--space-4)',
    flexWrap: 'wrap',
  },
  riskLabel: {
    padding: 'var(--space-2) var(--space-4)',
    borderRadius: 'var(--radius-full)',
    color: '#000',
    fontWeight: 'var(--weight-bold)',
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.1em',
    whiteSpace: 'nowrap',
  },
  campaignGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 'var(--space-3)',
  },
  campaignCard: {
    padding: 'var(--space-4)',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderTop: '3px solid',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
  },
  campaignHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 'var(--space-2)',
  },
  campaignMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  sevBadge: {
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    color: '#000',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  },
  infraItem: {
    padding: 'var(--space-3)',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-2)',
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
  },
  chainItem: {
    padding: 'var(--space-3)',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-md)',
    marginBottom: 'var(--space-2)',
  },
  chainStep: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    background: 'var(--color-surface-offset)',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-text)',
  },
};
