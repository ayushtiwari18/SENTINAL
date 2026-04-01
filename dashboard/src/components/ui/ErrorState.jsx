import React from 'react';

/**
 * ErrorState — error message with optional retry button.
 * Props: message (string), onRetry (fn optional)
 */
export default function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <span>⚠ {message || 'An error occurred.'}</span>
      {onRetry && (
        <button className="btn btn-sm btn-ghost" onClick={onRetry} style={{ marginLeft: 'auto' }}>
          Retry
        </button>
      )}
    </div>
  );
}
