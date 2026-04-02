/**
 * Navbar — SENTINAL command-center navigation.
 * Reads all links from NAV_LINKS in utils/constants.js.
 * Supports badge keys: alerts | queue | blocklist
 * Supports link flags: danger | ai
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSocket }       from '../../hooks/useSocket';
import { getAlerts, getPendingActions, getBlocklist } from '../../services/api';
import { NAV_LINKS } from '../../utils/constants';

// ── SVG icon library ─────────────────────────────────────────────────────────────────
const icons = {
  LayoutDashboard: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Zap: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  Bell: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  ScrollText: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 0 1-4 0V5a2 2 0 0 0-2-2H4"/>
      <line x1="12" y1="9" x2="18" y2="9"/><line x1="12" y1="13" x2="18" y2="13"/>
    </svg>
  ),
  Globe: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Compass: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
    </svg>
  ),
  FileSearch: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="11" cy="15" r="2"/><line x1="13" y1="17" x2="15" y2="19"/>
    </svg>
  ),
  ShieldOff: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.69 14a6.9 6.9 0 0 0 .31-2V5l-8-3-3.16 1.18"/>
      <path d="M4.73 4.73L4 5v7c0 6 8 10 8 10a20.29 20.29 0 0 0 5.62-4.38"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ),
  ListChecks: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
      <polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>
    </svg>
  ),
  ClipboardList: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
    </svg>
  ),
  Sword: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/>
      <line x1="13" y1="19" x2="19" y2="13"/>
      <line x1="16" y1="16" x2="20" y2="20"/>
      <line x1="19" y1="21" x2="21" y2="19"/>
    </svg>
  ),
  Bot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/>
      <circle cx="12" cy="5" r="2"/>
      <path d="M12 7v4"/>
      <line x1="8" y1="16" x2="8" y2="16"/>
      <line x1="16" y1="16" x2="16" y2="16"/>
    </svg>
  ),
  Network: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1"/>
      <rect x="2" y="18" width="6" height="4" rx="1"/>
      <rect x="16" y="18" width="6" height="4" rx="1"/>
      <path d="M12 6v4M4 18v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/>
    </svg>
  ),
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Settings: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  BookOpen: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  Shield: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
};

const IconComponent = ({ name }) => {
  const C = icons[name];
  return C ? <C /> : <span style={{ width: 14, display: 'inline-block' }} />;
};

export default function Navbar() {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [pendingQueue, setPendingQueue] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [mobileOpen,   setMobileOpen]   = useState(false);
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  // Close mobile menu on route change
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setMobileOpen(false);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  // Fetch live badge counts
  useEffect(() => {
    getAlerts(200)
      .then(data => setUnreadAlerts((data || []).filter(a => !a.isRead).length))
      .catch(() => {});
    getPendingActions()
      .then(data => setPendingQueue((data || []).length))
      .catch(() => {});
    getBlocklist()
      .then(data => setBlockedCount((data || []).length))
      .catch(() => {});
  }, []);

  useSocket('alert:new',      useCallback(() => setUnreadAlerts(n => n + 1), []));
  useSocket('action:pending', useCallback(() => setPendingQueue(n => n + 1), []));

  const getBadge = (badgeKey) => {
    const counts = { alerts: unreadAlerts, queue: pendingQueue, blocklist: blockedCount };
    const n = counts[badgeKey] || 0;
    if (!n) return null;
    const isOrange = badgeKey === 'queue';
    return (
      <span style={styles.badge(isOrange ? false : true, isOrange)}>
        {n > 99 ? '99+' : n}
      </span>
    );
  };

  return (
    <>
      <style>{`
        .sentinal-mobile-toggle { display: none; }
        @media (max-width: 900px) {
          .sentinal-mobile-toggle { display: flex !important; }
          .sentinal-desktop-links { display: none !important; }
        }
      `}</style>

      <nav style={styles.nav}>
        {/* Brand */}
        <NavLink to="/dashboard" style={styles.brand}>
          <span style={styles.brandIcon}><IconComponent name="Shield" /></span>
          <span style={styles.brandText}>SENTINAL</span>
        </NavLink>

        <span style={styles.brandDivider} />

        {/* Desktop links */}
        <div className="sentinal-desktop-links" style={styles.links}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive    ? styles.linkActive  : {}),
                ...(link.danger ? styles.linkDanger(isActive) : {}),
                ...(link.ai && !isActive ? { color: 'var(--color-accent)', opacity: 0.8 } : {}),
              })}
            >
              <span style={styles.linkIcon}><IconComponent name={link.icon} /></span>
              <span>{link.label}</span>
              {link.badge && getBadge(link.badge)}
            </NavLink>
          ))}
        </div>

        {/* Right side: LIVE indicator + hamburger */}
        <div style={styles.right}>
          <span className="live-indicator">LIVE</span>
          <button
            className="sentinal-mobile-toggle"
            style={styles.mobileToggle}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen
                ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>
              }
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div style={styles.mobileMenu}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                ...styles.mobileLink,
                ...(isActive    ? styles.mobileLinkActive : {}),
                ...(link.danger ? { color: 'var(--color-critical)' } : {}),
                ...(link.ai && !isActive ? { color: 'var(--color-accent)', opacity: 0.85 } : {}),
              })}
            >
              <span style={styles.linkIcon}><IconComponent name={link.icon} /></span>
              <span>{link.label}</span>
              {link.badge && getBadge(link.badge)}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

