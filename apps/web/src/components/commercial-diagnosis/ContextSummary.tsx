'use client';

import type { CommercialDiagnosis, CommercialDiagnosisStrategy } from '@/lib/commercial-diagnosis/api';

interface ContextSummaryProps {
  diagnosis: CommercialDiagnosis;
  strategy: CommercialDiagnosisStrategy | null;
}

interface SummaryItem {
  label: string;
  value: string | number;
}

function buildSummaryItems(
  diagnosis: CommercialDiagnosis,
  strategy: CommercialDiagnosisStrategy | null,
): SummaryItem[] {
  const items: SummaryItem[] = [];

  if (diagnosis.recommended.availableCapacity && diagnosis.recommended.availableCapacity > 0) {
    items.push({
      label: 'Capacidad semanal registrada',
      value: `${diagnosis.recommended.availableCapacity} servicios por semana`,
    });
  }

  const customerProfile = strategy?.idealCustomerProfile?.trim();
  if (customerProfile) {
    items.push({ label: 'Cliente ideal', value: customerProfile });
  }

  if (strategy && strategy.qualifyingQuestions.length > 0) {
    items.push({
      label: 'Preguntas de calificación',
      value: strategy.qualifyingQuestions.slice(0, 3).join(' · '),
    });
  }

  if (strategy && strategy.constraints.length > 0) {
    items.push({
      label: 'Restricciones',
      value: strategy.constraints.slice(0, 3).join(' · '),
    });
  }

  if (diagnosis.recommended.primaryConversion) {
    items.push({
      label: 'Conversión principal',
      value: diagnosis.recommended.primaryConversion,
    });
  }

  return items;
}

export function ContextSummary({ diagnosis, strategy }: ContextSummaryProps) {
  const items = buildSummaryItems(diagnosis, strategy);
  if (items.length === 0) {
    return null;
  }
  return (
    <section
      data-testid="cdf-context-summary"
      aria-label="Lo que ya sabemos del negocio"
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '1rem',
        background: '#ffffff',
        display: 'grid',
        gap: '0.75rem',
      }}
    >
      <header>
        <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
          Lo que ya sabemos del negocio
        </strong>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
          Contexto que ya cargaste en tu perfil y que la IA está usando.
        </p>
      </header>
      <dl
        style={{
          display: 'grid',
          gap: '0.5rem',
          margin: 0,
        }}
      >
        {items.map((item) => (
          <div
            key={item.label}
            style={{
              display: 'grid',
              gap: '0.15rem',
              paddingBottom: '0.5rem',
              borderBottom: '1px solid #e4e7eb',
            }}
          >
            <dt
              style={{
                margin: 0,
                fontSize: '0.75rem',
                color: '#52606d',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {item.label}
            </dt>
            <dd
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.4,
              }}
            >
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}