/**
 * Navbar — SENTINAL command-center navigation.
 *
 * FIX 1: Removed `{({ isActive }) => isActive && <span style={styles.activeBar} />}`
 *         inside NavLink children. NavLink's render-prop pattern is NOT valid as a
 *         JSX child — React threw "Functions are not valid as a React child" which
 *         corrupted the entire component tree and prevented the ActionQueue modal
 *         overlay from receiving pointer events.
 *
 * FIX 2: Removed `'@media (max-width: 900px)': { display: 'flex' }` from
 *         mobileToggle inline style. React inline styles do not support media
 *         queries — use a <style> tag or CSS class instead.
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSocket }       from '../../hooks/useSocket';
import { getAlerts, getPendingActions } from '../../services/api';
import { NAV_LINKS } from '../../utils/constants';

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
  FileSearch: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="11" cy="15" r="2"/><line x1="13" y1="17" x2="15" y2="19"/>
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
  Activity: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
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
  Settings: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
  return C ? <C /> : null;
};

export default function Navbar() {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [pendingQueue, setPendingQueue] = useState(0);
  const [mobileOpen,  setMobileOpen]   = useState(false);
  const location = useLocation();
  const prevPath = useRef(location.pathname);

  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setMobileOpen(false);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  useEffect(() => {
    getAlerts(200)
      .then(data => setUnreadAlerts((data || []).filter(a => !a.isRead).length))
      .catch(() => {});
    getPendingActions()
      .then(data => setPendingQueue((data || []).length))
      .catch(() => {});
  }, []);

  useSocket('alert:new',      useCallback(() => setUnreadAlerts(n => n + 1), []));
  useSocket('action:pending', useCallback(() => setPendingQueue(n => n + 1), []));

  const getBadge = (badgeKey) => {
    if (badgeKey === 'alerts' && unreadAlerts > 0)
      return <span style={styles.badge(true)}>{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>;
    if (badgeKey === 'queue'  && pendingQueue  > 0)
      return <span style={styles.badge(false)}>{pendingQueue > 99 ? '99+' : pendingQueue}</span>;
    return null;
  };

  return (
    <>
      <style>{`
        .sentinal-mobile-toggle { display: none; }
        @media (max-width: 900px) { .sentinal-mobile-toggle { display: flex; } }
      `}</style>

      <nav style={styles.nav}>
        <NavLink to="/dashboard" style={styles.brand}>
          <span style={styles.brandIcon}><IconComponent name="Shield" /></span>
          <span style={styles.brandText}>SENTINAL</span>
        </NavLink>

        <span style={styles.brandDivider} />

        {/* FIX 1: removed {({ isActive }) => ...} render-prop child — was causing
            "Functions are not valid as a React child" and corrupting the tree.
            activeBar indicator removed; active state is handled by linkActive style. */}
        <div style={styles.links}>
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              style={({ isActive }) => ({
                ...styles.link,
                ...(isActive    ? styles.linkActive  : {}),
                ...(link.danger ? styles.linkDanger(isActive) : {}),
              })}
            >
              <span style={styles.linkIcon}>
                <IconComponent name={link.icon} />
              </span>
              <span>{link.label}</span>
              {link.badge && getBadge(link.badge)}
            </NavLink>
          ))}
        </div>

        <div style={styles.right}>
          <span className="live-indicator">LIVE</span>
          {/* FIX 2: moved responsive display to <style> tag above — inline styles
              do not support @media queries so it was silently ignored + warned. */}
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
    position: 'relative',
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
  badge: (isRed) => ({
    background: isRed ? 'var(--color-critical)' : 'var(--color-warning)',
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
