import React from 'react';

/**
 * LoadingState — pulsing text indicator. No spinner.
 * Props: message (string)
 */
export default function LoadingState({ message = 'Loading...' }) {
  return (
    <div className="loading-state">{message}</div>
  );
}
