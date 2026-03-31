/**
 * CorrelationPage.jsx — Attack Correlation Engine
 *
 * Improvements over previous version:
 *   1. “Ask Co-Pilot” now navigates directly to /copilot with the campaign
 *      question pre-filled via React Router location.state — no clipboard copy.
 *   2. Risk score history sparkline loaded from /api/gemini/correlate/history
 *      and rendered as a pure SVG line chart in the header.
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageWrapper  from '../components/layout/PageWrapper';
import Panel        from '../components/ui/Panel';
import { geminiCorrelate, geminiCorrelateHistory } from '../services/api';

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

// ── Pure-SVG risk score sparkline ───────────────────────────────────────────
function RiskSparkline({ history }) {
  if (!history || history.length < 2) {
    return (
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-faint)', alignSelf: 'center' }}>
        No history yet
      </div>
    );
  }

  const W = 200, H = 48, PAD = 4;
  const scores = history.map(h => h.riskScore ?? 0);
  const minS = Math.max(0,  Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const range = maxS - minS || 1;

  const pts = scores.map((s, i) => {
    const x = PAD + (i / (scores.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((s - minS) / range) * (H - PAD * 2);
    return `${x},${y}`;
  });

  const latest = scores[scores.length - 1];
  const { color } = RISK_LABEL(latest);
  // resolve CSS var to a safe fallback for SVG stroke
  const strokeColor = color.startsWith('var(') ? '#e85d4a' : color;

  const lastX = PAD + (W - PAD * 2);
  const lastY = H - PAD - ((latest - minS) / range) * (H - PAD * 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
        Risk history ({history.length} runs)
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
        {/* Area fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor={strokeColor} stopOpacity="0.18" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline
          points={`${PAD},${H} ${pts.join(' ')} ${lastX},${H}`}
          fill="url(#sparkGrad)" stroke="none"
        />
        {/* Line */}
        <polyline
          points={pts.join(' ')}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* Latest point dot */}
        <circle cx={lastX} cy={lastY} r={3} fill={strokeColor} />
        {/* Latest score label */}
        <text
          x={lastX + 5} y={lastY + 4}
          fontSize="9" fill={strokeColor}
          fontWeight="bold" fontFamily="monospace"
        >{latest}</text>
      </svg>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CorrelationPage() {
  const navigate = useNavigate();

  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [riskHistory, setRiskHistory] = useState([]);

  // Load risk score history on mount
  useEffect(() => {
    geminiCorrelateHistory()
      .then(data => setRiskHistory(Array.isArray(data) ? data : []))
      .catch(() => {}); // silent — sparkline is enhancement only
  }, []);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await geminiCorrelate();
      setResult(data);
      // Refresh history after a new run so sparkline includes latest score
      geminiCorrelateHistory()
        .then(h => setRiskHistory(Array.isArray(h) ? h : []))
        .catch(() => {});
    } catch (err) {
      setError(err?.response?.data?.message || 'Correlation analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Navigate to /copilot with the campaign question pre-filled via router state
  const askCopilot = (campaign) => {
    const q = `Tell me more about the campaign "${campaign.name}" involving IPs ${campaign.sourceIps?.join(', ')} using ${campaign.attackTypes?.join(', ')} attacks.`;
    navigate('/copilot', { state: { prefillQuestion: q } });
  };

  const risk = result ? RISK_LABEL(result.riskScore || 0) : null;

  return (
    <PageWrapper>
      <div className="page-container">

        {/* Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">⏰ Attack Correlation Engine</h1>
            <p className="page-subtitle">
              Gemini analyses up to 200 recent attacks to identify coordinated campaigns,
              shared attacker infrastructure, and multi-stage attack chains.
            </p>
          </div>
          <div className="page-actions" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-5)' }}>
            {/* Risk history sparkline */}
            <RiskSparkline history={riskHistory} />
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

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {/* Initial empty state */}
        {!loading && !result && !error && (
          <Panel>
            <div style={styles.emptyState}>
              <span style={{ fontSize: 48 }}>⏰</span>
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
                      {/* Deep-link to Co-Pilot — navigates directly, no clipboard paste needed */}
                      <button
                        className="btn btn-ghost"
                        style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-3)' }}
                        onClick={() => askCopilot(c)}
                      >
                        💬 Ask Co-Pilot about this campaign →
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
