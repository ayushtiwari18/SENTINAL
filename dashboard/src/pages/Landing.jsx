/**
 * Landing — SENTINAL public-facing hero page.
 * Full redesign: hero, live stats strip, recent attacks, feature grid.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useApi }      from '../hooks/useApi';
import { getStats, getRecentAttacks } from '../services/api';
import { formatDateShort } from '../utils/format';
import SeverityBadge from '../components/ui/SeverityBadge';
import StatusBadge   from '../components/ui/StatusBadge';
import LoadingState  from '../components/ui/LoadingState';

// SVG icons
const IconShield  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IconZap     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconEye     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
const IconCpu     = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>;
const IconFile    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>;
const IconList    = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>;
const IconArrow   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;

const FEATURES = [
  {
    icon: <IconZap />,
    title: 'Real-Time Detection',
    desc: 'Rule-based + ML engine detects SQLi, XSS, SSRF, command injection and 8 more attack vectors as they happen.',
  },
  {
    icon: <IconShield />,
    title: 'Nexus Auto-Response',
    desc: 'AI agent blocks threats automatically. Human-in-the-loop approval queue ensures zero false-positive actions.',
  },
  {
    icon: <IconEye />,
    title: 'Deep Forensics',
    desc: 'Full request reconstruction, IP intelligence, attack chain timelines, and LLM-generated incident summaries.',
  },
  {
    icon: <IconCpu />,
    title: 'PCAP Analysis',
    desc: 'Upload raw network captures. The PCAP processor extracts flows and surfaces anomalies automatically.',
  },
  {
    icon: <IconFile />,
    title: 'Audit Trail',
    desc: 'Immutable, timestamped log of every automated and manual action taken by Nexus. Compliance-ready.',
  },
  {
    icon: <IconList />,
    title: 'Socket.io Live Feed',
    desc: 'All 14 dashboard pages update in real time via persistent WebSocket — zero polling latency on critical events.',
  },
];

export default function Landing() {
  const stats   = useApi(getStats);
  const attacks = useApi(() => getRecentAttacks(5));

  return (
    <div style={styles.page}>

      {/* ── Navbar-style top bar ─────────────────────────────────────── */}
      <header style={styles.header}>
        <span style={styles.headerBrand}>
          <IconShield />
          <span style={styles.headerBrandText}>SENTINAL</span>
        </span>
        <Link to="/dashboard" className="btn btn-primary btn-sm">
          Open Dashboard <IconArrow />
        </Link>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section style={styles.hero}>
        <div style={styles.heroGlow} />
        <div style={styles.heroContent}>
          <span style={styles.heroEyebrow}>
            <span className="live-indicator">LIVE</span>
            AI-Powered Web Security
          </span>
          <h1 style={styles.heroHeadline}>
            Detect. Respond.
            <br />
            <span style={styles.heroAccent}>Defend.</span>
          </h1>
          <p style={styles.heroSub}>
            SENTINAL is a production-grade, multi-service cybersecurity system.
            Real-time attack detection, automated response, forensics, and PCAP
            analysis — all in one operational command center.
          </p>
          <div style={styles.heroActions}>
            <Link to="/dashboard" className="btn btn-primary">
              Open Dashboard <IconArrow />
            </Link>
            <Link to="/simulate" className="btn" style={styles.heroBtnSimulate}>
              ⚔ Simulate Attack
            </Link>
          </div>
        </div>
      </section>

      {/* ── Live Stats Strip ─────────────────────────────────────────── */}
      <section style={styles.statsStrip}>
        {stats.loading ? (
          <LoadingState message="Loading stats..." />
        ) : stats.data ? (
          <>
            <div style={styles.statItem}>
              <span style={styles.statNum}>{(stats.data.totalAttacks || 0).toLocaleString()}</span>
              <span style={styles.statLabel}>Total Attacks Detected</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={styles.statNum}>{(stats.data.totalLogs || 0).toLocaleString()}</span>
              <span style={styles.statLabel}>Log Entries</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={{ ...styles.statNum, color: stats.data.criticalAlerts > 0 ? 'var(--color-critical)' : 'var(--color-online)' }}>
                {stats.data.criticalAlerts || 0}
              </span>
              <span style={styles.statLabel}>Critical Alerts Active</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.statItem}>
              <span style={{ ...styles.statNum, color: 'var(--color-accent)' }}>11</span>
              <span style={styles.statLabel}>Attack Vectors Monitored</span>
            </div>
          </>
        ) : null}
      </section>

      {/* ── Features Grid ────────────────────────────────────────────── */}
      <section style={styles.section}>
        <div style={styles.sectionInner}>
          <h2 style={styles.sectionTitle}>Platform Capabilities</h2>
          <p style={styles.sectionSub}>Everything you need to operate a security-first infrastructure.</p>
          <div style={styles.featGrid}>
            {FEATURES.map((f, i) => (
              <div key={i} style={styles.featCard}>
                <span style={styles.featIcon}>{f.icon}</span>
                <h3 style={styles.featTitle}>{f.title}</h3>
                <p style={styles.featDesc}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live Attack Feed ─────────────────────────────────────────── */}
      <section style={{ ...styles.section, background: 'var(--color-surface)' }}>
        <div style={styles.sectionInner}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Live Attack Feed</h2>
              <p style={styles.sectionSub}>Last 5 attacks detected by SENTINAL.</p>
            </div>
            <Link to="/attacks" className="btn">
              View All <IconArrow />
            </Link>
          </div>
          {attacks.loading ? (
            <LoadingState message="Fetching live feed..." />
          ) : (attacks.data || []).length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-base)' }}>No attacks recorded yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source IP</th>
                    <th>Attack Type</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(attacks.data || []).map(a => (
                    <tr key={a._id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                        {formatDateShort(a.createdAt)}
                      </td>
                      <td><code className="ip-addr">{a.ip}</code></td>
                      <td><span className="attack-tag">{a.attackType}</span></td>
                      <td><SeverityBadge severity={a.severity} /></td>
                      <td><StatusBadge  status={a.status}    /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section style={styles.cta}>
        <h2 style={styles.ctaTitle}>Your system is being monitored.</h2>
        <p style={styles.ctaSub}>Enter the command center and take control.</p>
        <Link to="/dashboard" className="btn btn-primary">
          Open Dashboard <IconArrow />
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer style={styles.footer}>
        <span style={{ color: 'var(--color-accent)', fontWeight: 'var(--weight-semibold)', letterSpacing: 'var(--tracking-widest)', fontFamily: 'var(--font-mono)' }}>SENTINAL</span>
        <span style={{ color: 'var(--color-text-muted)' }}>© 2026 — Built for HackByte 4.0</span>
        <a href="https://github.com/ayushtiwari18/SENTINAL" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>GitHub</a>
      </footer>

    </div>
  );
}

const styles = {
  page: {
    background: 'var(--color-bg)',
    minHeight: '100vh',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-sans)',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 'var(--space-3) var(--space-6)',
    background: 'rgba(10,10,10,0.92)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--color-border)',
    height: 'var(--navbar-height)',
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    color: 'var(--color-accent)',
  },
  headerBrandText: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-bold)',
    fontSize: 'var(--text-base)',
    letterSpacing: 'var(--tracking-widest)',
    color: 'var(--color-accent)',
  },
  hero: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '520px',
    padding: 'var(--space-8) var(--space-5)',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: '-120px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '700px',
    height: '400px',
    background: 'radial-gradient(ellipse at center, rgba(0,212,170,0.07) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  heroContent: {
    position: 'relative',
    maxWidth: '720px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-4)',
  },
  heroEyebrow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-secondary)',
    letterSpacing: 'var(--tracking-wide)',
    textTransform: 'uppercase',
  },
  heroHeadline: {
    fontSize: 'clamp(36px, 6vw, 64px)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--color-text)',
    lineHeight: 'var(--leading-tight)',
    letterSpacing: 'var(--tracking-tight)',
  },
  heroAccent: {
    color: 'var(--color-accent)',
  },
  heroSub: {
    fontSize: 'var(--text-lg)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--leading-relaxed)',
    maxWidth: '560px',
  },
  heroActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 'var(--space-2)',
  },
  heroBtnSimulate: {
    color: 'var(--color-critical)',
    borderColor: 'var(--color-critical)',
  },
  statsStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--space-5)',
    padding: 'var(--space-5) var(--space-6)',
    borderTop: '1px solid var(--color-border)',
    borderBottom: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    flexWrap: 'wrap',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1)',
  },
  statNum: {
    fontSize: 'var(--text-2xl)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-mono)',
    fontVariantNumeric: 'tabular-nums',
  },
  statLabel: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 'var(--tracking-widest)',
  },
  statDivider: {
    width: '1px',
    height: '32px',
    background: 'var(--color-border-strong)',
  },
  section: {
    padding: 'var(--space-8) var(--space-5)',
  },
  sectionInner: {
    maxWidth: 'var(--page-max-width)',
    margin: '0 auto',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-5)',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
  },
  sectionTitle: {
    fontSize: 'var(--text-xl)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text)',
    letterSpacing: 'var(--tracking-tight)',
    marginBottom: 'var(--space-2)',
  },
  sectionSub: {
    fontSize: 'var(--text-md)',
    color: 'var(--color-text-secondary)',
  },
  featGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 'var(--space-4)',
    marginTop: 'var(--space-5)',
  },
  featCard: {
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-5)',
    background: 'var(--color-surface)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    transition: 'border-color 150ms ease',
  },
  featIcon: {
    color: 'var(--color-accent)',
    display: 'flex',
    alignItems: 'center',
  },
  featTitle: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-semibold)',
    color: 'var(--color-text)',
  },
  featDesc: {
    fontSize: 'var(--text-base)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--leading-relaxed)',
  },
  cta: {
    padding: 'var(--space-8) var(--space-5)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-4)',
    textAlign: 'center',
    borderTop: '1px solid var(--color-border)',
  },
  ctaTitle: {
    fontSize: 'clamp(22px, 4vw, 36px)',
    fontWeight: 'var(--weight-bold)',
    color: 'var(--color-text)',
    letterSpacing: 'var(--tracking-tight)',
  },
  ctaSub: {
    fontSize: 'var(--text-lg)',
    color: 'var(--color-text-secondary)',
  },
  footer: {
    padding: 'var(--space-4) var(--space-6)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    fontSize: 'var(--text-sm)',
  },
};
