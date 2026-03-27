/**
 * SimulateAttack.jsx
 * ------------------
 * One-click attack simulator for live demos.
 * Fires real payloads to the SENTINAL Gateway — no curl, no Postman.
 * Uses the demo-target routes (/login, /search, /file) via the Gateway ingest API.
 */
import { useState, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Attack definitions ────────────────────────────────────────────────────────
const ATTACKS = [
  {
    id: 'sqli',
    label: 'SQL Injection',
    icon: '💉',
    description: "Injects 'admin' OR '1'='1' into /login body",
    color: '#dc2626',
    severity: 'high',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target',
      method: 'POST',
      url: '/login',
      ip: '203.0.113.10',
      headers: { 'content-type': 'application/json' },
      queryParams: {},
      body: { username: "admin' OR '1'='1' --", password: 'anything' },
    },
  },
  {
    id: 'xss',
    label: 'XSS Attack',
    icon: '⚡',
    description: 'Injects <script>alert(document.cookie)</script> into /search',
    color: '#ea580c',
    severity: 'medium',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target',
      method: 'GET',
      url: '/search?q=<script>alert(document.cookie)</script>',
      ip: '203.0.113.11',
      headers: {},
      queryParams: { q: '<script>alert(document.cookie)</script>' },
      body: {},
    },
  },
  {
    id: 'traversal',
    label: 'Path Traversal',
    icon: '📁',
    description: 'Attempts /../../../etc/passwd via /file endpoint',
    color: '#ca8a04',
    severity: 'high',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target',
      method: 'GET',
      url: '/file?name=/../../../etc/passwd',
      ip: '203.0.113.12',
      headers: {},
      queryParams: { name: '/../../../etc/passwd' },
      body: {},
    },
  },
  {
    id: 'cmdinject',
    label: 'Command Injection',
    icon: '💻',
    description: 'Sends ; cat /etc/shadow payload to /search',
    color: '#7c3aed',
    severity: 'critical',
    endpoint: '/api/logs/ingest',
    payload: {
      projectId: 'demo-target',
      method: 'GET',
      url: '/search?q=hello; cat /etc/shadow',
      ip: '203.0.113.13',
      headers: {},
      queryParams: { q: 'hello; cat /etc/shadow' },
      body: {},
    },
  },
  {
    id: 'bruteforce',
    label: 'Brute Force (CRITICAL)',
    icon: '🔨',
    description: 'Critical-severity brute force → triggers BLOCK + Action Queue',
    color: '#991b1b',
    severity: 'critical',
    endpoint: '/api/armoriq/trigger',
    payload: {
      ip: '203.0.113.99',
      attackType: 'brute_force',
      severity: 'critical',
      confidence: 0.97,
      status: 'successful',
    },
  },
];

