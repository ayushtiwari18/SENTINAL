import React from 'react';
import { SEVERITY_BADGE_CLASS } from '../../utils/constants';

/**
 * SeverityBadge — colored severity label.
 * Props: severity ('low'|'medium'|'high'|'critical')
 */
export default function SeverityBadge({ severity }) {
  if (!severity) return <span className="badge badge-neutral">—</span>;
  const cls = SEVERITY_BADGE_CLASS[severity.toLowerCase()] || 'badge-neutral';
  return (
    <span className={`badge ${cls}`}>
      {severity.toLowerCase()}
    </span>
  );
}
