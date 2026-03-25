import React, { useState } from 'react';
import { getHealth } from '../services/api';

const DEFAULTS = {
  gatewayUrl: 'http://localhost:3000',
  pollIntervalMs: 30000,
  maxFeedRows: 50,
  toastOnAttack: true,
  toastOnAlert: true,
};

const load = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('sentinal_settings') || '{}') }; }
  catch { return DEFAULTS; }
};

export default function Settings() {
  const [cfg, setCfg]       = useState(load);
  const [testMsg, setTestMsg] = useState('');
  const [saved, setSaved]   = useState(false);

  const save = () => {
    localStorage.setItem('sentinal_settings', JSON.stringify(cfg));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => { setCfg(DEFAULTS); localStorage.removeItem('sentinal_settings'); };

  const test = async () => {
    setTestMsg('Testing...');
    try {
      const d = await getHealth();
      setTestMsg(`Connected — uptime ${Math.floor(d.uptime)}s`);
    } catch { setTestMsg('Unreachable — check gateway URL'); }
  };

  return (
    <div>
      <h2>Settings</h2>

      <h4>Connection</h4>
      <label>Gateway URL<br />
        <input value={cfg.gatewayUrl} onChange={e => setCfg(c => ({ ...c, gatewayUrl: e.target.value }))} size="40" />
      </label><br />
      <button onClick={test}>Test Connection</button>
      {testMsg && <span> {testMsg}</span>}

      <h4>Display</h4>
      <label>Poll Interval&nbsp;
        <select value={cfg.pollIntervalMs} onChange={e => setCfg(c => ({ ...c, pollIntervalMs: Number(e.target.value) }))}>
          <option value={10000}>10s</option>
          <option value={30000}>30s</option>
          <option value={60000}>60s</option>
        </select>
      </label><br />
      <label>Max Feed Rows&nbsp;
        <select value={cfg.maxFeedRows} onChange={e => setCfg(c => ({ ...c, maxFeedRows: Number(e.target.value) }))}>
          <option value={20}>20</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </label>

      <h4>Notifications</h4>
      <label><input type="checkbox" checked={cfg.toastOnAttack} onChange={e => setCfg(c => ({ ...c, toastOnAttack: e.target.checked }))} /> Toast on new attack</label><br />
      <label><input type="checkbox" checked={cfg.toastOnAlert}  onChange={e => setCfg(c => ({ ...c, toastOnAlert:  e.target.checked }))} /> Toast on new alert</label>

      <h4>About</h4>
      <p>Version 1.0.0 | Built for HackByte 4.0</p>
      <p>Backend: {cfg.gatewayUrl}</p>

      <br />
      <button onClick={save}>Save</button>{saved && ' ✓ Saved'}&nbsp;
      <button onClick={reset}>Reset to Defaults</button>
    </div>
  );
}
