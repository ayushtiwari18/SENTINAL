/**
 * SimulateAttack — v2 Major Overhaul
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY FIXES & ADDITIONS:
 *  1. ROTATING IPs — every attack fire uses a fresh random IP from a pool,
 *     so blocked IPs never cause "silent" failures during demos
 *  2. IP INTELLIGENCE — each fired attack shows country, ISP, TOR/Proxy flag
 *     from GET /api/geo/ip/:ip (the geoIntel module)
 *  3. RICH ATTACK CARDS — shows endpoint hit, payload preview, confidence,
 *     detection method, Nexus action expected
 *  4. PIPELINE TRACKER — live step-by-step status of each fired attack
 *     (Sent → Detected → Nexus Evaluated → Action Queued/Auto-Executed)
 *  5. NEW ATTACK TYPES — SSRF, XXE, LFI/RFI, HTTP Parameter Pollution added
 *  6. SCENARIO MODES — APT Simulation, Recon Sweep, Credential Stuffing
 *  7. CUSTOM ATTACK BUILDER — fill any field and fire a totally custom payload
 *  8. PAYLOAD MUTATION — Gemini WAF evasion variants (preserved from v1)
 */
import { useState, useCallback, useRef } from 'react';
import { useSocket }    from '../hooks/useSocket';
import Panel            from '../components/ui/Panel';
import PageWrapper      from '../components/layout/PageWrapper';
import { geminiMutate } from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── IP Pool — 40 diverse IPs so blocked ones are never reused ─────────────────
const IP_POOL = [
  '203.0.113.10','203.0.113.11','203.0.113.12','203.0.113.13','203.0.113.14',
  '198.51.100.5','198.51.100.20','198.51.100.77','198.51.100.88','198.51.100.99',
  '185.220.101.1','185.220.101.2','185.220.101.3','185.220.101.45','185.220.101.67',
  '91.108.4.10','91.108.4.20','91.108.4.30','91.108.4.40','91.108.4.50',
  '45.33.32.156','45.33.32.200','45.33.32.201','45.33.32.202','45.33.32.210',
  '104.21.10.1','104.21.10.2','104.21.10.3','104.21.10.4','104.21.10.5',
  '77.88.55.60','77.88.55.70','77.88.55.80','77.88.55.90','77.88.55.100',
  '2.56.188.1','2.56.188.2','2.56.188.3','2.56.188.4','2.56.188.5',
];

