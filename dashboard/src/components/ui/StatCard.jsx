import React, { useEffect, useRef, useState } from 'react';

/**
 * StatCard — metric card with animated count-up.
 * Props:
 *   label   — string
 *   value   — number | string
 *   icon    — ReactNode (optional)
 *   color   — CSS color string for value
 *   delta   — string (optional sub-label)
 *   accent  — bool: adds teal accent line at top
 */
function useCountUp(target, duration = 900) {
  const [count, setCount] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const num = typeof target === 'number' ? target : parseFloat(target);
    if (isNaN(num)) { setCount(target); return; }
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutQuart
      const ease = 1 - Math.pow(1 - progress, 4);
      setCount(Math.round(ease * num));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return count;
}

export default function StatCard({ label, value, icon, color, delta, accent = false }) {
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && !isNaN(parseFloat(value)));
  const displayValue = isNumeric ? useCountUp(typeof value === 'number' ? value : parseFloat(value)) : value;

  return (
    <div
      className="stat-card"
      style={accent ? { borderTop: '2px solid var(--color-accent)' } : {}}
    >
      {icon && <div className="stat-icon">{icon}</div>}
      <div className="stat-label">{label}</div>
      <div
        className="stat-value"
        style={color ? { color } : {}}
      >
        {displayValue ?? '—'}
      </div>
      {delta && <div className="stat-delta">{delta}</div>}
    </div>
  );
}
