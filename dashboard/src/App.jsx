/**
 * SENTINAL — Operations Dashboard
 * Port: 5173  |  Gateway: http://localhost:3000
 *
 * Layout:
 *   Header
 *   Row 1: SystemStatus | StatsPanel
 *   Row 2: LiveAttackFeed (full width)
 *   Row 3: AlertsPanel (full width)
 */
import React from 'react';
import SystemStatus  from './components/SystemStatus';
import StatsPanel    from './components/StatsPanel';
import LiveAttackFeed from './components/LiveAttackFeed';
import AlertsPanel   from './components/AlertsPanel';

const HEADER_STYLE = {
  background: '#0a0a0a',
  borderBottom: '1px solid #2a2a2a',
  padding: '10px 20px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between'
};

const LAYOUT_STYLE = {
  padding: 16,
  maxWidth: 1400,
  margin: '0 auto'
};

const ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: '1fr 2fr',
  gap: 16,
  marginBottom: 0
};

export default function App() {
  return (
    <div>
      {/* Header */}
      <div style={HEADER_STYLE}>
        <div>
          <span style={{ color: '#4ec9b0', fontWeight: 'bold', fontSize: 14, letterSpacing: '0.1em' }}>SENTINAL</span>
          <span style={{ color: '#555', marginLeft: 12, fontSize: 11 }}>Security Operations Dashboard</span>
        </div>
        <div style={{ fontSize: 11, color: '#555' }}>
          Gateway: <span style={{ color: '#888' }}>http://localhost:3000</span>
        </div>
      </div>

      <div style={LAYOUT_STYLE}>
        {/* Row 1 */}
        <div style={{ ...ROW_STYLE, marginBottom: 16 }}>
          <SystemStatus />
          <StatsPanel />
        </div>

        {/* Row 2 */}
        <LiveAttackFeed />

        {/* Row 3 */}
        <AlertsPanel />
      </div>
    </div>
  );
}
