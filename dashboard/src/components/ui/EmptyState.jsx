import React from 'react';

/**
 * EmptyState — displayed when a list/table has 0 items.
 * Props: message (string), icon (ReactNode optional)
 */
export default function EmptyState({ message = 'No data', icon }) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-icon">{icon}</span>}
      <span className="empty-message">{message}</span>
    </div>
  );
}
