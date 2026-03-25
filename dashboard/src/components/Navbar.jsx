import React from 'react';
import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/attacks',   label: 'Attacks' },
  { to: '/alerts',    label: 'Alerts' },
  { to: '/logs',      label: 'Logs' },
  { to: '/services',  label: 'Services' },
  { to: '/settings',  label: 'Settings' },
  { to: '/docs',      label: 'Docs' },
];

export default function Navbar() {
  return (
    <nav style={{ padding: '10px 20px', borderBottom: '1px solid #333', display: 'flex', gap: 20, alignItems: 'center' }}>
      <span style={{ fontWeight: 'bold', marginRight: 12 }}>SENTINAL</span>
      {LINKS.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({ color: isActive ? '#00d4aa' : '#aaa', textDecoration: 'none', fontSize: 13 })}
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
