/**
 * ForensicsPage — full redesign with design system.
 * All data preserved: attack summary, AI analysis, raw request, IP intel, attack chain.
 * Added: Generate Incident Report button (calls /api/gemini/report/:id)
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { getForensics, geminiReport } from '../services/api';
import { formatDate, formatConf, fmtJson, parseExplanation } from '../utils/format';
import Panel         from '../components/ui/Panel';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge   from '../components/ui/StatusBadge';
import LoadingState  from '../components/ui/LoadingState';
import ErrorState    from '../components/ui/ErrorState';
import PageWrapper   from '../components/layout/PageWrapper';

const IconBack = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

const IconReport = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
);

const IconSpinner = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function ForensicsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(() => getForensics(id), [id]);

  // Incident report state
  const [report,        setReport]        = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState(null);

  const handleGenerateReport = async () => {
    if (reportLoading) return;
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    try {
      const result = await geminiReport(id);
      setReport(result.report);
    } catch (err) {
      setReportError(err?.response?.data?.message || err.message || 'Report generation failed');
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) return <PageWrapper><div className="page-container"><LoadingState message="Loading forensic report..." /></div></PageWrapper>;
  if (error)   return <PageWrapper><div className="page-container"><ErrorState message={error} onRetry={refetch} /></div></PageWrapper>;
  if (!data)   return <PageWrapper><div className="page-container"><p style={{ color: 'var(--color-text-muted)' }}>No data.</p></div></PageWrapper>;

  const { attack, raw_request, ip_intel, attack_chain } = data;
  const exp = parseExplanation(attack?.explanation);

  return (
    <PageWrapper>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div className="page-container">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(-1)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}
            >
              <IconBack /> Back
            </button>
            <h1 className="page-title">Forensic Report</h1>
            <p className="page-subtitle" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
              {id}
            </p>
          </div>
          <div className="page-actions">
            {attack && <SeverityBadge severity={attack.severity} />}
            {attack && <StatusBadge   status={attack.status}    />}
            {/* Generate Incident Report button */}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleGenerateReport}
              disabled={reportLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
            >
              {reportLoading ? <IconSpinner /> : <IconReport />}
              {reportLoading ? 'Generating…' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div style={styles.grid}>

          {/* Attack Summary */}
          <Panel title="Attack Summary">
            <div style={styles.kv}>
              {[
                ['Type',         <span className="attack-tag">{attack?.attackType}</span>],
                ['Severity',     <SeverityBadge severity={attack?.severity} />],
                ['Status',       <StatusBadge   status={attack?.status}    />],
                ['Detected By',  attack?.detectedBy || '—'],
                ['Confidence',   formatConf(attack?.confidence)],
                ['Timestamp',    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>{formatDate(attack?.timestamp)}</span>],
                ['Payload',      <code style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{attack?.payload || '—'}</code>],
              ].map(([label, val]) => (
                <div key={label} style={styles.kvRow}>
                  <span style={styles.kvLabel}>{label}</span>
                  <span style={styles.kvVal}>{val}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* AI Analysis */}
          {(exp.summary || exp.what_happened || exp.potential_impact || exp.recommended_action) && (
            <Panel title="AI Analysis" style={{ borderLeft: '3px solid var(--color-accent)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {exp.summary && (
                  <div>
                    <span style={styles.aiLabel}>Summary</span>
                    <p style={styles.aiText}>{exp.summary}</p>
                  </div>
                )}
                {exp.what_happened && (
                  <div>
                    <span style={styles.aiLabel}>What Happened</span>
                    <p style={styles.aiText}>{exp.what_happened}</p>
                  </div>
                )}
                {exp.potential_impact && (
                  <div>
                    <span style={styles.aiLabel}>Potential Impact</span>
                    <p style={{ ...styles.aiText, color: 'var(--color-high)' }}>{exp.potential_impact}</p>
                  </div>
                )}
                {exp.recommended_action && (
                  <div>
                    <span style={styles.aiLabel}>Recommended Action</span>
                    <p style={{ ...styles.aiText, color: 'var(--color-online)' }}>{exp.recommended_action}</p>
                  </div>
                )}
                {exp.rule_triggered && (
                  <div>
                    <span style={styles.aiLabel}>Rule Triggered</span>
                    <code style={{ fontSize: 'var(--text-xs)', color: 'var(--color-code)' }}>{exp.rule_triggered}</code>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Raw Request */}
          <Panel title="Raw Request">
            {!raw_request ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No raw request data.</p>
            ) : (
              <div style={styles.kv}>
                {[
                  ['Method',       <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--weight-bold)', color: 'var(--color-accent)' }}>{raw_request.method}</span>],
                  ['URL',          <code style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all' }}>{raw_request.url}</code>],
                  ['IP',           <code className="ip-addr">{raw_request.ip}</code>],
                  ['Response Code',raw_request.responseCode ?? '—'],
                ].map(([label, val]) => (
                  <div key={label} style={styles.kvRow}>
                    <span style={styles.kvLabel}>{label}</span>
                    <span style={styles.kvVal}>{val}</span>
                  </div>
                ))}
                <div style={styles.preSection}>
                  <span style={styles.aiLabel}>Headers</span>
                  <pre style={styles.pre}>{fmtJson(raw_request.headers)}</pre>
                </div>
                <div style={styles.preSection}>
                  <span style={styles.aiLabel}>Query Params</span>
                  <pre style={styles.pre}>{fmtJson(raw_request.queryParams)}</pre>
                </div>
                <div style={styles.preSection}>
                  <span style={styles.aiLabel}>Body</span>
                  <pre style={styles.pre}>{fmtJson(raw_request.body)}</pre>
                </div>
              </div>
            )}
          </Panel>

          {/* IP Intelligence */}
          {ip_intel && (
            <Panel title="IP Intelligence">
              <div style={styles.kv}>
                {[
                  ['IP',              <code className="ip-addr">{ip_intel.ip}</code>],
                  ['Requests (24h)',  ip_intel.total_requests_24h],
                  ['Total Attacks',   <strong style={{ color: ip_intel.total_attacks_ever > 0 ? 'var(--color-critical)' : 'var(--color-online)' }}>{ip_intel.total_attacks_ever}</strong>],
                  ['First Attack',    ip_intel.first_attack ? formatDate(ip_intel.first_attack) : '—'],
                  ['Last Attack',     ip_intel.last_attack  ? formatDate(ip_intel.last_attack)  : '—'],
                  ['Types Seen',      ip_intel.attack_types_seen?.join(', ') || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={styles.kvRow}>
                    <span style={styles.kvLabel}>{label}</span>
                    <span style={styles.kvVal}>{val}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {/* Attack Chain */}
          <Panel title="Attack Chain" style={{ gridColumn: 'span 2' }}>
            <p style={{ marginBottom: 'var(--space-3)' }}>
              <span style={styles.kvLabel}>Pattern: </span>
              <strong style={{ color: 'var(--color-text)' }}>{attack_chain?.pattern_label || '—'}</strong>
            </p>
            {(!attack_chain?.timeline?.length) ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Single isolated request.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr><th>Time</th><th>Method</th><th>URL</th><th>Code</th></tr>
                  </thead>
                  <tbody>
                    {attack_chain.timeline.map((t, i) => (
                      <tr key={i}>
                        <td style={styles.cellMono}>{formatDate(t.time)}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-accent)' }}>{t.method}</td>
                        <td><code style={{ fontSize: 'var(--text-xs)' }}>{t.url}</code></td>
                        <td style={styles.cellMono}>{t.code ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          {/* ── Gemini Incident Report ── */}
          {reportError && (
            <Panel title="Incident Report" style={{ gridColumn: 'span 2', borderLeft: '3px solid var(--color-critical)' }}>
              <p style={{ color: 'var(--color-critical)', fontSize: 'var(--text-sm)' }}>{reportError}</p>
            </Panel>
          )}

          {report && (
            <Panel
              title={`Incident Report${report.generated ? ' · AI Generated' : ' · Static'}`}
              style={{ gridColumn: 'span 2', borderLeft: '3px solid var(--color-accent)' }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                {/* Risk level badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <span style={styles.aiLabel}>Risk Level</span>
                  <SeverityBadge severity={report.risk_level} />
                  {report.generated_at && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      Generated {new Date(report.generated_at).toLocaleTimeString()}
                    </span>
                  )}
                </div>

                {report.executive_summary && (
                  <div>
                    <span style={styles.aiLabel}>Executive Summary</span>
                    <p style={styles.aiText}>{report.executive_summary}</p>
                  </div>
                )}

                {report.technical_finding && (
                  <div>
                    <span style={styles.aiLabel}>Technical Finding</span>
                    <p style={styles.aiText}>{report.technical_finding}</p>
                  </div>
                )}

                {report.likely_impact && (
                  <div>
                    <span style={styles.aiLabel}>Likely Impact</span>
                    <p style={{ ...styles.aiText, color: 'var(--color-high)' }}>{report.likely_impact}</p>
                  </div>
                )}

                {report.remediation_steps?.length > 0 && (
                  <div>
                    <span style={styles.aiLabel}>Remediation Steps</span>
                    <ol style={{ paddingLeft: 'var(--space-5)', margin: 0 }}>
                      {report.remediation_steps.map((step, i) => (
                        <li key={i} style={{ ...styles.aiText, marginBottom: 'var(--space-1)' }}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {report.next_steps && (
                  <div>
                    <span style={styles.aiLabel}>Next Steps</span>
                    <p style={{ ...styles.aiText, color: 'var(--color-online)' }}>{report.next_steps}</p>
                  </div>
                )}
              </div>
            </Panel>
          )}

        </div>
      </div>
    </PageWrapper>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
  },
  kv: { display: 'flex', flexDirection: 'column', gap: 0 },
  kvRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) 0',
    borderBottom: '1px solid var(--color-border)',
  },
  kvLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
    flexShrink: 0,
    minWidth: '120px',
  },
  kvVal: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
    flex: 1,
    minWidth: 0,
  },
  aiLabel: {
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
    display: 'block',
    marginBottom: 'var(--space-1)',
  },
  aiText: {
    fontSize: 'var(--text-base)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--leading-relaxed)',
    margin: 0,
  },
  preSection: { marginTop: 'var(--space-3)' },
  pre: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-code)',
    background: 'var(--color-code-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-2) var(--space-3)',
    margin: 0,
    overflowX: 'auto',
    maxHeight: '180px',
  },
  cellMono: {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-secondary)',
    whiteSpace: 'nowrap',
  },
};