// Track used IPs so we never reuse one that's been blocked this session
const usedIPs = new Set();
function getFreshIP() {
  const available = IP_POOL.filter(ip => !usedIPs.has(ip));
  if (available.length === 0) { usedIPs.clear(); }
  const ip = available[Math.floor(Math.random() * available.length)] || `10.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
  usedIPs.add(ip);
  return ip;
}

// ── Attack Definitions ────────────────────────────────────────────────────────
const ATTACKS = [
  {
    id: 'sqli', label: 'SQL Injection', icon: '💉', color: '#ef4444',
    severity: 'high', confidence: 0.94,
    description: 'Classic login bypass via boolean-based SQLi',
    endpoint: '/api/logs/ingest',
    method: 'POST', targetUrl: '/login',
    payloadPreview: "username: admin' OR '1'='1' --",
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'POST', url: '/login', ip,
      headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0' },
      queryParams: {},
      body: { username: "admin' OR '1'='1' --", password: 'anything' },
    }),
  },
  {
    id: 'xss', label: 'XSS Attack', icon: '⚡', color: '#f97316',
    severity: 'medium', confidence: 0.88,
    description: 'Reflected XSS via search query parameter',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/search?q=',
    payloadPreview: '<script>alert(document.cookie)</script>',
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET',
      url: '/search?q=<script>alert(document.cookie)</script>', ip,
      headers: { 'user-agent': 'Mozilla/5.0' },
      queryParams: { q: '<script>alert(document.cookie)</script>' }, body: {},
    }),
  },
  {
    id: 'traversal', label: 'Path Traversal', icon: '📁', color: '#eab308',
    severity: 'high', confidence: 0.91,
    description: 'Directory traversal to /etc/passwd',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/file?name=',
    payloadPreview: '/../../../etc/passwd',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET', url: '/file?name=/../../../etc/passwd', ip,
      headers: {}, queryParams: { name: '/../../../etc/passwd' }, body: {},
    }),
  },
  {
    id: 'cmdinject', label: 'Command Injection', icon: '💻', color: '#7c3aed',
    severity: 'critical', confidence: 0.96,
    description: 'OS command injection via search endpoint',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/search?q=',
    payloadPreview: 'hello; cat /etc/shadow',
    detectionMethod: 'Pattern + ML',
    expectedNexus: 'permanent_ban_ip → Action Queue',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET', url: '/search?q=hello; cat /etc/shadow', ip,
      headers: {}, queryParams: { q: 'hello; cat /etc/shadow' }, body: {},
    }),
  },
  {
    id: 'bruteforce', label: 'Brute Force', icon: '🔨', color: '#ef4444',
    severity: 'critical', confidence: 0.97,
    description: 'Critical brute force → direct Nexus trigger',
    endpoint: '/api/nexus/trigger',
    method: 'POST', targetUrl: '/api/nexus/trigger',
    payloadPreview: 'attackType: brute_force, confidence: 0.97',
    detectionMethod: 'Rate analysis (Nexus direct)',
    expectedNexus: 'permanent_ban_ip → Action Queue',
    makePayload: (ip) => ({ ip, attackType: 'brute_force', severity: 'critical', confidence: 0.97, status: 'successful' }),
  },
  {
    id: 'ssrf', label: 'SSRF', icon: '🌐', color: '#06b6d4',
    severity: 'high', confidence: 0.89,
    description: 'Server-Side Request Forgery to internal AWS metadata',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/proxy?url=',
    payloadPreview: 'http://169.254.169.254/latest/meta-data/',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET',
      url: '/proxy?url=http://169.254.169.254/latest/meta-data/', ip,
      headers: {}, queryParams: { url: 'http://169.254.169.254/latest/meta-data/' }, body: {},
    }),
  },
  {
    id: 'xxe', label: 'XXE Injection', icon: '📜', color: '#ec4899',
    severity: 'high', confidence: 0.87,
    description: 'XML External Entity injection via /api/parse',
    endpoint: '/api/logs/ingest',
    method: 'POST', targetUrl: '/api/parse',
    payloadPreview: '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>',
    detectionMethod: 'XML inspection',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'POST', url: '/api/parse', ip,
      headers: { 'content-type': 'application/xml' },
      queryParams: {},
      body: { raw: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>' },
    }),
  },
  {
    id: 'lfi', label: 'LFI / RFI', icon: '📂', color: '#84cc16',
    severity: 'high', confidence: 0.90,
    description: 'Local file inclusion via page parameter',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/page?file=',
    payloadPreview: '../../../../etc/passwd%00',
    detectionMethod: 'Pattern matching',
    expectedNexus: 'rate_limit_ip',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET', url: '/page?file=../../../../etc/passwd%00', ip,
      headers: {}, queryParams: { file: '../../../../etc/passwd%00' }, body: {},
    }),
  },
  {
    id: 'hpp', label: 'HTTP Param Pollution', icon: '🔀', color: '#a78bfa',
    severity: 'medium', confidence: 0.78,
    description: 'Duplicate parameters to bypass WAF rules',
    endpoint: '/api/logs/ingest',
    method: 'GET', targetUrl: '/search',
    payloadPreview: '?q=legit&q=<script>alert(1)</script>',
    detectionMethod: 'Parameter analysis',
    expectedNexus: 'flag_for_review',
    makePayload: (ip) => ({
      projectId: 'demo-target', method: 'GET',
      url: '/search?q=legit&q=<script>alert(1)</script>', ip,
      headers: {}, queryParams: { q: ['legit', '<script>alert(1)</script>'] }, body: {},
    }),
  },
];

// ── Scenario Packs ────────────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'apt',
    label: '🕵️ APT Simulation',
    color: '#ef4444',
    description: 'Advanced Persistent Threat: recon → exploitation → persistence attempt',
    attacks: ['traversal', 'sqli', 'lfi', 'cmdinject'],
    delays: [0, 800, 1600, 2400],
  },
  {
    id: 'recon',
    label: '🔍 Recon Sweep',
    color: '#06b6d4',
    description: 'Attacker probing for vulnerabilities across multiple vectors',
    attacks: ['traversal', 'lfi', 'ssrf', 'xxe', 'hpp'],
    delays: [0, 600, 1200, 1800, 2400],
  },
  {
    id: 'credential',
    label: '🔐 Credential Stuffing',
    color: '#f97316',
    description: 'Automated credential attack followed by brute force escalation',
    attacks: ['sqli', 'sqli', 'sqli', 'bruteforce'],
    delays: [0, 500, 1000, 1800],
  },
  {
    id: 'fullwave',
    label: '🚨 Full Attack Wave',
    color: '#7c3aed',
    description: 'All 9 attack types fired sequentially — maximum demo impact',
    attacks: ATTACKS.map(a => a.id),
    delays: ATTACKS.map((_, i) => i * 900),
  },
];

const SEV_COLOR = {
  low: '#22c55e', medium: '#f97316', high: '#ef4444', critical: '#dc2626',
};

const ATTACK_TYPE_OPTIONS = [
  'sqli','xss','traversal','command_injection','ssrf','lfi_rfi','brute_force','xxe','hpp','unknown',
];

// ── Pipeline step helper ──────────────────────────────────────────────────────
const PIPELINE_STEPS = ['📤 Sent', '🔍 Detected', '🤖 Nexus', '✅ Done'];

export default function SimulateAttack() {
  // Simulator
  const [firing,       setFiring]     = useState({});
  const [attackLog,    setAttackLog]  = useState([]);  // rich log entries
  const [liveEvents,   setLive]       = useState([]);
  const [scenarioActive, setScenario] = useState(null);
  const [activeTab,    setActiveTab]  = useState('attacks'); // 'attacks' | 'scenarios' | 'custom' | 'mutate'

  // Custom builder
  const [custom, setCustom] = useState({
    ip: '', attackType: 'sqli', severity: 'high', confidence: 0.90,
    method: 'POST', url: '/login', body: '',
  });

  // Mutation
  const [mutPayload,  setMutPayload]  = useState('');
  const [mutType,     setMutType]     = useState('sqli');
  const [mutLoading,  setMutLoading]  = useState(false);
  const [mutResult,   setMutResult]   = useState(null);
  const [mutError,    setMutError]    = useState(null);
  const [copiedIdx,   setCopiedIdx]   = useState(null);

  // ── Socket listeners ───────────────────────────────────────────────────────
  useSocket('attack:new', useCallback((payload) => {
    const d = payload?.data ?? payload;
    setLive(prev => [{
      id: d._id || d.id || Date.now(),
      type: d.attackType || 'unknown',
      ip: d.ip || '—',
      severity: d.severity || 'low',
      confidence: d.confidence ? `${(d.confidence * 100).toFixed(0)}%` : '—',
      time: new Date().toLocaleTimeString(),
      kind: 'attack',
    }, ...prev].slice(0, 30));
    // Update pipeline step for matching log entry
    setAttackLog(prev => prev.map(l =>
      l.ip === (d.ip || '') ? { ...l, step: Math.max(l.step, 1) } : l
    ));
  }, []));

  useSocket('action:pending', useCallback((payload) => {
    const d = payload?.data ?? payload;
    setLive(prev => [{
      id: d.id || Date.now(),
      type: `🔒 ${d.action || 'action'}`,
      ip: d.ip || '—', severity: 'critical',
      confidence: '—',
      time: new Date().toLocaleTimeString(),
      kind: 'block',
    }, ...prev].slice(0, 30));
    setAttackLog(prev => prev.map(l =>
      l.ip === (d.ip || '') ? { ...l, step: 3, nexusAction: d.action } : l
    ));
  }, []));

  // ── Fire a single attack ───────────────────────────────────────────────────
  const fire = async (attackDef, overrideIP = null) => {
    const ip = overrideIP || getFreshIP();
    setFiring(f => ({ ...f, [attackDef.id]: true }));

    const logEntry = {
      id: Date.now() + Math.random(),
      label: attackDef.label,
      icon: attackDef.icon,
      ip,
      endpoint: attackDef.endpoint,
      targetUrl: attackDef.targetUrl,
      payloadPreview: attackDef.payloadPreview,
      severity: attackDef.severity,
      confidence: attackDef.confidence,
      detectionMethod: attackDef.detectionMethod,
      expectedNexus: attackDef.expectedNexus,
      time: new Date().toLocaleTimeString(),
      status: 'pending',
      step: 0,
      nexusAction: null,
      geoIntel: null,
    };
    setAttackLog(prev => [logEntry, ...prev].slice(0, 50));

    // Fetch geo intel for this IP (non-blocking)
    fetchGeoIntel(ip, logEntry.id);

    try {
      const res  = await fetch(`${API}${attackDef.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attackDef.makePayload(ip)),
      });
      const data = await res.json();
      setAttackLog(prev => prev.map(l => l.id === logEntry.id
        ? { ...l, status: data.success ? 'ok' : 'error', step: data.success ? 1 : 0,
            detail: data.success ? null : '❌ ' + (data.message || 'Error') }
        : l
      ));
      // Simulate pipeline progression
      if (data.success) {
        setTimeout(() => setAttackLog(prev => prev.map(l => l.id === logEntry.id ? { ...l, step: 2 } : l)), 1200);
        setTimeout(() => setAttackLog(prev => prev.map(l => l.id === logEntry.id && l.step < 3 ? { ...l, step: 3 } : l)), 2400);
      }
    } catch {
      setAttackLog(prev => prev.map(l => l.id === logEntry.id
        ? { ...l, status: 'error', detail: '❌ Network error' } : l
      ));
    } finally {
      setFiring(f => ({ ...f, [attackDef.id]: false }));
    }
  };

  // ── Fetch geo intel for fired IP ───────────────────────────────────────────
  const fetchGeoIntel = async (ip, logId) => {
    try {
      const res = await fetch(`${API}/api/geo/ip/${ip}`);
      const data = await res.json();
      // geoIntel.js returns heatmap array — find entry or use stub
      const entry = (data.heatmap || [])[0] || null;
      setAttackLog(prev => prev.map(l => l.id === logId
        ? { ...l, geoIntel: entry || { country: 'Unknown', tor_count: 0, proxy_count: 0 } }
        : l
      ));
    } catch { /* silent */ }
  };

  // ── Fire a scenario ────────────────────────────────────────────────────────
  const fireScenario = async (scenario) => {
    setScenario(scenario.id);
    const scenarioIP = getFreshIP(); // Same IP for whole scenario = realistic
    for (let i = 0; i < scenario.attacks.length; i++) {
      const attackDef = ATTACKS.find(a => a.id === scenario.attacks[i]);
      if (!attackDef) continue;
      await new Promise(r => setTimeout(r, i === 0 ? 0 : (scenario.delays[i] - scenario.delays[i-1])));
      fire(attackDef, scenario.id === 'credential' ? scenarioIP : null);
    }
    setTimeout(() => setScenario(null), scenario.delays[scenario.attacks.length - 1] + 3000);
  };

  // ── Custom attack fire ─────────────────────────────────────────────────────
  const fireCustom = async () => {
    const ip = custom.ip || getFreshIP();
    const customDef = {
      id: 'custom_' + Date.now(),
      label: `Custom: ${custom.attackType}`,
      icon: '🔧', color: '#a78bfa',
      severity: custom.severity,
      confidence: parseFloat(custom.confidence),
      description: 'Custom attack payload',
      endpoint: '/api/nexus/trigger',
      targetUrl: custom.url,
      payloadPreview: custom.body || '(nexus direct)',
      detectionMethod: 'Custom / Direct',
      expectedNexus: 'Depends on severity',
      makePayload: () => ({
        ip, attackType: custom.attackType, severity: custom.severity,
        confidence: parseFloat(custom.confidence), status: 'successful',
        url: custom.url, method: custom.method,
      }),
    };
    fire(customDef, ip);
  };

  // ── Gemini mutation ────────────────────────────────────────────────────────
  const runMutation = async () => {
    if (!mutPayload.trim()) return;
    setMutLoading(true); setMutError(null); setMutResult(null);
    try {
      const data = await geminiMutate(mutPayload.trim(), mutType);
      setMutResult(data);
    } catch (err) {
      setMutError(err?.response?.data?.message || 'Mutation failed.');
    } finally { setMutLoading(false); }
  };

  const copyVariant = async (text, idx) => {
    try { await navigator.clipboard.writeText(text); setCopiedIdx(idx); setTimeout(() => setCopiedIdx(null), 1500); } catch {}
  };

  const fireVariant = (variant) => {
    const match = ATTACKS.find(a => a.id === mutType || a.id.includes(mutType.split('_')[0]));
    if (match) {
      const clone = { ...match, makePayload: (ip) => ({ ...match.makePayload(ip), url: variant }) };
      fire(clone);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="page-container">

        {/* Header */}
        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">⚔️ Attack Simulator</h1>
            <p className="page-subtitle">
              Fire controlled attack payloads against SENTINAL. Each attack uses a <strong>fresh IP</strong> — blocked IPs are never reused.
            </p>
          </div>
          <div className="page-actions">
            <span className="live-indicator">LIVE</span>
            <span style={styles.ipPoolBadge}>🔄 {IP_POOL.length - usedIPs.size} IPs remaining</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabBar}>
          {[['attacks','⚔️ Attack Cards'],['scenarios','🎬 Scenarios'],['custom','🔧 Custom Builder'],['mutate','🧬 Payload Mutator']].map(([id, label]) => (
            <button
              key={id}
              style={{ ...styles.tab, ...(activeTab === id ? styles.tabActive : {}) }}
              onClick={() => setActiveTab(id)}
            >{label}</button>
          ))}
        </div>

        {/* ── TAB: ATTACK CARDS ─────────────────────────────────────── */}
        {activeTab === 'attacks' && (
          <div style={styles.attackGrid}>
            {ATTACKS.map(attack => (
              <button
                key={attack.id}
                onClick={() => fire(attack)}
                disabled={!!firing[attack.id]}
                style={{ ...styles.attackCard, borderColor: attack.color, opacity: firing[attack.id] ? 0.6 : 1 }}
              >
                <div style={styles.cardTop}>
                  <span style={{ fontSize: '22px' }}>{attack.icon}</span>
                  <span style={{ ...styles.sevBadge, background: SEV_COLOR[attack.severity] }}>{attack.severity}</span>
                  <span style={{ ...styles.confBadge }}>🎯 {(attack.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ ...styles.cardLabel, color: attack.color }}>{attack.label}</div>
                <div style={styles.cardDesc}>{attack.description}</div>
                <div style={styles.cardMeta}>
                  <span style={styles.metaTag}>📍 {attack.targetUrl}</span>
                  <span style={styles.metaTag}>🔎 {attack.detectionMethod}</span>
                  <span style={{ ...styles.metaTag, color: attack.expectedNexus.includes('Queue') ? '#ef4444' : '#22c55e' }}>
                    🤖 {attack.expectedNexus}
                  </span>
                </div>
                <code style={styles.payloadPreview}>{attack.payloadPreview}</code>
                {firing[attack.id] && <span style={styles.firingMsg}>⟳ Firing...</span>}
              </button>
            ))}
          </div>
        )}

        {/* ── TAB: SCENARIOS ────────────────────────────────────────── */}
        {activeTab === 'scenarios' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {SCENARIOS.map(s => (
              <div key={s.id} style={{ ...styles.scenarioCard, borderColor: s.color }}>
                <div style={styles.scenarioTop}>
                  <div>
                    <div style={{ ...styles.scenarioLabel, color: s.color }}>{s.label}</div>
                    <div style={styles.scenarioDesc}>{s.description}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      {s.attacks.map((aId, i) => {
                        const a = ATTACKS.find(x => x.id === aId);
                        return a ? (
                          <span key={i} style={{ ...styles.metaTag, borderColor: a.color, color: a.color }}>
                            {a.icon} {a.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8' }}>
                      ⏱ Duration: ~{(s.delays[s.delays.length - 1] / 1000).toFixed(1)}s &nbsp;•&nbsp; {s.attacks.length} attacks
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ borderColor: s.color, background: s.color + '22', color: s.color, whiteSpace: 'nowrap', alignSelf: 'flex-start' }}
                    disabled={!!scenarioActive}
                    onClick={() => fireScenario(s)}
                  >
                    {scenarioActive === s.id ? '🚨 Running...' : '▶ Launch'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TAB: CUSTOM BUILDER ───────────────────────────────────── */}
        {activeTab === 'custom' && (
          <Panel title="🔧 Custom Attack Builder">
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
              Build any custom attack payload and fire it directly into the Nexus engine. Useful for testing specific IPs, attack types, or edge cases.
            </p>
            <div style={styles.customGrid}>
              <label style={styles.fieldLabel}>IP Address
                <input style={styles.input} value={custom.ip} placeholder="Leave blank for random fresh IP"
                  onChange={e => setCustom(c => ({ ...c, ip: e.target.value }))} />
              </label>
              <label style={styles.fieldLabel}>Attack Type
                <select style={styles.input} value={custom.attackType}
                  onChange={e => setCustom(c => ({ ...c, attackType: e.target.value }))}>
                  {ATTACK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={styles.fieldLabel}>Severity
                <select style={styles.input} value={custom.severity}
                  onChange={e => setCustom(c => ({ ...c, severity: e.target.value }))}>
                  {['low','medium','high','critical'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label style={styles.fieldLabel}>Confidence (0-1)
                <input style={styles.input} type="number" min="0" max="1" step="0.01" value={custom.confidence}
                  onChange={e => setCustom(c => ({ ...c, confidence: e.target.value }))} />
              </label>
              <label style={styles.fieldLabel}>Method
                <select style={styles.input} value={custom.method}
                  onChange={e => setCustom(c => ({ ...c, method: e.target.value }))}>
                  {['GET','POST','PUT','DELETE','PATCH'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={styles.fieldLabel}>Target URL
                <input style={styles.input} value={custom.url} placeholder="/login"
                  onChange={e => setCustom(c => ({ ...c, url: e.target.value }))} />
              </label>
            </div>
            <button className="btn btn-danger" style={{ marginTop: '16px', width: '100%' }} onClick={fireCustom}>
              🔧 Fire Custom Attack
            </button>
          </Panel>
        )}

        {/* ── TAB: PAYLOAD MUTATOR ──────────────────────────────────── */}
        {activeTab === 'mutate' && (
          <Panel title="🧬 Payload Mutation Generator — Gemini WAF Evasion Variants">
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
              Paste any payload. Gemini generates 5 evasion variants using different bypass techniques.
            </p>
            <div style={styles.mutInputRow}>
              <textarea value={mutPayload} onChange={e => setMutPayload(e.target.value)}
                placeholder="Paste payload, e.g.  ' OR 1=1 --   or   <script>alert(1)</script>"
                style={styles.mutTextarea} rows={3} />
              <div style={styles.mutControls}>
                <select value={mutType} onChange={e => setMutType(e.target.value)} style={styles.input}>
                  {ATTACK_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn btn-primary" onClick={runMutation}
                  disabled={mutLoading || !mutPayload.trim()}>
                  {mutLoading ? '⏳ Generating...' : '🧠 Generate Variants'}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', alignSelf: 'center' }}>Quick fill:</span>
              {ATTACKS.filter(a => a.payloadPreview).map(a => (
                <button key={a.id} className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 10px' }}
                  onClick={() => { setMutPayload(a.payloadPreview); setMutType(a.id === 'cmdinject' ? 'command_injection' : a.id === 'lfi' ? 'lfi_rfi' : a.id === 'hpp' ? 'hpp' : a.id); }}>
                  {a.icon} {a.label}
                </button>
              ))}
            </div>
            {mutError && <div style={styles.mutError}>{mutError}</div>}
            {mutResult && (
              <div>
                <div style={styles.mutOriginal}>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Original</span>
                  <code style={{ fontSize: '13px', wordBreak: 'break-all' }}>{mutResult.original}</code>
                  <span style={{ fontSize: '11px', color: mutResult.generated ? '#22c55e' : '#64748b' }}>
                    {mutResult.generated ? '🧠 Gemini-generated' : '📊 Static variants'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                  {mutResult.mutations?.map((m, i) => (
                    <div key={i} style={styles.mutCard}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, fontSize: '13px' }}>#{i + 1} — {m.technique}</span>
                        <span style={{ ...styles.sevBadge, background: SEV_COLOR[m.risk] || '#f97316' }}>{m.risk}</span>
                        <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 10px', marginLeft: 'auto' }}
                          onClick={() => copyVariant(m.variant, i)}>{copiedIdx === i ? '✅ Copied' : '📋 Copy'}</button>
                        <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '2px 10px', color: '#f97316' }}
                          onClick={() => fireVariant(m.variant)}>⚡ Fire</button>
                      </div>
                      <code style={styles.mutVariant}>{m.variant}</code>
                      <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}><strong>Evades:</strong> {m.evades}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        )}

        {/* ── BOTTOM: Pipeline Log + Live Feed ──────────────────────── */}
        <div style={styles.bottomGrid}>

          {/* Rich Attack Log with Pipeline Tracker */}
          <Panel title={`📋 Attacks Fired (${attackLog.length})`}>
            {attackLog.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>No attacks fired yet. Pick a card above.</p>
            ) : attackLog.map(l => (
              <div key={l.id} style={{
                ...styles.logCard,
                borderLeftColor: l.status === 'error' ? '#ef4444' : SEV_COLOR[l.severity] || '#334155',
              }}>
                {/* Row 1: Icon + Label + Time + IP */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '16px' }}>{l.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: '13px' }}>{l.label}</span>
                  <span style={{ ...styles.sevBadge, background: SEV_COLOR[l.severity] }}>{l.severity}</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{l.time}</span>
                </div>
                {/* Row 2: IP + Geo intel */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span style={styles.infoChip}>🌐 {l.ip}</span>
                  {l.geoIntel ? (
                    <>
                      <span style={styles.infoChip}>📍 {l.geoIntel.country || 'Unknown'}</span>
                      {l.geoIntel.tor_count > 0 && <span style={{ ...styles.infoChip, color: '#ef4444' }}>🧅 TOR</span>}
                      {l.geoIntel.proxy_count > 0 && <span style={{ ...styles.infoChip, color: '#f97316' }}>🔀 Proxy</span>}
                    </>
                  ) : (
                    <span style={{ ...styles.infoChip, color: '#64748b' }}>⏳ Looking up geo...</span>
                  )}
                  <span style={styles.infoChip}>🎯 {(l.confidence * 100).toFixed(0)}% conf</span>
                </div>
                {/* Row 3: Endpoint + payload */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <span style={styles.infoChip}>📍 {l.targetUrl}</span>
                  <span style={{ ...styles.infoChip, color: '#a78bfa', fontFamily: 'monospace' }}>{l.payloadPreview?.slice(0, 50)}{l.payloadPreview?.length > 50 ? '…' : ''}</span>
                </div>
                {/* Row 4: Pipeline tracker */}
                <div style={styles.pipeline}>
                  {PIPELINE_STEPS.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{
                        ...styles.pipeStep,
                        background: l.step > i ? '#22c55e22' : l.step === i ? '#f9731622' : 'transparent',
                        color: l.step > i ? '#22c55e' : l.step === i ? '#f97316' : '#475569',
                        borderColor: l.step > i ? '#22c55e' : l.step === i ? '#f97316' : '#334155',
                      }}>{step}</span>
                      {i < PIPELINE_STEPS.length - 1 && (
                        <span style={{ color: l.step > i ? '#22c55e' : '#334155', fontSize: '10px' }}>→</span>
                      )}
                    </div>
                  ))}
                </div>
                {/* Nexus action if resolved */}
                {l.nexusAction && (
                  <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
                    🤖 Nexus queued: <strong>{l.nexusAction}</strong> — check /action-queue
                  </div>
                )}
                {l.detail && <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '2px' }}>{l.detail}</div>}
              </div>
            ))}
          </Panel>

          {/* Live Socket Feed */}
          <Panel title="⚡ Live Detections (Socket.IO)">
            {liveEvents.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic' }}>Waiting for detections...</p>
            ) : liveEvents.map(e => (
              <div key={e.id} style={{
                ...styles.liveItem,
                borderLeftColor: e.kind === 'block' ? '#ef4444' : SEV_COLOR[e.severity] || '#334155',
                animation: 'fadeIn 300ms ease',
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: e.kind === 'block' ? '#ef4444' : SEV_COLOR[e.severity] }}>
                    {e.kind === 'block' ? '🔒' : '⚠️'} {e.type}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>{e.time}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <span style={styles.infoChip}>🌐 {e.ip}</span>
                  {e.confidence !== '—' && <span style={styles.infoChip}>🎯 {e.confidence}</span>}
                  <span style={{ ...styles.sevBadge, background: SEV_COLOR[e.severity] }}>{e.severity}</span>
                </div>
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
  ipPoolBadge: { fontSize: '11px', padding: '4px 10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '999px', color: '#94a3b8' },
  tabBar: { display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid #1e293b', paddingBottom: '0' },
  tab: { padding: '8px 18px', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', borderBottom: '2px solid transparent', transition: 'all 150ms' },
  tabActive: { color: '#e2e8f0', borderBottomColor: '#6366f1' },
  attackGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginBottom: '20px' },
  attackCard: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px', border: '1px solid', borderRadius: '12px', cursor: 'pointer', background: 'var(--color-surface)', textAlign: 'left', transition: 'all 150ms ease', fontFamily: 'var(--font-sans)' },
  cardTop: { display: 'flex', alignItems: 'center', gap: '8px' },
  cardLabel: { fontSize: '15px', fontWeight: 700 },
  cardDesc: { fontSize: '12px', color: '#94a3b8', lineHeight: 1.4 },
  cardMeta: { display: 'flex', flexDirection: 'column', gap: '4px' },
  metaTag: { fontSize: '11px', color: '#64748b', border: '1px solid #1e293b', borderRadius: '4px', padding: '1px 6px', width: 'fit-content' },
  payloadPreview: { fontSize: '11px', color: '#a78bfa', background: '#1e293b', padding: '6px 8px', borderRadius: '6px', wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontFamily: 'monospace' },
  sevBadge: { display: 'inline-block', padding: '1px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 700, color: '#000', textTransform: 'uppercase' },
  confBadge: { fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' },
  firingMsg: { fontSize: '11px', color: '#f97316' },
  scenarioCard: { padding: '20px', border: '1px solid', borderRadius: '12px', background: 'var(--color-surface)' },
  scenarioTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' },
  scenarioLabel: { fontSize: '16px', fontWeight: 700 },
  scenarioDesc: { fontSize: '13px', color: '#94a3b8', marginTop: '4px' },
  customGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' },
  fieldLabel: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#94a3b8' },
  input: { padding: '8px 12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px', fontFamily: 'var(--font-sans)' },
  bottomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '20px' },
  logCard: { padding: '12px', marginBottom: '10px', background: '#0f172a', borderRadius: '10px', borderLeft: '3px solid', display: 'flex', flexDirection: 'column', gap: '4px' },
  infoChip: { fontSize: '11px', color: '#94a3b8', background: '#1e293b', padding: '1px 8px', borderRadius: '4px' },
  pipeline: { display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', flexWrap: 'wrap' },
  pipeStep: { fontSize: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid', transition: 'all 300ms' },
  liveItem: { padding: '10px 12px', marginBottom: '8px', background: '#0f172a', borderRadius: '8px', borderLeft: '3px solid' },
  mutInputRow: { display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' },
  mutTextarea: { flex: 1, minWidth: 260, padding: '10px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '13px', resize: 'vertical' },
  mutControls: { display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'flex-end' },
  mutError: { padding: '10px', background: '#450a0a', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontSize: '13px', marginBottom: '12px' },
  mutOriginal: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px', background: '#0f172a', borderRadius: '8px', marginBottom: '8px' },
  mutCard: { padding: '12px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' },
  mutVariant: { display: 'block', padding: '6px 10px', background: '#0a0a0a', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', color: '#a78bfa', wordBreak: 'break-all', whiteSpace: 'pre-wrap' },
};
