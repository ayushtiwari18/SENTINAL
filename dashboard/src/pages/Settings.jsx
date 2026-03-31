/**
 * Settings — full redesign with design system.
 * All logic preserved: localStorage persistence, connection test, reset.
 * Added: toggle switches, settings-row layout, saved toast, About panel.
 */
import React, { useState } from 'react';
import { getHealth } from '../services/api';
import Panel       from '../components/ui/Panel';
import PageWrapper from '../components/layout/PageWrapper';

const DEFAULTS = {
  gatewayUrl:     'http://localhost:3000',
  pollIntervalMs: 30000,
  maxFeedRows:    50,
  toastOnAttack:  true,
  toastOnAlert:   true,
};

const load = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sentinal_settings') || '{}') }; }
  catch { return DEFAULTS; }
};

function Toggle({ checked, onChange }) {
  return (
    <label className="toggle-wrap">
      <input
        type="checkbox"
        className="toggle-input"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <span className="toggle-track" />
    </label>
  );
}

export default function Settings() {
  const [cfg,     setCfg]     = useState(load);
  const [saved,   setSaved]   = useState(false);
  const [connMsg, setConnMsg] = useState(null);  // null | { text, status }

  const set = (key, val) => setCfg(c => ({ ...c, [key]: val }));

  const save = () => {
    localStorage.setItem('sentinal_settings', JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const reset = () => {
    setCfg(DEFAULTS);
    localStorage.removeItem('sentinal_settings');
  };

  const testConnection = async () => {
    setConnMsg({ text: 'Testing…', status: 'pending' });
    try {
      const d = await getHealth();
      setConnMsg({ text: `✓ Connected — uptime ${Math.floor(d.uptime)}s, DB ${d.dbStatus}`, status: 'ok' });
    } catch {
      setConnMsg({ text: '✗ Unreachable — check the Gateway URL and ensure the server is running.', status: 'error' });
    }
  };

  return (
    <PageWrapper>
      <div className="page-container" style={{ maxWidth: '720px' }}>

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">
              Dashboard configuration — changes are saved to <code>localStorage</code>.
            </p>
          </div>
          <div className="page-actions">
            {saved && (
              <span className="saved-toast">✓ Saved</span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={reset}>Reset Defaults</button>
            <button className="btn btn-primary" onClick={save}>Save Changes</button>
          </div>
        </div>

        {/* Connection */}
        <Panel title="Connection" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <div className="settings-row">
              <div style={{ flex: 1 }}>
                <div className="settings-label">Gateway URL</div>
                <div className="settings-hint">Base URL of the SENTINAL backend API.</div>
              </div>
              <div className="settings-control">
                <input
                  type="url"
                  value={cfg.gatewayUrl}
                  onChange={e => set('gatewayUrl', e.target.value)}
                  placeholder="http://localhost:3000"
                />
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button className="btn btn-sm" onClick={testConnection}>Test Connection</button>
              {connMsg && (
                <span className={`conn-result ${connMsg.status}`}>{connMsg.text}</span>
              )}
            </div>
          </div>
        </Panel>

        {/* Display */}
        <Panel title="Display" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <div className="settings-row">
              <div>
                <div className="settings-label">Poll Interval</div>
                <div className="settings-hint">How often pages auto-refresh data.</div>
              </div>
              <div className="settings-control">
                <select value={cfg.pollIntervalMs} onChange={e => set('pollIntervalMs', Number(e.target.value))}>
                  <option value={10000}>10 seconds</option>
                  <option value={30000}>30 seconds</option>
                  <option value={60000}>60 seconds</option>
                </select>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">Max Feed Rows</div>
                <div className="settings-hint">Maximum items shown in live attack feed.</div>
              </div>
              <div className="settings-control">
                <select value={cfg.maxFeedRows} onChange={e => set('maxFeedRows', Number(e.target.value))}>
                  <option value={20}>20 rows</option>
                  <option value={50}>50 rows</option>
                  <option value={100}>100 rows</option>
                </select>
              </div>
            </div>
          </div>
        </Panel>

        {/* Notifications */}
        <Panel title="Notifications" style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ padding: 'var(--space-4)' }}>
            <div className="settings-row">
              <div>
                <div className="settings-label">Toast on new attack</div>
                <div className="settings-hint">Show a notification when a new attack is detected.</div>
              </div>
              <Toggle checked={cfg.toastOnAttack} onChange={v => set('toastOnAttack', v)} />
            </div>

            <div className="settings-row">
              <div>
                <div className="settings-label">Toast on new alert</div>
                <div className="settings-hint">Show a notification when a new alert is raised.</div>
              </div>
              <Toggle checked={cfg.toastOnAlert} onChange={v => set('toastOnAlert', v)} />
            </div>
          </div>
        </Panel>

        {/* About */}
        <Panel title="About">
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {[
              ['Product',   'SENTINAL'],
              ['Version',   '1.0.0'],
              ['Event',     'HackByte 4.0'],
              ['Backend',   <code style={{ fontSize: 'var(--text-xs)' }}>{cfg.gatewayUrl}</code>],
              ['AI Engine', 'Nexus'],
            ].map(([label, val]) => (
              <div key={label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-2) 0',
                borderBottom: '1px solid var(--color-border)',
              }}>
                <span style={{
                  minWidth: '100px',
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--tracking-widest)',
                  color: 'var(--color-text-muted)',
                  fontWeight: 'var(--weight-semibold)',
                }}>{label}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </Panel>

      </div>
    </PageWrapper>
  );
}
