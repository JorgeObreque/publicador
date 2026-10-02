import { useCallback, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetStep } from './BudgetStep';
import { createEmptyDraft } from '@/lib/campaigns/wizard';
import type { CampaignDraft } from '@/lib/campaigns/wizard';

interface RenderResult {
  onNext: jest.Mock;
  onPrevious: jest.Mock;
  getLatestDraft: () => CampaignDraft;
  capturedUpdaters: Array<(draft: CampaignDraft) => CampaignDraft>;
}

function renderBudgetStep(initial: Partial<CampaignDraft> = {}): RenderResult {
  const onNext = jest.fn();
  const onPrevious = jest.fn();
  const capturedUpdaters: Array<(draft: CampaignDraft) => CampaignDraft> = [];
  let latest: CampaignDraft = { ...createEmptyDraft(), ...initial };

  function Harness() {
    const [draft, setDraft] = useState<CampaignDraft>(
      () => ({ ...createEmptyDraft(), ...initial }),
    );
    latest = draft;
    const handleChange = useCallback(
      (updater: (current: CampaignDraft) => CampaignDraft) => {
        capturedUpdaters.push(updater);
        setDraft((current) => {
          const next = updater(current);
          latest = next;
          return next;
        });
      },
      [],
    );
    return (
      <BudgetStep
        draft={draft}
        maxSpend={null}
        issues={[]}
        onChange={handleChange}
        onNext={onNext}
        onPrevious={onPrevious}
      />
    );
  }

  render(<Harness />);

  return {
    onNext,
    onPrevious,
    capturedUpdaters,
    getLatestDraft: () => latest,
  };
}

const buildRecommendationDraft = (
  overrides: Partial<CampaignDraft> = {},
): Partial<CampaignDraft> => ({
  recommendedDailyBudget: '5000',
  recommendedLifetimeBudget: '70000',
  recommendedDurationDays: '14',
  recommendedStartDate: '2026-10-05',
  recommendedEndDate: '2026-10-18',
  recommendedWeekdays: [1, 2, 4],
  budgetExplanation:
    'Con 6 conversiones/semana y un CPA histórico de $5.000, el presupuesto es coherente con la evidencia.',
  scheduleExplanation:
    'Concentra la pauta en lunes, martes y jueves (los días con mejor CPA).',
  recommendedConfidence: 'SUPPORTED',
  recommendedCpaTarget: '5000',
  recommendedCpaCap: '12000',
  goalAssessment: {
    status: 'SUPPORTED',
    explanation:
      'La meta de 6 conversiones/semana es coherente con la evidencia histórica del negocio y su capacidad registrada.',
    disclaimer:
      'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.',
  },
  ...overrides,
});

