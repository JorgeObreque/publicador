'use client';

import { formatCurrency } from '@/lib/format';
import type {
  CommercialDiagnosisStrategy,
  ConfidenceStatus,
  GoalAssessment,
} from '@/lib/commercial-diagnosis/api';

interface RecommendedBudgetCardProps {
  strategy: CommercialDiagnosisStrategy | null;
  /**
   * Fallback opcional con el `primaryConversion` del nivel superior
   * (`diagnosis.primaryConversion` o `diagnosis.recommended.primaryConversion`).
   * Se usa cuando `strategy.primaryConversion` aún es `null` (algunas
   * versiones del backend no devuelven la unidad a nivel de estrategia).
   */
  primaryConversionFallback?: string | null;
}

const WEEKDAY_SHORT_LABELS_ES = [
  'dom',
  'lun',
  'mar',
  'mié',
  'jue',
  'vie',
  'sáb',
] as const;

const CONFIDENCE_LABEL: Record<ConfidenceStatus, string> = {
  SUPPORTED: 'Soportado por evidencia',
  TESTABLE: 'A prueba',
  UNLIKELY: 'Probablemente no alcanza la meta',
  INSUFFICIENT_DATA: 'Datos insuficientes',
};

const CONFIDENCE_TONE: Record<
  ConfidenceStatus,
  { background: string; color: string; border: string }
> = {
  SUPPORTED: { background: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  TESTABLE: { background: '#e0e7ff', color: '#3730a3', border: '#c7d2fe' },
  // Rojo/ámbar fuerte para UNLIKELY: la meta probablemente no es viable con el
  // presupuesto propuesto y queremos que la usuaria lo lea antes de aplicar.
  UNLIKELY: { background: '#fecaca', color: '#7f1d1d', border: '#f87171' },
  INSUFFICIENT_DATA: {
    background: '#fef3c7',
    color: '#92400e',
    border: '#fde68a',
  },
};

function parseAmount(value: string | null): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function formatRange(start: string | null, end: string | null): string {
  if (!start && !end) return 'Sin fecha sugerida';
  if (start && end) return `Periodo recomendado: ${start} al ${end}`;
  if (start) return `Inicio sugerido: ${start}`;
  return `Término sugerido: ${end}`;
}

const TESTABLE_CPA_CANONICAL_PHRASE =
  'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.';

/**
 * Deriva la etiqueta visible y la descripción del par CPA/CPL a partir de
 * `primaryConversion`. El backend devuelve el texto crudo (p. ej.
 * "Mensajes por WhatsApp", "Reservas confirmadas") y aquí normalizamos
 * a las dos categorías que la tarjeta soporta.
 */
function resolveCpaUnit(primaryConversion: string | null | undefined): {
  unitLabel: string;
  unitDescription: string;
  variant: 'cpl' | 'cpa' | 'generic';
} {
  const normalized = (primaryConversion ?? '').toLowerCase();
  const cplKeywords = ['whatsapp', 'lead', 'contacto', 'mensaje', 'evaluaci'];
  const cpaKeywords = ['reserva', 'venta'];
  if (cplKeywords.some((kw) => normalized.includes(kw))) {
    return {
      unitLabel: 'Contacto calificado',
      unitDescription:
        'El costo por lead (CPL) es el costo por cada mensaje recibido con código de seguimiento',
      variant: 'cpl',
    };
  }
  if (cpaKeywords.some((kw) => normalized.includes(kw))) {
    return {
      unitLabel: 'Reserva confirmada',
      unitDescription:
        'El costo por adquisición (CPA) es el costo por cada reserva o venta confirmada atribuida',
      variant: 'cpa',
    };
  }
  return {
    unitLabel: 'Conversión atribuida',
    unitDescription:
      'El costo por adquisición (CPA) es el costo por cada conversión efectiva atribuida',
    variant: 'generic',
  };
}

function sortedWeekdays(weekdays: readonly number[]): number[] {
  return [...new Set(weekdays)]
    .filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6)
    .sort((a, b) => a - b);
}

function renderConfidenceBadge(assessment: GoalAssessment | null): JSX.Element | null {
  if (!assessment) return null;
  const tone = CONFIDENCE_TONE[assessment.status];
  return (
    <span
      data-testid="cdf-budget-confidence-badge"
      data-status={assessment.status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        background: tone.background,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        fontSize: '0.75rem',
        fontWeight: 600,
      }}
    >
      {CONFIDENCE_LABEL[assessment.status]}
    </span>
  );
}

