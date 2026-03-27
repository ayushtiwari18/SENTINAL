import React from 'react';

/**
 * Panel — reusable bordered container with optional header.
 * Props:
 *   title     — string | ReactNode
 *   actions   — ReactNode (right side of header)
 *   children  — body content
 *   flush     — bool: no body padding (for tables)
 *   className — extra CSS class on wrapper
 *   accent    — bool: adds left accent border
 *   style     — inline style override
 */
export default function Panel({
  title,
  actions,
  children,
  flush = false,
  className = '',
  accent = false,
  style = {},
}) {
  return (
    <div
      className={`panel ${className}`}
      style={{
        ...(accent ? { borderLeft: '2px solid var(--color-accent)' } : {}),
        ...style,
      }}
    >
      {(title || actions) && (
        <div className="panel-header">
          {title && (
            typeof title === 'string'
              ? <span className="panel-title">{title}</span>
              : title
          )}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className={flush ? 'panel-body-flush' : 'panel-body'}>
        {children}
      </div>
    </div>
  );
}
