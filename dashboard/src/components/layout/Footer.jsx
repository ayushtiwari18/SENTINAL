import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <span style={styles.left}>
        <span style={styles.brand}>SENTINAL</span>
        <span style={styles.sep}>©</span>
        <span>2026</span>
      </span>
      <nav style={styles.center}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/docs"      style={styles.link}>Docs</Link>
        <a
          href="https://github.com/ayushtiwari18/SENTINAL"
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          GitHub
        </a>
      </nav>
      <span style={styles.right}>Built for HackByte 4.0</span>
    </footer>
  );
}

const styles = {
  footer: {
    borderTop: '1px solid var(--color-border)',
    padding: 'var(--space-4) var(--space-5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 'var(--space-3)',
    background: 'var(--color-bg)',
    marginTop: 'auto',
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-muted)',
  },
  brand: {
    color: 'var(--color-accent)',
    fontWeight: 'var(--weight-semibold)',
    letterSpacing: 'var(--tracking-widest)',
    fontSize: 'var(--text-sm)',
  },
  sep: { color: 'var(--color-text-muted)' },
  center: {
    display: 'flex',
    gap: 'var(--space-4)',
  },
  link: {
    color: 'var(--color-text-muted)',
    fontSize: 'var(--text-sm)',
    textDecoration: 'none',
    transition: 'color var(--transition-fast)',
  },
  right: {
    fontSize: 'var(--text-sm)',
    color: 'var(--color-text-muted)',
  },
};
