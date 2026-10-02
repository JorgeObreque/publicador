import { render, screen } from '@testing-library/react';
import { RecommendedBudgetCard } from './RecommendedBudgetCard';
import type { CommercialDiagnosisStrategy } from '@/lib/commercial-diagnosis/api';

const buildStrategy = (
  overrides: Partial<CommercialDiagnosisStrategy> = {},
): CommercialDiagnosisStrategy => ({
  businessObjective: 'Aumentar reservas',
  offer: 'Reserva con 20% de descuento',
  primaryKpi: 'Reservas',
  idealCustomerProfile: null,
  qualifyingQuestions: [],
  constraints: [],
  stopIf: null,
  scaleIf: null,
  initialDailyBudgetCLP: '5000',
  initialLifetimeBudgetCLP: '70000',
  initialDurationDays: 14,
  initialCpaTargetCLP: null,
  initialCpaCapCLP: null,
  cpaRationale: null,
  priceJustification: null,
  // `primaryConversion` es OPCIONAL en `CommercialDiagnosisStrategy`:
  // el backend no lo devuelve dentro de `strategy` (sólo en
  // `diagnosis.primaryConversion` y `diagnosis.recommended.primaryConversion`).
  primaryConversion: undefined,
  progressionSteps: [3, 4, 6],
  provenance: {},
  recommendedStartDate: null,
  recommendedEndDate: null,
  recommendedWeekdays: [],
  budgetExplanation: null,
  scheduleExplanation: null,
  assumptions: [],
  goalAssessment: null,
  ...overrides,
});