const SEVERITY_COLOR = {
  low: '#16a34a',
  medium: '#ea580c',
  high: '#dc2626',
  critical: '#7f1d1d',
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function SimulateAttack() {
  const [log, setLog]         = useState([]);
  const [firing, setFiring]   = useState({});
  const [waveActive, setWave] = useState(false);
  const [liveEvents, setLive] = useState([]);

  // Listen for real detections coming back via socket
  useSocket('attack:new', useCallback((data) => {
    setLive(prev => [{
      id: data.id || Date.now(),
      type: data.attackType,
      ip: data.ip,
      severity: data.severity,
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));
  }, []));

  useSocket('action:pending', useCallback((data) => {
    setLive(prev => [{
      id: data.id || Date.now(),
      type: `🔒 BLOCKED: ${data.action}`,
      ip: data.ip,
      severity: 'critical',
      time: new Date().toLocaleTimeString(),
    }, ...prev].slice(0, 20));
  }, []));

  // Fire a single attack
  const fire = async (attack) => {
    setFiring(f => ({ ...f, [attack.id]: true }));
    const entry = {
      id: Date.now(),
      label: attack.label,
      time: new Date().toLocaleTimeString(),
      status: 'pending',
    };
    setLog(prev => [entry, ...prev]);

    try {
      const res = await fetch(`${API}${attack.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attack.payload),
      });
      const data = await res.json();
      setLog(prev =>
        prev.map(l => l.id === entry.id
          ? { ...l, status: data.success ? 'ok' : 'error', detail: data.success ? '✅ Sent — watch dashboard' : '❌ ' + data.message }
          : l
        )
      );
    } catch (e) {
      setLog(prev =>
        prev.map(l => l.id === entry.id
          ? { ...l, status: 'error', detail: '❌ Network error' }
          : l
        )
      );
    } finally {
      setFiring(f => ({ ...f, [attack.id]: false }));
    }
  };

  // Fire all attacks with staggered delays
  const fireWave = async () => {
    setWave(true);
    for (let i = 0; i < ATTACKS.length; i++) {
      await new Promise(r => setTimeout(r, i === 0 ? 0 : 1200));
      fire(ATTACKS[i]);
    }
    setTimeout(() => setWave(false), ATTACKS.length * 1200 + 1000);
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>⚔️ Attack Simulator</h1>
          <p style={s.subtitle}>
            Fire controlled attack payloads directly at SENTINAL. Watch the dashboard react in real time.
          </p>
        </div>
        <div style={s.liveIndicator}>
          <span style={s.liveDot} />
          LIVE
        </div>
      </div>

      {/* Attack Buttons Grid */}
      <div style={s.grid}>
        {ATTACKS.map(attack => (
          <button
            key={attack.id}
            onClick={() => fire(attack)}
            disabled={firing[attack.id] || waveActive}
            style={{
              ...s.attackBtn,
              background: firing[attack.id]
                ? '#333'
                : `linear-gradient(135deg, ${attack.color}cc, ${attack.color}66)`,
              borderColor: attack.color,
              opacity: (firing[attack.id] || waveActive) ? 0.6 : 1,
            }}
          >
            <span style={s.btnIcon}>{attack.icon}</span>
            <span style={s.btnLabel}>{attack.label}</span>
            <span style={{ ...s.btnSeverity, background: SEVERITY_COLOR[attack.severity] }}>
              {attack.severity}
            </span>
            <span style={s.btnDesc}>{attack.description}</span>
            {firing[attack.id] && <span style={s.spinner}>⟳ Sending...</span>}
          </button>
        ))}
      </div>

      {/* Full Attack Wave Button */}
      <button
        onClick={fireWave}
        disabled={waveActive}
        style={{
          ...s.waveBtn,
          opacity: waveActive ? 0.7 : 1,
          animation: waveActive ? 'pulse 1s infinite' : 'none',
        }}
      >
        {waveActive ? '🚨 ATTACK WAVE IN PROGRESS...' : '🚨 LAUNCH FULL ATTACK WAVE'}
      </button>

      <div style={s.columns}>
        {/* Sent Log */}
        <div style={s.panel}>
          <h3 style={s.panelTitle}>📤 Attacks Sent</h3>
          {log.length === 0 && <p style={s.empty}>No attacks fired yet. Click a button above.</p>}
          {log.map(l => (
            <div key={l.id} style={{
              ...s.logItem,
              borderLeft: `3px solid ${l.status === 'ok' ? '#16a34a' : l.status === 'error' ? '#dc2626' : '#666'}`,
            }}>
              <span style={s.logTime}>{l.time}</span>
              <span style={s.logLabel}>{l.label}</span>
              {l.detail && <span style={s.logDetail}>{l.detail}</span>}
            </div>
          ))}
        </div>

        {/* Live Detection Feed */}
        <div style={s.panel}>
          <h3 style={s.panelTitle}>🛡️ Live Detections (via Socket)</h3>
          {liveEvents.length === 0 && <p style={s.empty}>Waiting for detections...</p>}
          {liveEvents.map(e => (
            <div key={e.id} style={{
              ...s.logItem,
              borderLeft: `3px solid ${SEVERITY_COLOR[e.severity] || '#666'}`,
              animation: 'fadeIn 0.3s ease',
            }}>
              <span style={s.logTime}>{e.time}</span>
              <span style={{ ...s.logLabel, color: SEVERITY_COLOR[e.severity] || '#fff' }}>
                {e.type}
              </span>
              <span style={s.logDetail}>from {e.ip}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.6; } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = {
  page:         { padding: '32px 24px', background: '#0a0a0a', minHeight: '100vh', color: '#fff', fontFamily: 'monospace' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 },
  title:        { margin: 0, fontSize: 28, color: '#fff' },
  subtitle:     { margin: '8px 0 0', color: '#888', fontSize: 14 },
  liveIndicator:{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', fontWeight: 700, fontSize: 13 },
  liveDot:      { width: 10, height: 10, borderRadius: '50%', background: '#16a34a', display: 'inline-block',
                  boxShadow: '0 0 0 0 #16a34a', animation: 'pulse 1.5s infinite' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 },
  attackBtn:    { display: 'flex', flexDirection: 'column', gap: 6, padding: '20px 24px', border: '1px solid',
                  borderRadius: 12, cursor: 'pointer', color: '#fff', textAlign: 'left', transition: 'all 0.2s' },
  btnIcon:      { fontSize: 28 },
  btnLabel:     { fontSize: 17, fontWeight: 700 },
  btnSeverity:  { display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11,
                  fontWeight: 700, color: '#fff', textTransform: 'uppercase', width: 'fit-content' },
  btnDesc:      { fontSize: 12, color: '#ccc', lineHeight: 1.4 },
  spinner:      { fontSize: 12, color: '#aaa', marginTop: 4 },
  waveBtn:      { width: '100%', padding: '20px', fontSize: 20, fontWeight: 800, cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7f1d1d, #dc2626)', color: '#fff',
                  border: '2px solid #dc2626', borderRadius: 14, marginBottom: 32, letterSpacing: 1 },
  columns:      { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 },
  panel:        { background: '#111', border: '1px solid #222', borderRadius: 12, padding: 20 },
  panelTitle:   { margin: '0 0 16px', fontSize: 15, color: '#00d4aa' },
  empty:        { color: '#555', fontSize: 13, fontStyle: 'italic' },
  logItem:      { padding: '10px 12px', marginBottom: 8, background: '#1a1a1a', borderRadius: 6,
                  display: 'flex', flexDirection: 'column', gap: 3 },
  logTime:      { fontSize: 11, color: '#666' },
  logLabel:     { fontSize: 13, fontWeight: 600, color: '#fff' },
  logDetail:    { fontSize: 12, color: '#888' },
};
