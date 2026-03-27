/**
 * Sidebar — responsive mobile upgrade.
 * Phase 5: adds mobile-nav-toggle (hamburger), backdrop overlay,
 * and slide-in animation on mobile via CSS class toggling.
 * Desktop: no change to layout.
 */
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/',              label: 'Dashboard',     icon: '⊞' },
  { to: '/attacks',       label: 'Attacks',       icon: '🛡' },
  { to: '/alerts',        label: 'Alerts',        icon: '🔔' },
  { to: '/logs',          label: 'Logs',          icon: '📋' },
  { to: '/services',      label: 'Services',      icon: '⚙' },
  { to: '/action-queue',  label: 'Action Queue',  icon: '⚡' },
  { to: '/audit-log',     label: 'Audit Log',     icon: '📜' },
  { to: '/simulate',      label: 'Simulator',     icon: '⚔' },
  { to: '/pcap',          label: 'PCAP',          icon: '📡' },
  { to: '/settings',      label: 'Settings',      icon: '⚙️' },
];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className="mobile-nav-toggle btn btn-icon"
        onClick={() => setOpen(o => !o)}
        aria-label="Toggle navigation"
        style={styles.hamburger}
      >
        {open ? '✕' : '☰'}
      </button>

      {/* Backdrop */}
      <div
        className={`sidebar-backdrop${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <nav
        className={`sidebar${open ? ' open' : ''}`}
        style={styles.sidebar}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⚔</span>
          <div>
            <div style={styles.logoName}>SENTINAL</div>
            <div style={styles.logoSub}>by ArmorIQ</div>
          </div>
        </div>

        {/* Nav */}
        <div style={styles.navList}>
          {NAV_ITEMS.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              })}
            >
              <span style={styles.navIcon}>{icon}</span>
              <span style={styles.navLabel}>{label}</span>
            </NavLink>
          ))}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <span style={styles.footerVersion}>v1.0.0</span>
          <span style={styles.footerEvent}>HackByte 4.0</span>
        </div>
      </nav>
    </>
  );
}

const styles = {
  hamburger: {
    position: 'fixed',
    top: 'var(--space-3)',
    left: 'var(--space-3)',
    zIndex: 'calc(var(--z-drawer) + 1)',
    fontSize: '18px',
    padding: '6px 8px',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    height: '100vh',
    background: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-4) var(--space-4)',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: 'var(--space-2)',
  },
  logoIcon: { fontSize: '22px' },
  logoName: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 'var(--weight-bold)',
    fontSize: 'var(--text-base)',
    color: 'var(--color-text)',
    letterSpacing: 'var(--tracking-widest)',
  },
  logoSub: {
    fontSize: 'var(--text-xs)',
    color: 'var(--color-accent)',
    letterSpacing: 'var(--tracking-wide)',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 var(--space-2)',
    flex: 1,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--color-text-secondary)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--weight-normal)',
    textDecoration: 'none',
    transition: 'background var(--transition-fast), color var(--transition-fast)',
    userSelect: 'none',
  },
  navItemActive: {
    background: 'var(--color-accent-dim)',
    color: 'var(--color-accent)',
    fontWeight: 'var(--weight-medium)',
  },
  navIcon:  { fontSize: '15px', flexShrink: 0, width: '18px', textAlign: 'center' },
  navLabel: { flex: 1 },
  footer: {
    padding: 'var(--space-4)',
    borderTop: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  footerVersion: { fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' },
  footerEvent:   { fontSize: 'var(--text-xs)', color: 'var(--color-accent)' },
};