export function RecommendedBudgetCard({
  strategy,
  primaryConversionFallback,
}: RecommendedBudgetCardProps) {
  if (!strategy) return null;

  const dailyBudget = parseAmount(strategy.initialDailyBudgetCLP);
  const lifetimeBudget = parseAmount(strategy.initialLifetimeBudgetCLP);
  const durationDays = strategy.initialDurationDays;
  const hasBudget = dailyBudget !== null && dailyBudget > 0;

  const datesText = formatRange(
    strategy.recommendedStartDate,
    strategy.recommendedEndDate,
  );

  const weekdays = sortedWeekdays(strategy.recommendedWeekdays);
  const showWeekdayFallback = hasBudget && weekdays.length === 0;

  const cpaTarget = parseAmount(strategy.initialCpaTargetCLP);
  const cpaCap = parseAmount(strategy.initialCpaCapCLP);
  const hasCpaTarget = cpaTarget !== null;
  const hasCpaCap = cpaCap !== null;
  const showCpaBlock = hasCpaTarget || hasCpaCap;
  const confidence = strategy.goalAssessment?.status ?? null;

  const unit = resolveCpaUnit(
    strategy.primaryConversion ?? primaryConversionFallback ?? null,
  );

  return (
    <article
      data-testid="cdf-budget-card"
      aria-label="Inversión sugerida"
      style={{
        border: '1px solid #e4e7eb',
        borderRadius: '12px',
        padding: '1rem',
        background: '#ffffff',
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
          Inversión sugerida
        </strong>
        {renderConfidenceBadge(strategy.goalAssessment)}
      </header>

      {hasBudget && dailyBudget !== null && lifetimeBudget !== null ? (
        <p
          data-testid="cdf-budget-amount"
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '1.1rem',
            fontWeight: 600,
          }}
        >
          {formatCurrency(dailyBudget)} diarios · {durationDays} días · máximo{' '}
          {formatCurrency(lifetimeBudget)}
        </p>
      ) : (
        <div
          data-testid="cdf-budget-empty"
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background: '#fef3c7',
            border: '1px solid #fde68a',
            color: '#92400e',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}
        >
          <strong>Sin presupuesto sugerido (datos insuficientes).</strong>
          {strategy.budgetExplanation && confidence !== 'TESTABLE' ? (
            <p style={{ margin: '0.5rem 0 0' }}>{strategy.budgetExplanation}</p>
          ) : null}
        </div>
      )}

      {showCpaBlock ? (
        <section
          aria-label="Costo por adquisición"
          data-testid="cdf-budget-cpa"
          data-variant={unit.variant}
          style={{
            display: 'grid',
            gap: '0.35rem',
            padding: '0.75rem',
            borderRadius: '8px',
            background: '#f8fafc',
            border: '1px solid #e4e7eb',
          }}
        >
          <strong style={{ color: '#1f2933', fontSize: '0.9rem' }}>
            Costo por adquisición
          </strong>
          <p
            style={{
              margin: 0,
              color: '#1f2933',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            <strong>Unidad:</strong> {unit.unitLabel}{' '}
            <span style={{ color: '#52606d' }}>({unit.unitDescription})</span>
          </p>
          {hasCpaTarget && cpaTarget !== null ? (
            <p
              data-testid="cdf-budget-cpa-target"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              <strong>Costo por adquisición (CPA) recomendado:</strong>{' '}
              {formatCurrency(cpaTarget)}
            </p>
          ) : null}
          {hasCpaCap && cpaCap !== null ? (
            <p
              data-testid="cdf-budget-cpa-cap"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              <strong>Máximo aceptable (tope de CPA):</strong>{' '}
              {formatCurrency(cpaCap)}
            </p>
          ) : null}
          {strategy.cpaRationale ? (
            <p
              data-testid="cdf-budget-cpa-rationale"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              <strong>Por qué recomendamos este valor:</strong>{' '}
              {strategy.cpaRationale}
            </p>
          ) : null}
          {strategy.priceJustification ? (
            <p
              data-testid="cdf-budget-cpa-price"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              <strong>Justificación de precio:</strong>{' '}
              {strategy.priceJustification}
            </p>
          ) : null}
          {confidence === 'TESTABLE' ? (
            <p
              data-testid="cdf-budget-cpa-canonical"
              style={{
                margin: 0,
                color: '#52606d',
                fontSize: '0.85rem',
                fontStyle: 'italic',
                lineHeight: 1.45,
              }}
            >
              {TESTABLE_CPA_CANONICAL_PHRASE}
            </p>
          ) : null}
          {confidence === 'TESTABLE' ? (
            <p
              data-testid="cdf-budget-cpa-learn"
              style={{
                margin: 0,
                color: '#1f2933',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              <strong>Qué aprenderemos en la prueba:</strong> un CPA base
              promedio observado para tu servicio, ubicación y meta, con el
              que podrás negociar tu próximo plan y decidir si subes o bajas el
              tope.
            </p>
          ) : null}
        </section>
      ) : null}

      <section
        aria-label="Periodo recomendado"
        style={{
          display: 'grid',
          gap: '0.35rem',
          padding: '0.75rem',
          borderRadius: '8px',
          background: '#f8fafc',
          border: '1px solid #e4e7eb',
        }}
      >
        <strong style={{ color: '#1f2933', fontSize: '0.9rem' }}>
          Programación
        </strong>
        <p
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}
        >
          {datesText}
        </p>
        {weekdays.length > 0 ? (
          <ul
            aria-label="Días con mejor evidencia"
            style={{
              margin: '0.25rem 0 0',
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.4rem',
            }}
          >
            {weekdays.map((weekday) => (
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
        ) : showWeekdayFallback ? (
          <p
            style={{
              margin: '0.25rem 0 0',
              color: '#52606d',
              fontSize: '0.85rem',
              fontStyle: 'italic',
            }}
          >
            Publicar todos los días durante la prueba.
          </p>
        ) : null}
        {strategy.scheduleExplanation ? (
          <p
            style={{
              margin: '0.25rem 0 0',
              color: '#52606d',
              fontSize: '0.85rem',
              lineHeight: 1.45,
            }}
          >
            {strategy.scheduleExplanation}
          </p>
        ) : null}
      </section>

      {strategy.budgetExplanation && hasBudget && confidence !== 'TESTABLE' ? (
        <p
          style={{
            margin: 0,
            color: '#1f2933',
            fontSize: '0.9rem',
            lineHeight: 1.45,
          }}
        >
          {strategy.budgetExplanation}
        </p>
      ) : null}

      {strategy.assumptions.length > 0 ? (
        <section
          aria-label="Supuestos de la recomendación"
          style={{ display: 'grid', gap: '0.35rem' }}
        >
          <strong style={{ color: '#1f2933', fontSize: '0.9rem' }}>
            Supuestos
          </strong>
          <ul
            style={{
              margin: 0,
              padding: '0 0 0 1.1rem',
              color: '#1f2933',
              fontSize: '0.85rem',
              lineHeight: 1.45,
              display: 'grid',
              gap: '0.25rem',
            }}
          >
            {strategy.assumptions.map((assumption, index) => (
              <li key={`${index}-${assumption.slice(0, 12)}`}>{assumption}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {strategy.goalAssessment ? (
        <section
          aria-label="Valoración de la meta"
          data-testid="cdf-budget-goal-assessment"
          data-status={strategy.goalAssessment.status}
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            background:
              strategy.goalAssessment.status === 'UNLIKELY'
                ? '#fff1f2'
                : '#f8fafc',
            border:
              strategy.goalAssessment.status === 'UNLIKELY'
                ? '1px solid #fda4af'
                : '1px solid #e4e7eb',
            display: 'grid',
            gap: '0.35rem',
          }}
        >
          <strong
            style={{
              color:
                strategy.goalAssessment.status === 'UNLIKELY'
                  ? '#7f1d1d'
                  : '#1f2933',
              fontSize: '0.9rem',
            }}
          >
            {strategy.goalAssessment.status === 'UNLIKELY' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                <span aria-hidden="true" role="presentation">
                  ⚠
                </span>
                Atención: presupuesto probablemente insuficiente
              </span>
            ) : (
              'Confianza'
            )}
          </strong>
          <p
            style={{
              margin: 0,
              color:
                strategy.goalAssessment.status === 'UNLIKELY'
                  ? '#7f1d1d'
                  : '#1f2933',
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            {strategy.goalAssessment.explanation}
          </p>
        </section>
      ) : null}

      <footer
        aria-label="Aviso de la recomendación"
        data-testid="cdf-budget-disclaimer"
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
        <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          <span aria-hidden="true" role="presentation" style={{ flexShrink: 0 }}>
            ⚠
          </span>
          <span>
            {strategy.goalAssessment?.disclaimer ??
              'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.'}
          </span>
        </span>
      </footer>
    </article>
  );
}