const styles = {
  nav: {
    position: 'sticky',
    top: 0,
    zIndex: 'var(--z-sticky)',
    height: 'var(--navbar-height)',
    background: 'rgba(10,10,10,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 var(--space-5)',
    gap: 'var(--space-3)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    textDecoration: 'none',
    flexShrink: 0,
  },
  brandIcon: { color: 'var(--color-accent)', display: 'flex', alignItems: 'center' },
  brandText: {
    fontWeight: 'var(--weight-bold)',
    fontSize: 'var(--text-base)',
    color: 'var(--color-accent)',
    letterSpacing: 'var(--tracking-widest)',
    fontFamily: 'var(--font-mono)',
  },
  brandDivider: {
    width: '1px',
    height: '18px',
    background: 'var(--color-border-strong)',
    flexShrink: 0,
    marginRight: 'var(--space-1)',
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    flex: 1,
    overflow: 'hidden',
    flexWrap: 'nowrap',
  },
  link: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '5px 9px',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-base)',
    fontWeight: 'var(--weight-medium)',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 150ms ease, background 150ms ease',
  },
  linkActive: {
    color: 'var(--color-accent)',
    background: 'var(--color-accent-dim)',
  },
  linkDanger: (isActive) => ({
    color: isActive ? 'var(--color-critical)' : '#ff8888',
    background: isActive ? 'var(--color-critical-dim)' : 'transparent',
  }),
  linkIcon: { display: 'flex', alignItems: 'center', opacity: 0.7 },
  badge: (isRed, isOrange) => ({
    background: isOrange
      ? 'var(--color-warning)'
      : 'var(--color-critical)',
    color: '#fff',
    borderRadius: 'var(--radius-full)',
    fontSize: 'var(--text-xs)',
    fontWeight: 'var(--weight-bold)',
    padding: '1px 5px',
    lineHeight: 1.4,
    fontFamily: 'var(--font-mono)',
    minWidth: '16px',
    textAlign: 'center',
  }),
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    marginLeft: 'auto',
    flexShrink: 0,
  },
  mobileToggle: {
    background: 'none',
    border: 'none',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: 'var(--space-1)',
    borderRadius: 'var(--radius-md)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileMenu: {
    position: 'sticky',
    top: 'var(--navbar-height)',
    zIndex: 'var(--z-sticky)',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--space-2)',
    gap: '2px',
    maxHeight: '80vh',
    overflowY: 'auto',
  },
  mobileLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--text-md)',
    fontWeight: 'var(--weight-medium)',
    color: 'var(--color-text-secondary)',
    textDecoration: 'none',
  },
  mobileLinkActive: {
    color: 'var(--color-accent)',
    background: 'var(--color-accent-dim)',
  },
};
