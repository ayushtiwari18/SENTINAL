import React from 'react';

/**
 * StatusDot — small colored dot with text label.
 * Props: status ('online'|'offline'|'degraded'), label (optional override)
 */
export default function StatusDot({ status = 'offline', label }) {
  const text = label || status;
  return (
    <span className={`status-dot ${status.toLowerCase()}`}>
      {text}
    </span>
  );
}
