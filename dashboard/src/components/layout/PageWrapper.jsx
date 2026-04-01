/**
 * PageWrapper — page entrance animation.
 * Upgraded in Phase 5 with smoother spring-like easing
 * and will-change hint for GPU compositing.
 */
import React from 'react';

export default function PageWrapper({ children, className = '' }) {
  return (
    <div className={`page-enter ${className}`}>
      {children}
    </div>
  );
}

// Inject keyframe once
if (typeof document !== 'undefined') {
  const id = '__sentinal-page-enter';
  if (!document.getElementById(id)) {
    const s = document.createElement('style');
    s.id = id;
    s.textContent = `
      .page-enter {
        animation: pageEnter 0.25s cubic-bezier(0.22,1,0.36,1) both;
        will-change: opacity, transform;
      }
      @keyframes pageEnter {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(s);
  }
}
