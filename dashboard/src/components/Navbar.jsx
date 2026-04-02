/**
 * Navbar — Fully responsive with grouped dropdown sections.
 * Groups: Monitor | Investigate | Enforce | AI | System
 * Mobile: hamburger menu collapses all links.
 * Live badge counters for Alerts, Action Queue, Blocklist.
 *
 * Responsive strategy:
 *   - Desktop (≥769px): grouped dropdown buttons shown, hamburger hidden (CSS)
 *   - Mobile (<769px): grouped buttons hidden, hamburger shown (CSS)
 *   - data-sentinal-desktop  → hidden on mobile via injected <style>
 *   - data-sentinal-hamburger → hidden on desktop via injected <style>
 *   - data-sentinal-mobile-menu → hidden on desktop via injected <style>
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { getAlerts, getPendingActions, getBlocklist } from '../services/api';

// Inject responsive CSS once
if (typeof document !== 'undefined' && !document.getElementById('sentinal-navbar-css')) {
  const el = document.createElement('style');
  el.id = 'sentinal-navbar-css';
  el.textContent = `
    [data-sentinal-desktop]     { display: flex; }
    [data-sentinal-hamburger]   { display: none; }
    [data-sentinal-mobile-menu] { display: none; }
    @media (max-width: 768px) {
      [data-sentinal-desktop]     { display: none !important; }
      [data-sentinal-hamburger]   { display: flex !important; }
      [data-sentinal-mobile-menu] { display: block !important; }
    }
    [data-sentinal-hamburger] {
      background: transparent;
      border: 1px solid #333;
      color: #aaa;
      font-size: 18px;
      cursor: pointer;
      border-radius: 6px;
      padding: 4px 10px;
      line-height: 1;
      align-items: center;
      justify-content: center;
    }
    [data-sentinal-drop-link]:hover { background: rgba(255,255,255,0.05) !important; }
    [data-sentinal-group-btn]:hover  { border-color: #555 !important; color: #ddd !important; }
  `;
  document.head.appendChild(el);
}

// ── Nav groups ──────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Monitor',
    icon: '📡',
    links: [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/attacks',   label: 'Attacks' },
      { to: '/alerts',    label: 'Alerts',    badge: 'alerts' },
      { to: '/logs',      label: 'Logs' },
      { to: '/geo',       label: '🌍 Geo IP Map' },
    ],
  },
  {
    label: 'Investigate',
    icon: '🔍',
    links: [
      { to: '/explore',     label: '🧯 Explore' },
      { to: '/correlation', label: '🔗 Correlation' },
      { to: '/pcap',        label: '📦 PCAP Analyzer' },
    ],
  },
  {
    label: 'Enforce',
    icon: '🛡️',
    links: [
      { to: '/blocklist',    label: '🚫 IP Blocklist',     badge: 'blocklist' },
      { to: '/action-queue', label: '⏳ Action Queue',    badge: 'queue' },
      { to: '/audit',        label: '📜 Audit Log' },
      { to: '/simulate',     label: '⚔️ Simulate Attack', danger: true },
    ],
  },
  {
    label: 'AI',
    icon: '🤖',
    links: [
      { to: '/copilot',     label: '🧠 AI Copilot',    highlight: true },
      { to: '/correlation', label: '🔗 Correlation AI', highlight: true },
    ],
  },
  {
    label: 'System',
    icon: '⚙️',
    links: [
      { to: '/services', label: '🔌 Services' },
      { to: '/settings', label: '⚙️ Settings' },
      { to: '/docs',     label: '📖 Docs' },
    ],
  },
];

export default function Navbar() {
  const [unreadAlerts, setUnreadAlerts] = useState(0);
  const [pendingQueue, setPendingQueue] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);
  const [openGroup, setOpenGroup]           = useState(null);
  const [mobileOpen, setMobileOpen]         = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState({});
  const navRef  = useRef(null);
  const location = useLocation();

  // Close everything on route change
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [location.pathname]);

  // Close desktop dropdown when clicking outside nav
  useEffect(() => {
    const handler = (e) => {
      if (navRef.current && !navRef.current.contains(e.target))
        setOpenGroup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch badge counts
  useEffect(() => {
    getAlerts(200)
      .then(d => setUnreadAlerts((d || []).filter(a => !a.isRead).length))
      .catch(() => {});
    getPendingActions()
      .then(d => setPendingQueue((d || []).length))
      .catch(() => {});
    getBlocklist()
      .then(d => setBlockedCount((d || []).length))
      .catch(() => {});
  }, []);

  useSocket('alert:new',     useCallback(() => setUnreadAlerts(n => n + 1), []));
  useSocket('action:pending', useCallback(() => setPendingQueue(n => n + 1), []));

  const getBadgeCount = (key) => {
    if (key === 'alerts')    return unreadAlerts;
    if (key === 'queue')     return pendingQueue;
    if (key === 'blocklist') return blockedCount;
    return 0;
  };

  const groupTotal = (group) =>
    group.links.reduce((s, l) => s + (l.badge ? getBadgeCount(l.badge) : 0), 0);

  const Badge = ({ count, orange }) =>
    count > 0 ? (
      <span style={orange ? S.badgeOrange : S.badgeRed}>
        {count > 99 ? '99+' : count}
      </span>
    ) : null;

  // ── Desktop grouped dropdowns ────────────────────────────────────────────
  const desktopGroups = NAV_GROUPS.map(group => {
    const total  = groupTotal(group);
    const isOpen = openGroup === group.label;
    return (
      <div key={group.label} style={S.groupWrap}>
        <button
          data-sentinal-group-btn
          style={{ ...S.groupBtn, ...(isOpen ? S.groupBtnActive : {}) }}
          onClick={() => setOpenGroup(isOpen ? null : group.label)}
        >
          {group.icon} {group.label}
          <Badge count={total} orange={false} />
          <span style={{ fontSize: 9, opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
        </button>

        {isOpen && (
          <div style={S.dropdown}>
            {group.links.map(l => {
              const cnt = l.badge ? getBadgeCount(l.badge) : 0;
              return (
                <NavLink
                  key={l.to}
                  to={l.to}
                  data-sentinal-drop-link
                  style={({ isActive }) => ({
                    ...S.dropLink,
                    color: l.danger
                      ? (isActive ? '#ff4444' : '#ff8888')
                      : l.highlight
                      ? (isActive ? '#00d4aa' : '#00b894')
                      : (isActive ? '#00d4aa' : '#ccc'),
                    background: isActive ? 'rgba(0,212,170,0.10)' : 'transparent',
                    borderLeft: isActive ? '2px solid #00d4aa' : '2px solid transparent',
                  })}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {l.label}
                    <Badge count={cnt} orange={l.badge === 'queue'} />
                  </span>
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  });

  // ── Mobile full menu ──────────────────────────────────────────────────────────
  const mobileMenu = mobileOpen && (
    <div data-sentinal-mobile-menu style={S.mobileMenu}>
      {NAV_GROUPS.map(group => (
        <div key={group.label}>
          <button
            style={S.mobileGroupBtn}
            onClick={() =>
              setMobileExpanded(p => ({ ...p, [group.label]: !p[group.label] }))
            }
          >
            <span>{group.icon} {group.label}</span>
            <span style={{ fontSize: 10, opacity: 0.6 }}>
              {mobileExpanded[group.label] ? '▲' : '▼'}
            </span>
          </button>

          {mobileExpanded[group.label] && (
            <div style={S.mobileLinks}>
              {group.links.map(l => {
                const cnt = l.badge ? getBadgeCount(l.badge) : 0;
                return (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    style={({ isActive }) => ({
                      ...S.mobileLink,
                      color: l.danger
                        ? (isActive ? '#ff4444' : '#ff8888')
                        : l.highlight
                        ? (isActive ? '#00d4aa' : '#00b894')
                        : (isActive ? '#00d4aa' : '#bbb'),
                      background: isActive ? 'rgba(0,212,170,0.07)' : 'transparent',
                    })}
                  >
                    {l.label}
                    <Badge count={cnt} orange={l.badge === 'queue'} />
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <nav ref={navRef} style={S.nav}>
        {/* Brand */}
        <NavLink to="/dashboard" style={{ textDecoration: 'none' }}>
          <span style={S.brand}>⬡ SENTINAL</span>
        </NavLink>

        {/* Desktop grouped dropdowns */}
        <div data-sentinal-desktop style={S.desktopRow}>
          {desktopGroups}
        </div>

        {/* Hamburger (mobile only) */}
        <button
          data-sentinal-hamburger
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile slide-down menu */}
      {mobileOpen && (
        <div data-sentinal-mobile-menu>
          {mobileMenu}
        </div>
      )}
    </>
  );
}

