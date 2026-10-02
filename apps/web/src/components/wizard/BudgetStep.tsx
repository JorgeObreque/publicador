'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import { issueForField } from '@/lib/campaigns/wizard';
import type { ValidationIssue } from '@/lib/campaigns/wizard';
import { FieldShell } from '@/components/forms/FieldShell';

interface Props {
  draft: CampaignDraft;
  maxSpend: number | null;
  issues: ValidationIssue[];
  onChange: (updater: (draft: CampaignDraft) => CampaignDraft) => void;
  onNext: () => void;
  onPrevious: () => void;
}

const parseBudget = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const pad2 = (value: number): string => value.toString().padStart(2, '0');

/**
 * Devuelve la fecha UTC de mañana en formato `YYYY-MM-DD`. El backend
 * trabaja siempre en UTC para evitar saltos de zona horaria y el wizard
 * replica esa convención al "Aplicar recomendación" cuando el brief no
 * trae fechas explícitas.
 */
const tomorrowIsoDate = (): string => {
  const now = new Date();
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return `${tomorrow.getUTCFullYear()}-${pad2(tomorrow.getUTCMonth() + 1)}-${pad2(tomorrow.getUTCDate())}`;
};

/** Suma `days` días civiles UTC a `YYYY-MM-DD` y devuelve otro `YYYY-MM-DD`. */
const addDaysIsoDate = (start: string, days: number): string => {
  const [yearStr, monthStr, dayStr] = start.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return start;
  }
  const base = new Date(Date.UTC(year, month - 1, day));
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${pad2(base.getUTCMonth() + 1)}-${pad2(base.getUTCDate())}`;
};

const WEEKDAY_SHORT_LABELS_ES = [
  'dom',
  'lun',
  'mar',
  'mié',
  'jue',
  'vie',
  'sáb',
] as const;

const CONFIDENCE_LABEL: Record<
  NonNullable<CampaignDraft['recommendedConfidence']>,
  string
> = {
  SUPPORTED: 'Soportado por evidencia',
  TESTABLE: 'A prueba',
  UNLIKELY: 'Probablemente no alcanza la meta',
  INSUFFICIENT_DATA: 'Datos insuficientes',
};

const CONFIDENCE_TONE: Record<
  NonNullable<CampaignDraft['recommendedConfidence']>,
  { background: string; color: string; border: string }
> = {
  SUPPORTED: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  TESTABLE: { background: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  // Rojo/ámbar fuerte para UNLIKELY (consistente con la tarjeta de presupuesto).
  UNLIKELY: { background: '#fecaca', color: '#7f1d1d', border: '#f87171' },
  INSUFFICIENT_DATA: {
    background: '#fef3c7',
    color: '#92400e',
    border: '#fde68a',
  },
};

const FALLBACK_DISCLAIMER =
  'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.';

// Pequeño espacio que dejamos bajo el badge para alinearlo con el input
// cuando `FieldShell` no muestra ningún error. Mantiene la composición
// estable entre los casos "Recomendado" y "Personalizado".
const errorSpacing = '0.25rem';

export function BudgetStep({ draft, maxSpend, issues, onChange, onNext, onPrevious }: Props) {
  const budgetError = issueForField(issues, 'budget', 'dailyBudget');
  const endDateError = issueForField(issues, 'budget', 'endDate');
  const budget = parseBudget(draft.dailyBudget);
  const canContinue = budget > 0 && !endDateError;

  // Estado local: ¿hemos descartado la tarjeta de recomendación? Cuando
  // llega `true` ocultamos el CTA "Aplicar recomendación" pero los inputs
  // siguen siendo editables.
  const [recommendationDismissed, setRecommendationDismissed] = useState(false);
  // Estado local: el operador editó manualmente un input después de
  // haber aplicado la recomendación. Lo usamos para cambiar el badge
  // de "Recomendado" a "Personalizado".
  const [budgetTouched, setBudgetTouched] = useState(false);

  const hasRecommendation =
    draft.recommendedDailyBudget !== '' ||
    draft.recommendedStartDate !== '' ||
    draft.recommendedEndDate !== '' ||
    draft.recommendedConfidence !== null;

  const hasInsufficientData =
    draft.recommendedConfidence === 'INSUFFICIENT_DATA';

  const isUnlikely = draft.recommendedConfidence === 'UNLIKELY';

  const showRecommendationCard = hasRecommendation && !recommendationDismissed;

  const applyRecommendation = () => {
    const recommendedDaily = draft.recommendedDailyBudget;
    const recommendedStart = draft.recommendedStartDate || tomorrowIsoDate();
    const durationDays = Number(draft.recommendedDurationDays);
    const safeDuration =
      Number.isFinite(durationDays) && durationDays > 0 ? durationDays : 14;
    const recommendedEnd =
      draft.recommendedEndDate || addDaysIsoDate(recommendedStart, safeDuration - 1);
    onChange((current) => ({
      ...current,
      dailyBudget: recommendedDaily,
      startDate: recommendedStart,
      endDate: recommendedEnd,
    }));
    setBudgetTouched(false);
  };

  const handleInputChange = (
    field: 'dailyBudget' | 'startDate' | 'endDate',
    value: string,
  ) => {
    setBudgetTouched(true);
    onChange((current) => ({ ...current, [field]: value }));
  };

  const dailyBadge = budgetTouched ? 'Personalizado' : 'Recomendado';
  const dailyBadgeTone = budgetTouched
    ? { background: '#f1f5f9', color: '#52606d', border: '#cbd2d9' }
    : { background: '#dcfce7', color: '#166534', border: '#bbf7d0' };

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Presupuesto y duración</h2>
      </header>

      {showRecommendationCard ? (
        <section
          aria-label="Recomendación del plan"
          data-testid="budget-recommendation-card"
          style={{
            border: '1px solid #e4e7eb',
            borderRadius: '12px',
            padding: '1rem',
            background: '#f8fafc',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <header
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ color: '#1f2933', fontSize: '0.95rem' }}>
              Recomendación del plan
            </strong>
            {draft.recommendedConfidence ? (
              <span
                data-testid="budget-recommendation-confidence"
                data-status={draft.recommendedConfidence}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  background:
                    CONFIDENCE_TONE[draft.recommendedConfidence].background,
                  color: CONFIDENCE_TONE[draft.recommendedConfidence].color,
                  border: `1px solid ${CONFIDENCE_TONE[draft.recommendedConfidence].border}`,
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                {CONFIDENCE_LABEL[draft.recommendedConfidence]}
              </span>
            ) : null}
          </header>

          {draft.recommendedDailyBudget ? (
            <p
              data-testid="budget-recommendation-summary"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              {`Sugerimos ${formatCurrency(Number(draft.recommendedDailyBudget))} diarios`}
              {draft.recommendedDurationDays
                ? ` durante ${draft.recommendedDurationDays} días`
                : ''}
              {draft.recommendedStartDate && draft.recommendedEndDate
                ? ` (${draft.recommendedStartDate} → ${draft.recommendedEndDate})`
                : ''}
              .
            </p>
          ) : (
            <p
              data-testid="budget-recommendation-summary"
              style={{
                margin: 0,
                color: '#92400e',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              No tenemos un presupuesto sugerido todavía (datos insuficientes).
            </p>
          )}

          {(draft.recommendedCpaTarget || draft.recommendedCpaCap) ? (
            <p
              data-testid="budget-recommendation-cpa"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              {draft.recommendedCpaTarget ? (
                <>
                  <strong>Costo por adquisición (CPA) recomendado:</strong>{' '}
                  {formatCurrency(Number(draft.recommendedCpaTarget))}
                </>
              ) : null}
              {draft.recommendedCpaTarget && draft.recommendedCpaCap ? ' · ' : null}
              {draft.recommendedCpaCap ? (
                <>
                  <strong>Máximo aceptable (tope de CPA):</strong>{' '}
                  {formatCurrency(Number(draft.recommendedCpaCap))}
                </>
              ) : null}
            </p>
          ) : null}

          {draft.recommendedWeekdays.length > 0 ? (
            <ul
              aria-label="Días con mejor evidencia"
              style={{
                margin: 0,
                padding: 0,
                listStyle: 'none',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.4rem',
              }}
            >
              {draft.recommendedWeekdays.map((weekday) => (
                <li
                  key={weekday}
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    background: '#e0e7ff',
                    color: '#3730a3',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                  }}
                >
                  {WEEKDAY_SHORT_LABELS_ES[weekday] ?? `día ${weekday}`}
                </li>
              ))}
            </ul>
          ) : null}

          {draft.budgetExplanation ? (
            <p
              style={{
                margin: 0,
                color: '#52606d',
                fontSize: '0.85rem',
                lineHeight: 1.45,
              }}
            >
              {draft.budgetExplanation}
            </p>
          ) : null}

          {isUnlikely && draft.goalAssessment?.explanation ? (
            <p
              data-testid="budget-recommendation-warning"
              style={{
                margin: 0,
                padding: '0.5rem 0.65rem',
                borderRadius: '8px',
                background: '#fff1f2',
                border: '1px solid #fda4af',
                color: '#7f1d1d',
                fontSize: '0.85rem',
                lineHeight: 1.45,
                display: 'inline-flex',
                gap: '0.4rem',
                alignItems: 'flex-start',
              }}
            >
              <span aria-hidden="true" role="presentation" style={{ flexShrink: 0 }}>
                ⚠
              </span>
              <span>
                <strong>Revisa la meta antes de aplicar.</strong>{' '}
                {draft.goalAssessment.explanation}
              </span>
            </p>
          ) : null}

          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
            }}
          >
            <button
              type="button"
              data-testid="budget-recommendation-dismiss"
              onClick={() => setRecommendationDismissed(true)}
              style={ghostButtonStyle}
            >
              Descartar
            </button>
            {!hasInsufficientData ? (
              <button
                type="button"
                data-testid="budget-recommendation-apply"
                data-tone={isUnlikely ? 'warning' : 'primary'}
                onClick={applyRecommendation}
                style={isUnlikely ? warningButtonStyle : primaryButtonStyle}
              >
                {isUnlikely
                  ? 'Aplicar igualmente (revisar meta)'
                  : 'Aplicar recomendación'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '12rem' }}>
          <FieldShell
            id="budget-daily"
            label="Presupuesto diario (CLP)"
            error={budgetError}
          >
            <input
              type="number"
              min={1}
              step={1}
              value={draft.dailyBudget}
              onChange={(event) => handleInputChange('dailyBudget', event.target.value)}
              style={inputStyle}
            />
          </FieldShell>
        </div>
        <span
          data-testid="budget-daily-badge"
          data-status={budgetTouched ? 'custom' : 'recommended'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.2rem 0.6rem',
            borderRadius: '999px',
            background: dailyBadgeTone.background,
            color: dailyBadgeTone.color,
            border: `1px solid ${dailyBadgeTone.border}`,
            fontSize: '0.75rem',
            fontWeight: 600,
            marginBottom: errorSpacing,
          }}
        >
          {dailyBadge}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <FieldShell id="budget-start" label="Fecha de inicio">
          <input
            type="date"
            value={draft.startDate}
            onChange={(event) => handleInputChange('startDate', event.target.value)}
            style={inputStyle}
          />
        </FieldShell>
        <FieldShell id="budget-end" label="Fecha de término" error={endDateError}>
          <input
            type="date"
            value={draft.endDate}
            onChange={(event) => handleInputChange('endDate', event.target.value)}
            style={inputStyle}
          />
        </FieldShell>
      </div>

      {draft.goalAssessment?.explanation ? (
        <p
          data-testid="budget-goal-explanation"
          style={{
            margin: 0,
            color: '#52606d',
            fontSize: '0.85rem',
            lineHeight: 1.45,
          }}
        >
          {draft.goalAssessment.explanation}
        </p>
      ) : null}

      <div
        style={{
          padding: '1rem',
          borderRadius: '12px',
          background: '#f1f5f9',
          color: '#1f2933',
          display: 'grid',
          gap: '0.35rem',
        }}
      >
        <p style={{ margin: 0, color: '#52606d', fontSize: '0.85rem' }}>
          Presupuesto diario en pesos chilenos.
        </p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '1.4rem', fontWeight: 700 }}>
          {maxSpend !== null ? formatCurrency(maxSpend) : 'Define un presupuesto y un rango de fechas'}
        </p>
      </div>

      <footer
        aria-label="Aviso de la recomendación"
        style={{
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#9a3412',
          fontSize: '0.8rem',
          lineHeight: 1.45,
        }}
      >
        {draft.goalAssessment?.disclaimer ?? FALLBACK_DISCLAIMER}
      </footer>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" onClick={onPrevious} style={secondaryButtonStyle}>
          Atrás
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!canContinue}
          style={{
            ...primaryButtonStyle,
            opacity: canContinue ? 1 : 0.5,
            cursor: canContinue ? 'pointer' : 'not-allowed',
          }}
        >
          Continuar
        </button>
      </div>
    </section>
  );
}

const inputStyle = {
  padding: '0.6rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  fontSize: '1rem',
} as const;

const primaryButtonStyle = {
  padding: '0.55rem 1rem',
  borderRadius: '8px',
  border: '1px solid #1f2933',
  background: '#1f2933',
  color: '#ffffff',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

// Tono de advertencia para el CTA cuando la recomendación es UNLIKELY:
// queremos que la usuaria pueda aplicar igual, pero que el botón se
// "vea distinto" para que piense dos veces antes de pasar por encima
// del aviso.
const warningButtonStyle = {
  padding: '0.55rem 1rem',
  borderRadius: '8px',
  border: '1px solid #b91c1c',
  background: '#fee2e2',
  color: '#7f1d1d',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const ghostButtonStyle = {
  padding: '0.55rem 1rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  fontSize: '0.9rem',
  fontWeight: 600,
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  padding: '0.65rem 1.25rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  fontSize: '1rem',
  cursor: 'pointer',
} as const;