/**
 * ActionQueuePage — redesigned with design system.
 * Warning banner preserved, ActionQueue component renders inside Panel.
 */
import React from 'react';
import ActionQueue from '../components/ActionQueue';
import Panel       from '../components/ui/Panel';
import PageWrapper from '../components/layout/PageWrapper';

export default function ActionQueuePage() {
  return (
    <PageWrapper>
      <div className="page-container">

        <div className="page-header">
          <div className="page-title-group">
            <h1 className="page-title">ArmorIQ Action Queue</h1>
            <p className="page-subtitle">
              Actions blocked by ArmorIQ policy that require human review before execution.
              Only{' '}
              <strong style={{ color: 'var(--color-critical)' }}>high-risk and critical</strong>
              {' '}actions appear here. Low-risk actions execute automatically.
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div style={styles.warningBanner}>
          <span style={styles.warningIcon}>⚠️</span>
          <span>
            These actions were proposed by ArmorIQ but{' '}
            <strong>blocked by policy</strong> before execution.
            Review carefully before approving.
          </span>
        </div>

        <ActionQueue />
      </div>
    </PageWrapper>
  );
}

const styles = {
  warningBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 'var(--space-3)',
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--color-warning)',
    borderRadius: 'var(--radius-lg)',
    background: 'rgba(255,167,38,0.07)',
    color: 'var(--color-warning)',
    fontSize: 'var(--text-base)',
    marginBottom: 'var(--space-4)',
  },
  warningIcon: { flexShrink: 0, fontSize: '16px' },
};
