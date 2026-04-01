import React from 'react';
import { STATUS_BADGE_CLASS } from '../../utils/constants';

/**
 * StatusBadge — colored status label.
 * Props: status ('blocked'|'successful'|'attempt'|'online'|'offline'|'degraded')
 */
export default function StatusBadge({ status }) {
  if (!status) return <span className="badge badge-neutral">—</span>;
  const cls = STATUS_BADGE_CLASS[status.toLowerCase()] || 'badge-neutral';
  const label = status.toLowerCase();
  return (
    <span className={`badge ${cls}`}>
      {label}
    </span>
  );
}
