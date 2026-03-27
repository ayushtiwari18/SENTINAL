import React from 'react';

/**
 * PageWrapper — page entrance animation.
 * Uses CSS animation instead of framer-motion dependency
 * so it works before framer-motion is installed.
 * Will be upgraded to framer-motion in Phase 5.
 */
export default function PageWrapper({ children, className = '' }) {
  return (
    <div className={`page-enter ${className}`} style={styles.wrapper}>
      {children}
    </div>
  );
}

const styles = {
  wrapper: {
    animation: 'pageEnter 0.2s ease forwards',
  },
};

// Inject keyframe if not already present
if (typeof document !== 'undefined') {
  const id = '__sentinal-page-enter';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      @keyframes pageEnter {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }
}
