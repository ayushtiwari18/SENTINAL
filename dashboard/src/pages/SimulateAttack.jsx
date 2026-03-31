/**
 * SimulateAttack — redesigned with design system tokens.
 * All attack definitions, socket listeners, fire logic preserved.
 */
import { useState, useCallback } from 'react';
import { useSocket }  from '../hooks/useSocket';
import Panel          from '../components/ui/Panel';
import PageWrapper    from '../components/layout/PageWrapper';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ATTACKS = [
  {
    id: 'sqli', label: 'SQL Injection', icon: '💉',
    description: "Injects 'admin' OR '1'='1' into /login body",
    color: 'var(--color-critical)', severity: 'high',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target', method: 'POST', url: '/login',
      ip: '203.0.113.10', headers: { 'content-type': 'application/json' },
      queryParams: {}, body: { username: "admin' OR '1'='1' --", password: 'anything' },
    },
  },
  {
    id: 'xss', label: 'XSS Attack', icon: '⚡',
    description: 'Injects <script>alert(document.cookie)</script> into /search',
    color: 'var(--color-high)', severity: 'medium',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target', method: 'GET',
      url: '/search?q=<script>alert(document.cookie)</script>',
      ip: '203.0.113.11', headers: {}, queryParams: { q: '<script>alert(document.cookie)</script>' }, body: {},
    },
  },
  {
    id: 'traversal', label: 'Path Traversal', icon: '📁',
    description: 'Attempts /../../../etc/passwd via /file endpoint',
    color: 'var(--color-medium)', severity: 'high',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target', method: 'GET', url: '/file?name=/../../../etc/passwd',
      ip: '203.0.113.12', headers: {}, queryParams: { name: '/../../../etc/passwd' }, body: {},
    },
  },
  {
    id: 'cmdinject', label: 'Command Injection', icon: '💻',
    description: 'Sends ; cat /etc/shadow payload to /search',
    color: '#7c3aed', severity: 'critical',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target', method: 'GET', url: '/search?q=hello; cat /etc/shadow',
      ip: '203.0.113.13', headers: {}, queryParams: { q: 'hello; cat /etc/shadow' }, body: {},
    },
  },
  {
    id: 'bruteforce', label: 'Brute Force (CRITICAL)', icon: '🔨',
    description: 'Critical-severity brute force → triggers BLOCK + Action Queue',
    color: 'var(--color-critical)', severity: 'critical',
    endpoint: '/api/armoriq/trigger',
    payload: { ip: '203.0.113.99', attackType: 'brute_force', severity: 'critical', confidence: 0.97, status: 'successful' },
  },
];

const SEV_COLOR = {
  low: 'var(--color-low)', medium: 'var(--color-medium)',
  high: 'var(--color-high)', critical: 'var(--color-critical)',
};