// ── Static styles (no @media here — all responsive via injected CSS above) ──────
const S = {
  nav: {
    padding: '0 20px',
    borderBottom: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#0a0a0a',
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    height: 50,
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  },
  brand: {
    fontWeight: 800,
    color: '#00d4aa',
    fontSize: 15,
    letterSpacing: 2,
    userSelect: 'none',
  },
  desktopRow: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  groupWrap: {
    position: 'relative',
  },
  groupBtn: {
    background: 'transparent',
    border: '1px solid #2a2a2a',
    borderRadius: 6,
    color: '#999',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    padding: '5px 11px',
    transition: 'all 150ms ease',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  },
  groupBtnActive: {
    color: '#00d4aa',
    borderColor: '#00d4aa',
    background: 'rgba(0,212,170,0.08)',
  },
  dropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    background: '#111',
    border: '1px solid #2a2a2a',
    borderRadius: 8,
    minWidth: 190,
    zIndex: 2000,
    padding: '4px 0',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
  },
  dropLink: {
    display: 'block',
    padding: '9px 16px',
    fontSize: 13,
    textDecoration: 'none',
    transition: 'background 100ms, border-left 100ms',
    cursor: 'pointer',
  },
  mobileMenu: {
    background: '#0d0d0d',
    borderBottom: '1px solid #1e1e1e',
    padding: '4px 16px 14px',
  },
  mobileGroupBtn: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #1c1c1c',
    color: '#aaa',
    fontSize: 13,
    fontWeight: 600,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '11px 2px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  mobileLinks: {
    paddingLeft: 14,
    paddingBottom: 2,
  },
  mobileLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '9px 4px',
    fontSize: 13,
    textDecoration: 'none',
    borderBottom: '1px solid #161616',
    transition: 'background 100ms',
  },
  badgeRed: {
    background: '#dc2626',
    color: '#fff',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
    lineHeight: 1.4,
    flexShrink: 0,
  },
  badgeOrange: {
    background: '#ea580c',
    color: '#fff',
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
    lineHeight: 1.4,
    flexShrink: 0,
  },
};
