/**
 * SkeletonLoader — animated shimmer placeholder.
 * Use <SkeletonLoader /> for a default table skeleton,
 * or compose with <SkeletonBlock h={n} w={n} /> for custom layouts.
 */
import React from 'react';

export function SkeletonBlock({ h = 16, w = '100%', radius = 6, className = '' }) {
  return (
    <div
      className={`skeleton-block ${className}`}
      style={{ height: h, width: w, borderRadius: radius }}
    />
  );
}

export function SkeletonRow({ cols = 6 }) {
  const widths = ['40%', '80px', '120px', '60px', '70px', '50px'];
  return (
    <tr className="skeleton-row">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '10px 12px' }}>
          <SkeletonBlock h={14} w={widths[i % widths.length]} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 8, cols = 6 }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <SkeletonBlock h={10} w={`${50 + (i * 17) % 50}%`} radius={4} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCards({ count = 4 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 'var(--space-3)',
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat-card">
          <SkeletonBlock h={12} w="60%" radius={4} style={{ marginBottom: 'var(--space-2)' }} />
          <SkeletonBlock h={32} w="50%" radius={6} />
        </div>
      ))}
    </div>
  );
}

// Default export: generic full-width skeleton
export default function SkeletonLoader({ rows = 8, cols = 6, type = 'table' }) {
  if (type === 'cards') return <SkeletonCards count={cols} />;
  return <SkeletonTable rows={rows} cols={cols} />;
}
