/**
 * LoadingState — upgraded to use SkeletonLoader by default.
 * Falls back to simple spinner text only when explicitly requested.
 */
import React from 'react';
import SkeletonLoader from './SkeletonLoader';

export default function LoadingState({
  message,
  skeleton = true,
  rows = 6,
  cols = 5,
  type = 'table',
}) {
  if (skeleton && !message) {
    return <SkeletonLoader rows={rows} cols={cols} type={type} />;
  }
  return (
    <div className="loading-state">
      <span className="loading-spinner" />
      {message || 'Loading…'}
    </div>
  );
}
