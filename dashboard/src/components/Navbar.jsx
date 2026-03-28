/**
 * Navbar — live badge counters for Alerts (unread) and Action Queue (pending)
 */
import { useEffect, useState, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { getAlerts, getPendingActions } from '../services/api';

const BASE_LINKS = [
  { to: '/dashboard',    label: 'Dashboard' },
  { to: '/explore',      label: '🧭 Explore',   badge: null, highlight: true },
  { to: '/attacks',      label: 'Attacks' },
  { to: '/alerts',       label: 'Alerts',        badge: 'alerts' },
  { to: '/logs',         label: 'Logs' },
  { to: '/pcap',         label: 'PCAP' },
  { to: '/action-queue', label: 'Action Queue',  badge: 'queue' },
  { to: '/audit',        label: 'Audit' },
  { to: '/services',     label: 'Services' },
  { to: '/simulate',     label: '⚔️ Simulate',   badge: null },
  { to: '/settings',     label: 'Settings' },
  { to: '/docs',         label: 'Docs' },
];

export default function Navbar() {
  const [unreadAlerts,  setUnreadAlerts]  = useState(0);
  const [pendingQueue,  setPendingQueue]  = useState(0);

  useEffect(() => {
    getAlerts(200)
      .then(data => setUnreadAlerts((data || []).filter(a => !a.isRead).length))
      .catch(() => {});
    getPendingActions()
      .then(data => setPendingQueue((data || []).length))
      .catch(() => {});
  }, []);

  useSocket('alert:new', useCallback(() => {
    setUnreadAlerts(n => n + 1);
  }, []));

  useSocket('action:pending', useCallback(() => {
    setPendingQueue(n => n + 1);
  }, []));

  const getBadge = (key) => {
    if (key === 'alerts' && unreadAlerts > 0)
      return <span style={styles.badgeRed}>{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>;
    if (key === 'queue'  && pendingQueue  > 0)
      return <span style={styles.badgeOrange}>{pendingQueue > 99 ? '99+' : pendingQueue}</span>;
    return null;
  };

  return (
    <nav style={styles.nav}>
      <span style={styles.brand}>SENTINAL</span>
      {BASE_LINKS.map(l => (
        <NavLink
          key={l.to}
          to={l.to}
          style={({ isActive }) => ({
            ...styles.link,
            color: l.to === '/simulate'
              ? (isActive ? '#ff4444' : '#ff8888')
              : l.highlight
              ? (isActive ? '#00d4aa' : '#00b894')
              : (isActive ? '#00d4aa' : '#aaa'),
            fontWeight: (l.to === '/simulate' || l.highlight) ? 700 : 'normal',
            background: l.highlight && !isActive
              ? 'rgba(0,212,170,0.08)'
              : 'transparent',
            padding:    l.highlight ? '3px 10px' : '3px 4px',
            borderRadius: l.highlight ? '4px' : 0,
            border: l.highlight ? '1px solid rgba(0,212,170,0.2)' : '1px solid transparent',
          })}
        >
          {l.label}
          {l.badge && getBadge(l.badge)}
        </NavLink>
      ))}
    </nav>
  );
}

const styles = {
  nav: {
    padding: '10px 20px',
    borderBottom: '1px solid #333',
    display: 'flex',
    gap: 16,
    alignItems: 'center',
    flexWrap: 'wrap',
    background: '#0d0d0d',
  },
  brand: { fontWeight: 'bold', marginRight: 8, color: '#00d4aa', fontSize: 15, letterSpacing: 1 },
  link:  { textDecoration: 'none', fontSize: 13, display: 'flex', alignItems: 'center', gap: 5, position: 'relative', transition: 'color 150ms ease' },
  badgeRed: {
    background: '#dc2626', color: '#fff', borderRadius: 9999,
    fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: 1.4,
  },
  badgeOrange: {
    background: '#ea580c', color: '#fff', borderRadius: 9999,
    fontSize: 10, fontWeight: 700, padding: '1px 6px', lineHeight: 1.4,
  },
};
