'use client';

import type {
  CommercialDataSource,
  CommercialDiagnosis,
  CommercialDiagnosisRecommended,
  ConfidenceStatus,
  ProvenanceEntry,
} from '@/lib/commercial-diagnosis/api';
import { ProvenanceBadge } from './ProvenanceBadge';

interface RecommendedGoalCardProps {
  recommended: CommercialDiagnosisRecommended;
  diagnosis: CommercialDiagnosis;
}

const RECOMMENDED_FALLBACK_OPPORTUNITY =
  'Actualmente tienes mayor demanda entre jueves y domingo, pero existe capacidad disponible durante los primeros días de la semana.';

const CONFIDENCE_LABEL: Record<ConfidenceStatus, string> = {
  SUPPORTED: 'Soportado por evidencia',
  TESTABLE: 'A prueba',
  UNLIKELY: 'Probablemente inviable',
  INSUFFICIENT_DATA: 'Datos insuficientes',
};

const CONFIDENCE_TONE: Record<
  ConfidenceStatus,
  { background: string; color: string; border: string }
> = {
  SUPPORTED: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  TESTABLE: { background: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  INSUFFICIENT_DATA: {
    background: '#fef3c7',
    color: '#92400e',
    border: '#fde68a',
  },
  UNLIKELY: { background: '#fee2e2', color: '#991b1b', border: '#fecaca' },
};

function getSourceFor(
  field: keyof CommercialDiagnosisRecommended,
  diagnosis: CommercialDiagnosis,
): CommercialDataSource | null {
  const recommendedEntry: ProvenanceEntry | undefined = (
    diagnosis.strategy?.provenance ?? {}
  )[field];
  if (recommendedEntry && recommendedEntry.source) {
    return recommendedEntry.source;
  }
  return null;
}

export function RecommendedGoalCard({
  recommended,
  diagnosis,
}: RecommendedGoalCardProps) {
  const situation = recommended.situation?.trim();
  const opportunity =
    recommended.opportunity?.trim() || RECOMMENDED_FALLBACK_OPPORTUNITY;
  const recommendedTitle =
    recommended.recommendedTitle?.trim() ||
    'Plan basado en diagnóstico';
  const recommendedWeeklyAdd = recommended.recommendedWeeklyAdd;
  const progressionSteps = diagnosis.strategy?.progressionSteps ?? [];

  const situationSource = getSourceFor('situation', diagnosis);
  const opportunitySource = getSourceFor('opportunity', diagnosis);
  const goalSource = getSourceFor('primaryGoal', diagnosis);

  return (
    <article
      data-testid="cdf-result-card"
      aria-label="Meta propuesta"
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '1rem',
        background: '#ffffff',
        display: 'grid',
        gap: '1rem',
      }}
    >
      <header style={{ display: 'grid', gap: '0.4rem' }}>
        <span style={{ color: '#166534', fontSize: '0.85rem', fontWeight: 600 }}>
          Detectamos una oportunidad
        </span>
        <h3
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '1.15rem',
            lineHeight: 1.3,
          }}
        >
          {recommendedTitle}
        </h3>
      </header>

      <section
        aria-label="Situación actual"
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px solid #e4e7eb',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
            Situación
          </strong>
          {situationSource ? (
            <ProvenanceBadge source={situationSource} />
          ) : null}
        </div>
        <p
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          {situation || 'No pudimos resumir la situación actual.'}
        </p>
      </section>

      <section
        aria-label="Oportunidad detectada"
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: '#166534', fontSize: '0.95rem' }}>
            Oportunidad
          </strong>
          {opportunitySource ? (
            <ProvenanceBadge source={opportunitySource} />
          ) : null}
        </div>
        <p
          style={{
            margin: 0,
            color: '#166534',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          {opportunity}
        </p>
      </section>

      <section
        aria-label="Próxima meta propuesta"
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e4e7eb',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
            Próxima meta propuesta
          </strong>
          {goalSource ? <ProvenanceBadge source={goalSource} /> : null}
          {recommended.goalConfidence ? (
            <span
              data-testid="cdf-goal-confidence-badge"
              data-status={recommended.goalConfidence}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.2rem 0.6rem',
                borderRadius: '999px',
                background:
                  CONFIDENCE_TONE[recommended.goalConfidence].background,
                color: CONFIDENCE_TONE[recommended.goalConfidence].color,
                border: `1px solid ${CONFIDENCE_TONE[recommended.goalConfidence].border}`,
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              Confianza: {CONFIDENCE_LABEL[recommended.goalConfidence]}
            </span>
          ) : null}
        </div>
        <p
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          {recommendedWeeklyAdd !== null && recommendedWeeklyAdd !== undefined ? (
            `Conseguir inicialmente ${recommendedWeeklyAdd} reservas adicionales por semana.`
          ) : (
            <>
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  marginRight: '0.4rem',
                  color: '#92400e',
                }}
              >
                ℹ︎
              </span>
              Sin meta semanal recomendada por falta de evidencia histórica.
            </>
          )}
        </p>
        {recommendedWeeklyAdd !== null && recommendedWeeklyAdd !== undefined ? (
          <p
            style={{
              margin: 0,
              color: '#52606d',
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}
          >
            Esto permitiría comenzar utilizando parte de tu capacidad disponible
            y medir cuánto cuesta generar una nueva reserva antes de intentar
            ocupar toda la disponibilidad.
          </p>
        ) : null}
      </section>

      <section
        aria-label="Si funciona"
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#ffffff',
          border: '1px solid #e4e7eb',
        }}
      >
        <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
          Si funciona
        </strong>
        <p
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}
        >
          Podremos aumentar progresivamente el objetivo hasta acercarnos a la
          capacidad disponible.
        </p>
        {progressionSteps.length > 0 ? (
          <ul
            aria-label="Progresión sugerida"
            style={{
              margin: '0.25rem 0 0',
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}
          >
            {progressionSteps.map((step, index) => (
              <li
                key={`${step}-${index}`}
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background: '#e0e7ff',
                  color: '#3730a3',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {step}/semana
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {diagnosis.strategy?.primaryKpi ? (
        <section
          aria-label="Cómo vamos a medir"
          style={{
            display: 'grid',
            gap: '0.25rem',
          }}
        >
          <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
            Cómo vamos a medir
          </strong>
          <p
            style={{
              margin: 0,
              color: '#1f2933',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            {diagnosis.strategy.primaryKpi}
          </p>
        </section>
      ) : null}
    </article>
  );
}