describe('BudgetStep', () => {
  it('NO muestra la tarjeta de recomendación cuando el draft no trae recomendados', () => {
    renderBudgetStep();
    expect(
      screen.queryByTestId('budget-recommendation-card'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-recommendation-apply')).not.toBeInTheDocument();
  });

  it('muestra la tarjeta con badge Recomendado cuando hay recomendación y el usuario aún no editó', () => {
    renderBudgetStep(buildRecommendationDraft());
    const card = screen.getByTestId('budget-recommendation-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveTextContent('Recomendación del plan');
    expect(card).toHaveTextContent('Soportado por evidencia');
    expect(card).toHaveTextContent('lun');
    expect(card).toHaveTextContent('mar');
    expect(card).toHaveTextContent('jue');

    const badge = screen.getByTestId('budget-daily-badge');
    expect(badge).toHaveAttribute('data-status', 'recommended');
    expect(badge).toHaveTextContent('Recomendado');

    // El snapshot de CPA objetivo y tope se muestra con los valores del brief.
    const cpaSnapshot = screen.getByTestId('budget-recommendation-cpa');
    expect(cpaSnapshot).toBeInTheDocument();
    expect(cpaSnapshot).toHaveTextContent(
      'Costo por adquisición (CPA) recomendado: $5.000',
    );
    expect(cpaSnapshot).toHaveTextContent(
      'Máximo aceptable (tope de CPA): $12.000',
    );
  });

  it('"Aplicar recomendación" rellena dailyBudget, startDate y endDate y resetea el flag budgetTouched', async () => {
    const { getLatestDraft } = renderBudgetStep(buildRecommendationDraft());

    await userEvent.click(screen.getByTestId('budget-recommendation-apply'));

    await waitFor(() => {
      const draft = getLatestDraft();
      expect(draft.dailyBudget).toBe('5000');
      expect(draft.startDate).toBe('2026-10-05');
      expect(draft.endDate).toBe('2026-10-18');
    });
    // Tras aplicar la recomendación el badge vuelve a "Recomendado".
    const badge = screen.getByTestId('budget-daily-badge');
    expect(badge).toHaveAttribute('data-status', 'recommended');
  });

  it('cuando recommendedStartDate/EndDate están vacíos, "Aplicar recomendación" usa mañana UTC + durationDays', async () => {
    const { getLatestDraft } = renderBudgetStep(
      buildRecommendationDraft({
        recommendedStartDate: '',
        recommendedEndDate: '',
      }),
    );

    await userEvent.click(screen.getByTestId('budget-recommendation-apply'));

    await waitFor(() => {
      const draft = getLatestDraft();
      expect(draft.dailyBudget).toBe('5000');
      // La fecha de inicio debe ser un YYYY-MM-DD con 14 días hacia el endDate.
      expect(draft.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(draft.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(draft.startDate.length).toBe(10);
      expect(draft.endDate.length).toBe(10);
      const start = new Date(`${draft.startDate}T00:00:00.000Z`).getTime();
      const end = new Date(`${draft.endDate}T00:00:00.000Z`).getTime();
      const diffDays = Math.round((end - start) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(13); // durationDays - 1
    });
  });

  it('editar manualmente el dailyBudget cambia el badge a "Personalizado"', async () => {
    const user = userEvent.setup();
    renderBudgetStep(buildRecommendationDraft());

    const input = screen.getByRole('spinbutton', {
      name: /Presupuesto diario \(CLP\)/i,
    }) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, '6500');

    await waitFor(() => {
      const badge = screen.getByTestId('budget-daily-badge');
      expect(badge).toHaveAttribute('data-status', 'custom');
      expect(badge).toHaveTextContent('Personalizado');
    });
  });

  it('"Descartar" oculta la tarjeta pero mantiene los inputs editables', async () => {
    const user = userEvent.setup();
    renderBudgetStep(buildRecommendationDraft());

    expect(screen.getByTestId('budget-recommendation-card')).toBeInTheDocument();
    await user.click(screen.getByTestId('budget-recommendation-dismiss'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('budget-recommendation-card'),
      ).not.toBeInTheDocument();
    });
    // El input de presupuesto sigue presente y editable.
    const input = screen.getByRole('spinbutton', {
      name: /Presupuesto diario \(CLP\)/i,
    }) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    await user.clear(input);
    await user.type(input, '1234');
    expect(input.value).toBe('1234');
  });

  it('NO muestra el CTA "Aplicar recomendación" cuando recommendedConfidence es INSUFFICIENT_DATA', () => {
    renderBudgetStep(
      buildRecommendationDraft({
        recommendedConfidence: 'INSUFFICIENT_DATA',
        goalAssessment: {
          status: 'INSUFFICIENT_DATA',
          explanation: 'Sin datos suficientes.',
          disclaimer: 'Disclaimer obligatorio.',
        },
        recommendedDailyBudget: '',
      }),
    );
    expect(screen.getByTestId('budget-recommendation-card')).toBeInTheDocument();
    expect(
      screen.queryByTestId('budget-recommendation-apply'),
    ).not.toBeInTheDocument();
    // El botón "Descartar" sigue disponible para esconder la tarjeta.
    expect(screen.getByTestId('budget-recommendation-dismiss')).toBeInTheDocument();
  });

  it('muestra el CTA en tono de advertencia y un bloque de "Revisa la meta antes de aplicar" cuando recommendedConfidence es UNLIKELY', () => {
    renderBudgetStep(
      buildRecommendationDraft({
        recommendedDailyBudget: '1000',
        recommendedLifetimeBudget: '14000',
        recommendedConfidence: 'UNLIKELY',
        goalAssessment: {
          status: 'UNLIKELY',
          explanation:
            'El presupuesto diario natural sería de $571 CLP (con CPA objetivo de $2.000 CLP y meta de 2 reservas/semana, el presupuesto diario natural es $571 CLP). Subimos al mínimo viable de Meta ($1.000 CLP) para que la campaña alcance a entregarse, pero esta escala probablemente no alcanza la meta de 4 conversiones en el periodo. Considera extender la duración a 21 días.',
          disclaimer: 'Disclaimer obligatorio.',
        },
      }),
    );

    // El badge del card se muestra con tono rojo/ámbar y la etiqueta nueva.
    const confidenceBadge = screen.getByTestId('budget-recommendation-confidence');
    expect(confidenceBadge).toHaveAttribute('data-status', 'UNLIKELY');
    expect(confidenceBadge).toHaveTextContent('Probablemente no alcanza la meta');

    // Aparece el bloque de advertencia con la explicación honesta.
    const warning = screen.getByTestId('budget-recommendation-warning');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent('Revisa la meta antes de aplicar');
    expect(warning).toHaveTextContent(
      'El presupuesto diario natural sería de $571 CLP',
    );

    // El CTA sigue presente pero con tono de advertencia.
    const apply = screen.getByTestId('budget-recommendation-apply');
    expect(apply).toBeInTheDocument();
    expect(apply).toHaveAttribute('data-tone', 'warning');
    expect(apply).toHaveTextContent('Aplicar igualmente (revisar meta)');
  });

  it('"Aplicar igualmente (revisar meta)" en estado UNLIKELY rellena los inputs igual que el flujo normal', async () => {
    const { getLatestDraft } = renderBudgetStep(
      buildRecommendationDraft({
        recommendedDailyBudget: '1000',
        recommendedLifetimeBudget: '14000',
        recommendedConfidence: 'UNLIKELY',
      }),
    );

    await userEvent.click(screen.getByTestId('budget-recommendation-apply'));

    await waitFor(() => {
      const draft = getLatestDraft();
      expect(draft.dailyBudget).toBe('1000');
      expect(draft.startDate).toBe('2026-10-05');
      expect(draft.endDate).toBe('2026-10-18');
    });
  });

  it('muestra solo el tope CPA cuando recommendedCpaTarget está vacío', () => {
    renderBudgetStep(buildRecommendationDraft({ recommendedCpaTarget: '' }));
    const cpaSnapshot = screen.getByTestId('budget-recommendation-cpa');
    expect(cpaSnapshot).toHaveTextContent('Máximo aceptable (tope de CPA): $12.000');
    expect(cpaSnapshot).not.toHaveTextContent(
      'Costo por adquisición (CPA) recomendado',
    );
  });

  it('no muestra el bloque CPA cuando ambos campos están vacíos', () => {
    renderBudgetStep(
      buildRecommendationDraft({ recommendedCpaTarget: '', recommendedCpaCap: '' }),
    );
    expect(
      screen.queryByTestId('budget-recommendation-cpa'),
    ).not.toBeInTheDocument();
  });
});