export default function SimulateAttack() {
  const [log,        setLog]   = useState([]);
  const [firing,     setFiring] = useState({});
  const [waveActive, setWave]  = useState(false);
  const [liveEvents, setLive]  = useState([]);

  // broadcastService wraps every socket event as: { event, timestamp, data: { ... } }
  // Must unwrap .data before reading fields.
  useSocket('attack:new', useCallback((payload) => {
    const d = payload?.data ?? payload;   // support both wrapped and bare
    setLive(prev => [{
      id:       d.id       || Date.now(),
      type:     d.attackType || 'unknown',
      ip:       d.ip       || '—',
      severity: d.severity || 'low',
      time:     new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));
  }, []));

  useSocket('action:pending', useCallback((payload) => {
    const d = payload?.data ?? payload;   // support both wrapped and bare
    setLive(prev => [{
      id:       d.id       || Date.now(),
      type:     `🔒 BLOCKED: ${d.action || 'action'}`,
      ip:       d.ip       || '—',
      severity: 'critical',
      time:     new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));
  }, []));

  const fire = async (attack) => {
    setFiring(f => ({ ...f, [attack.id]: true }));
    const entry = { id: Date.now(), label: attack.label, time: new Date().toLocaleTimeString(), status: 'pending' };
    setLog(prev => [entry, ...prev]);
    try {
      const res  = await fetch(`${API}${attack.endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attack.payload),
      });
      const data = await res.json();
      setLog(prev => prev.map(l => l.id === entry.id
        ? { ...l, status: data.success ? 'ok' : 'error', detail: data.success ? '✅ Sent — watch dashboard' : '❌ ' + data.message }
        : l
      ));
    } catch (e) {
      setLog(prev => prev.map(l => l.id === entry.id
        ? { ...l, status: 'error', detail: '❌ Network error' }
        : l
      ));
    } finally {
      setFiring(f => ({ ...f, [attack.id]: false }));
    }
  };

  const fireWave = async () => {
    setWave(true);
    for (let i = 0; i < ATTACKS.length; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 0 : 1200));
      fire(ATTACKS[i]);
    }
    setTimeout(() => setWave(false), ATTACKS.length * 1200 + 1000);
  };

  return (
    <PageWrapper>
      <div className="page-container">

        {/* Page Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">⚔ Attack Simulator</h1>
            <p className="page-subtitle">
              Fire controlled attack payloads directly at SENTINAL. Watch the dashboard react in real time.
            </p>
          </div>
          <div className="page-actions">
            <span className="live-indicator">LIVE</span>
          </div>
        </div>

        {/* Attack Grid */}
        <div style={styles.attackGrid}>
          {ATTACKS.map(attack => (
            <button
              key={attack.id}
              onClick={() => fire(attack)}
              disabled={firing[attack.id] || waveActive}
              style={{
                ...styles.attackBtn,
                borderColor: attack.color,
                background: firing[attack.id]
                  ? 'var(--color-surface)'
                  : `linear-gradient(135deg, ${attack.color}22, transparent)`,
                opacity: (firing[attack.id] || waveActive) ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: '26px' }}>{attack.icon}</span>
              <span style={styles.btnLabel}>{attack.label}</span>
              <span style={{ ...styles.sevBadge, background: SEV_COLOR[attack.severity] }}>
                {attack.severity}
              </span>
              <span style={styles.btnDesc}>{attack.description}</span>
              {firing[attack.id] && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
                  ⟳ Sending...
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Wave Button */}
        <button
          onClick={fireWave}
          disabled={waveActive}
          className="btn btn-danger"
          style={{
            width: '100%',
            padding: 'var(--space-5)',
            fontSize: 'var(--text-lg)',
            fontWeight: 'var(--weight-bold)',
            marginBottom: 'var(--space-5)',
            letterSpacing: 'var(--tracking-wide)',
            opacity: waveActive ? 0.7 : 1,
            animation: waveActive ? 'pulse 1s infinite' : 'none',
          }}
        >
          {waveActive ? '🚨 ATTACK WAVE IN PROGRESS...' : '🚨 LAUNCH FULL ATTACK WAVE'}
        </button>

        {/* Sent log + live feed */}
        <div style={styles.columns}>
          <Panel title="Attacks Sent">
            {log.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                No attacks fired yet. Click a button above.
              </p>
            ) : log.map(l => (
              <div key={l.id} style={{
                ...styles.logItem,
                borderLeftColor: l.status === 'ok' ? 'var(--color-online)' : l.status === 'error' ? 'var(--color-critical)' : 'var(--color-border-strong)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{l.time}</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>{l.label}</span>
                {l.detail && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>{l.detail}</span>}
              </div>
            ))}
          </Panel>

          <Panel title="Live Detections (Socket)">
            {liveEvents.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', fontStyle: 'italic' }}>
                Waiting for detections...
              </p>
            ) : liveEvents.map(e => (
              <div key={e.id} style={{
                ...styles.logItem,
                borderLeftColor: SEV_COLOR[e.severity] || 'var(--color-border-strong)',
                animation: 'fadeIn 300ms ease',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{e.time}</span>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: SEV_COLOR[e.severity] || 'var(--color-text)' }}>{e.type}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>from {e.ip}</span>
              </div>
            ))}
          </Panel>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        `}</style>

      </div>
    </PageWrapper>
  );
}

const styles = {
  attackGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-4)',
  },
  attackBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-4) var(--space-5)',
    border: '1px solid',
    borderRadius: 'var(--radius-lg)',
    cursor: 'pointer',
    color: 'var(--color-text)',
    textAlign: 'left',
    transition: 'all 150ms ease',
    fontFamily: 'var(--font-sans)',
  },
  btnLabel: {
    fontSize: 'var(--text-lg)',
    fontWeight: 'var(--weight-bold)',
  },
  sevBadge: {
    display: 'inline-block',
    padding: '2px 10px',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    color: '#000',
    textTransform: 'uppercase',
    width: 'fit-content',
  },
  btnDesc: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-text-secondary)',
    lineHeight: 'var(--leading-relaxed)',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-4)',
  },
  logItem: {
    padding: 'var(--space-3)',
    marginBottom: 'var(--space-2)',
    background: 'var(--color-bg)',
    borderRadius: 'var(--radius-md)',
    borderLeft: '3px solid',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-1)',
  },
};