describe('RecommendedBudgetCard', () => {
  it('no renderiza nada cuando strategy es null', () => {
    const { container } = render(<RecommendedBudgetCard strategy={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza SUPPORTED con weekdays, fechas y explicación', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          recommendedStartDate: '2026-10-05',
          recommendedEndDate: '2026-10-18',
          recommendedWeekdays: [1, 2, 4],
          budgetExplanation: 'Con 6 conv/semana y CPA $5.000, el presupuesto es coherente.',
          scheduleExplanation: 'Concentra la pauta en lunes, martes y jueves.',
          assumptions: ['CPA histórico: $5.000 CLP.', 'Conversiones objetivo: 12.'],
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'La meta es coherente con la evidencia.',
            disclaimer:
              'La inversión propuesta no garantiza reservas ni ventas; depende de entrega, audiencia, creatividad y conversión.',
          },
        })}
      />,
    );

    const card = screen.getByTestId('cdf-budget-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('Inversión sugerida');
    expect(card).toHaveTextContent('Periodo recomendado: 2026-10-05 al 2026-10-18');
    expect(card).toHaveTextContent('lun');
    expect(card).toHaveTextContent('mar');
    expect(card).toHaveTextContent('jue');
    expect(card).toHaveTextContent('Con 6 conv/semana y CPA $5.000');
    expect(card).toHaveTextContent('Concentra la pauta en lunes, martes y jueves');
    expect(card).toHaveTextContent('CPA histórico: $5.000 CLP.');
    expect(card).toHaveTextContent('Conversiones objetivo: 12.');

    const badge = screen.getByTestId('cdf-budget-confidence-badge');
    expect(badge).toHaveAttribute('data-status', 'SUPPORTED');

    const disclaimer = screen.getByTestId('cdf-budget-disclaimer');
    expect(disclaimer).toBeInTheDocument();
    expect(disclaimer).toHaveTextContent(/no garantiza reservas/);
  });

  it('muestra fallback "Sin presupuesto sugerido" y oculta CTA cuando es INSUFFICIENT_DATA sin dailyBudget', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          initialDailyBudgetCLP: null,
          initialLifetimeBudgetCLP: null,
          budgetExplanation:
            'No hay evidencia histórica ni tope CPA registrado: no podemos recomendar un presupuesto concreto.',
          goalAssessment: {
            status: 'INSUFFICIENT_DATA',
            explanation: 'Sin datos no podemos afirmar si la meta es viable.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );

    const card = screen.getByTestId('cdf-budget-card');
    expect(card).toHaveTextContent('Sin presupuesto sugerido (datos insuficientes)');
    // El summary con formato currency no debe estar presente.
    expect(screen.queryByTestId('cdf-budget-amount')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdf-budget-empty')).toBeInTheDocument();
  });

  it('muestra "Publicar todos los días durante la prueba" cuando hay presupuesto pero no hay weekdays', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          recommendedStartDate: '2026-10-05',
          recommendedEndDate: '2026-10-18',
          recommendedWeekdays: [],
        })}
      />,
    );

    expect(screen.getByTestId('cdf-budget-card')).toHaveTextContent(
      'Publicar todos los días durante la prueba.',
    );
  });

  it('badge en tono ámbar cuando goalAssessment es INSUFFICIENT_DATA', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          goalAssessment: {
            status: 'INSUFFICIENT_DATA',
            explanation: 'Sin datos suficientes.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );
    const badge = screen.getByTestId('cdf-budget-confidence-badge');
    expect(badge).toHaveAttribute('data-status', 'INSUFFICIENT_DATA');
  });

  it('muestra "Probablemente no alcanza la meta" en español cuando goalAssessment es UNLIKELY', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          initialDailyBudgetCLP: '1000',
          initialLifetimeBudgetCLP: '14000',
          goalAssessment: {
            status: 'UNLIKELY',
            explanation:
              'El presupuesto diario natural sería de $571 CLP (con CPA objetivo de $2.000 CLP y meta de 2 reservas/semana). Subimos al mínimo viable de Meta ($1.000 CLP), pero probablemente no alcanza la meta de 4 conversiones en el periodo. Considera extender la duración a 21 días.',
            disclaimer:
              'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.',
          },
        })}
      />,
    );

    const badge = screen.getByTestId('cdf-budget-confidence-badge');
    expect(badge).toHaveAttribute('data-status', 'UNLIKELY');
    expect(badge).toHaveTextContent('Probablemente no alcanza la meta');

    // El bloque de "Valoración de la meta" muestra la explicación honesta.
    const goal = screen.getByTestId('cdf-budget-goal-assessment');
    expect(goal).toHaveAttribute('data-status', 'UNLIKELY');
    expect(goal).toHaveTextContent(
      'El presupuesto diario natural sería de $571 CLP',
    );
    expect(goal).toHaveTextContent('presupuesto probablemente insuficiente');

    // El disclaimer se mantiene visible y con el icono de advertencia.
    const disclaimer = screen.getByTestId('cdf-budget-disclaimer');
    expect(disclaimer).toHaveTextContent(/no garantiza reservas/);
  });

  it('renderiza el bloque "Costo por adquisición" con unidad CPA cuando primaryConversion incluye "reservas"', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: 'Reservas',
          initialCpaTargetCLP: '5000',
          initialCpaCapCLP: '12000',
          cpaRationale: 'Con tu meta de 6 reservas/semana y ticket promedio, un CPA de $5.000 es coherente.',
          priceJustification:
            'El CPA propuesto es ~5% del precio del servicio ($95.500), dejando margen para operación y creativos.',
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'La meta es coherente con la evidencia.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );

    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toBeInTheDocument();
    expect(cpa).toHaveAttribute('data-variant', 'cpa');
    expect(cpa).toHaveTextContent('Costo por adquisición');
    expect(cpa).toHaveTextContent('Reserva confirmada');
    expect(cpa).toHaveTextContent(
      'El costo por adquisición (CPA) es el costo por cada reserva o venta confirmada atribuida',
    );

    const target = screen.getByTestId('cdf-budget-cpa-target');
    expect(target).toHaveTextContent('Costo por adquisición (CPA) recomendado');
    // El formato CLP es-CL muestra el símbolo seguido del número (p. ej. "$5.000").
    expect(target.textContent).toMatch(/5\.000/);

    const cap = screen.getByTestId('cdf-budget-cpa-cap');
    expect(cap).toHaveTextContent('Máximo aceptable (tope de CPA)');
    expect(cap.textContent).toMatch(/12\.000/);

    const rationale = screen.getByTestId('cdf-budget-cpa-rationale');
    expect(rationale).toHaveTextContent(
      'Con tu meta de 6 reservas/semana y ticket promedio',
    );

    const price = screen.getByTestId('cdf-budget-cpa-price');
    expect(price).toHaveTextContent(
      '~5% del precio del servicio ($95.500)',
    );

    // En SUPPORTED no aparece la frase canónica.
    expect(screen.queryByTestId('cdf-budget-cpa-canonical')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cdf-budget-cpa-learn')).not.toBeInTheDocument();
  });

  it('renderiza el bloque "Costo por adquisición" como CPL cuando primaryConversion incluye "WhatsApp"', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: 'Mensajes por WhatsApp',
          initialCpaTargetCLP: '3000',
          initialCpaCapCLP: '6000',
          goalAssessment: {
            status: 'TESTABLE',
            explanation:
              'Sin datos históricos comparables, la meta es agresiva.',
            disclaimer: 'Disclaimer obligatorio.',
          },
          budgetExplanation:
            'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.',
        })}
      />,
    );

    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toHaveAttribute('data-variant', 'cpl');
    expect(cpa).toHaveTextContent('Contacto calificado');
    expect(cpa).toHaveTextContent(
      'El costo por lead (CPL) es el costo por cada mensaje recibido con código de seguimiento',
    );

    // En TESTABLE la frase canónica se muestra en el bloque CPA y el
    // `budgetExplanation` del backend se reemplaza (no se duplica fuera del bloque).
    expect(screen.getByTestId('cdf-budget-cpa-canonical')).toHaveTextContent(
      'Como no hay historial, esta es una estimación',
    );
    expect(screen.getByTestId('cdf-budget-cpa-learn')).toHaveTextContent(
      'Qué aprenderemos en la prueba',
    );
    // La frase canónica aparece exactamente en el bloque CPA (no se duplica fuera).
    const canonicalElements = screen.getAllByText(
      'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.',
    );
    expect(canonicalElements).toHaveLength(1);
    expect(canonicalElements[0]).toBe(screen.getByTestId('cdf-budget-cpa-canonical'));
  });

  it('NO muestra el bloque CPA cuando initialCpaTargetCLP y initialCpaCapCLP son null (INSUFFICIENT_DATA)', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          initialCpaTargetCLP: null,
          initialCpaCapCLP: null,
          initialDailyBudgetCLP: null,
          initialLifetimeBudgetCLP: null,
          budgetExplanation:
            'No hay evidencia histórica ni tope CPA registrado: no podemos recomendar un presupuesto concreto.',
          goalAssessment: {
            status: 'INSUFFICIENT_DATA',
            explanation: 'Sin datos no podemos afirmar si la meta es viable.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );

    expect(screen.queryByTestId('cdf-budget-cpa')).not.toBeInTheDocument();
    expect(screen.getByTestId('cdf-budget-empty')).toHaveTextContent(
      'No hay evidencia histórica ni tope CPA registrado',
    );
  });

  it('muestra solo el target cuando initialCpaCapCLP es null', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: 'Reservas confirmadas',
          initialCpaTargetCLP: '4500',
          initialCpaCapCLP: null,
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'Coherente con evidencia.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );

    expect(screen.getByTestId('cdf-budget-cpa-target')).toHaveTextContent('4.500');
    expect(screen.queryByTestId('cdf-budget-cpa-cap')).not.toBeInTheDocument();
  });

  it('muestra solo el cap cuando initialCpaTargetCLP es null', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: 'Reservas',
          initialCpaTargetCLP: null,
          initialCpaCapCLP: '18000',
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'Coherente con evidencia.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
      />,
    );

    expect(screen.queryByTestId('cdf-budget-cpa-target')).not.toBeInTheDocument();
    expect(screen.getByTestId('cdf-budget-cpa-cap')).toHaveTextContent('18.000');
  });

  // Hallazgo 1: `strategy.primaryConversion` es opcional. Cuando el backend
  // no la entrega dentro de `strategy`, la unidad debe inferirse desde la
  // prop `primaryConversionFallback`.
  it('infiere la unidad CPA desde primaryConversionFallback si strategy.primaryConversion es undefined', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: undefined,
          initialCpaTargetCLP: '5000',
          initialCpaCapCLP: '12000',
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'La meta es coherente con la evidencia.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
        primaryConversionFallback="Reservas confirmadas"
      />,
    );

    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toBeInTheDocument();
    expect(cpa).toHaveAttribute('data-variant', 'cpa');
    expect(cpa).toHaveTextContent('Reserva confirmada');
    expect(cpa).toHaveTextContent(
      'El costo por adquisición (CPA) es el costo por cada reserva o venta confirmada atribuida',
    );
  });

  it('infiere la unidad CPL desde primaryConversionFallback si strategy.primaryConversion es null', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          primaryConversion: null,
          initialCpaTargetCLP: '3000',
          initialCpaCapCLP: '6000',
          goalAssessment: {
            status: 'SUPPORTED',
            explanation: 'La meta es coherente con la evidencia.',
            disclaimer: 'Disclaimer obligatorio.',
          },
        })}
        primaryConversionFallback="Mensajes por WhatsApp"
      />,
    );

    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toHaveAttribute('data-variant', 'cpl');
    expect(cpa).toHaveTextContent('Contacto calificado');
    expect(cpa).toHaveTextContent(
      'El costo por lead (CPL) es el costo por cada mensaje recibido con código de seguimiento',
    );
  });

  // Hallazgo 2: cuando TESTABLE + dailyBudget null, la rama "Sin
  // presupuesto sugerido" debe mostrar la frase canónica (bloque CPA) y
  // NO debe mostrar el `budgetExplanation` literal del backend.
  it('TESTABLE con dailyBudget null muestra la frase canónica del CPA y oculta el budgetExplanation en la rama vacía', () => {
    render(
      <RecommendedBudgetCard
        strategy={buildStrategy({
          initialDailyBudgetCLP: null,
          initialLifetimeBudgetCLP: null,
          initialCpaTargetCLP: '3000',
          initialCpaCapCLP: '6000',
          goalAssessment: {
            status: 'TESTABLE',
            explanation:
              'Sin datos históricos comparables, la meta es agresiva.',
            disclaimer: 'Disclaimer obligatorio.',
          },
          budgetExplanation:
            'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.',
        })}
        primaryConversionFallback="Reservas confirmadas"
      />,
    );

    // El bloque CPA aparece porque hay cpaTarget/cpaCap.
    const cpa = screen.getByTestId('cdf-budget-cpa');
    expect(cpa).toBeInTheDocument();
    // La frase canónica vive dentro del bloque CPA.
    expect(screen.getByTestId('cdf-budget-cpa-canonical')).toHaveTextContent(
      'Como no hay historial, esta es una estimación',
    );

    // La rama "Sin presupuesto sugerido" sí se muestra.
    const empty = screen.getByTestId('cdf-budget-empty');
    expect(empty).toBeInTheDocument();
    // Y dentro de ella NO se debe colar el texto literal del budgetExplanation.
    expect(empty).not.toHaveTextContent(
      'Como no hay historial, esta es una estimación',
    );

    // La frase canónica aparece exactamente una vez en todo el árbol.
    const canonicalElements = screen.getAllByText(
      'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.',
    );
    expect(canonicalElements).toHaveLength(1);
    expect(canonicalElements[0]).toBe(screen.getByTestId('cdf-budget-cpa-canonical'));
  });
});