'use client';

import type { GlossaryEntry } from '@/lib/content/marketing-glossary';

export type NumericStatus = 'ok' | 'warn' | 'info';

export interface MetricDelta {
  value: string;
  label: string;
  favorable: 'up' | 'down' | 'flat';
}

export interface MetricCardProps {
  label: string;
  value: string;
  term?: GlossaryEntry;
  formula?: string;
  delta?: MetricDelta;
  numericStatus?: NumericStatus;
}

export function MetricCard({
  label,
  value,
  delta,
  numericStatus = 'info',
}: MetricCardProps) {
  const deltaExplanation = delta ? describeDelta(delta) : null;

  return (
    <article
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '1rem',
        background: '#ffffff',
        display: 'grid',
        gap: '0.5rem',
        minWidth: '200px',
      }}
    >
      <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>{label}</p>
      <p
        aria-live="polite"
        style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#1f2933' }}
      >
        {value}
      </p>
      {delta && deltaExplanation ? (
        <p
          style={{
            margin: 0,
            color: delta.favorable === 'down' ? '#991b1b' : delta.favorable === 'up' ? '#065f46' : '#52606d',
            fontSize: '0.85rem',
          }}
        >
          <span aria-hidden="true" style={{ marginRight: '0.25rem' }}>
            {delta.favorable === 'up' ? '▲' : delta.favorable === 'down' ? '▼' : '◆'}
          </span>
          <span>
            {delta.value} — {deltaExplanation}
          </span>
        </p>
      ) : null}
      <span
        aria-hidden="true"
        style={{ display: 'none' }}
        data-numeric-status={numericStatus}
      >
        {numericStatus}
      </span>
    </article>
  );
}

function describeDelta(delta: MetricDelta): string {
  if (delta.favorable === 'down') {
    return `${delta.label} — peor que el período anterior`;
  }
  if (delta.favorable === 'up') {
    return `${delta.label} — mejor que el período anterior`;
  }
  return `${delta.label} — sin cambio respecto al período anterior`;
}
