import { createDraftFromBrief, createEmptyDraft, estimateMaxSpend, validateDraft } from './wizard';
import type { CampaignBrief } from '@/lib/campaign-brief/api';
import type { CampaignDraft } from './wizard';

const baseDraft: CampaignDraft = {
  name: 'Balayage Otoño',
  serviceId: 'svc-balayage',
  notes: '',
  selectedMediaAssetId: 'media-1',
  primaryText: 'Balayage natural con profesionales',
  headline: 'Reserva tu balayage',
  dailyBudget: '5000',
  startDate: '2026-09-22',
  endDate: '2026-09-28',
  briefId: null,
  objective: '',
  briefObjective: '',
  briefKpi: '',
  briefWeeklyAdd: '',
  briefStopIf: '',
  briefScaleIf: '',
  briefContext: null,
  recommendedDailyBudget: '',
  recommendedLifetimeBudget: '',
  recommendedDurationDays: '',
  recommendedStartDate: '',
  recommendedEndDate: '',
  recommendedWeekdays: [],
  budgetExplanation: null,
  scheduleExplanation: null,
  goalAssessment: null,
  recommendedConfidence: null,
  recommendedCpaTarget: '',
  recommendedCpaCap: '',
};

const buildBrief = (overrides: Partial<CampaignBrief> = {}): CampaignBrief => ({
  id: 'brief-1',
  businessId: 'biz-1',
  serviceId: 'svc-balayage',
  title: 'Balayage Otoño',
  status: 'APPROVED',
  businessObjective:
    'Aumentar las reservas de balayage en clientas nuevas durante los meses de otoño.',
  offer: 'Primera sesión de balayage con evaluación y productos premium.',
  primaryKpi: 'Reservas por WhatsApp',
  idealCustomerProfile: 'Mujeres 30-45 que quieren un cambio sutil.',
  qualifyingQuestions: ['¿Has tenido balayage antes?', '¿Qué zonas deseas aclarar?'],
  monthlyAcquisitionGoal: 12,
  costPerAcquisitionCap: '25000',
  lifetimeBudgetCap: '120000',
  dailyBudgetCap: '8000',
  plannedDurationDays: 14,
  constraints: ['No usar descuentos agresivos', 'Evitar promesa de resultados en 1 sesión'],
  stopIf: 'CPA supera los $25.000',
  scaleIf: 'CPA se mantiene bajo $18.000 por 5 días',
  approvedAt: '2026-09-20T00:00:00.000Z',
  approvedBy: 'user-1',
  createdAt: '2026-09-15T00:00:00.000Z',
  updatedAt: '2026-09-20T00:00:00.000Z',
  executions: [],
  ...overrides,
});

describe('validateDraft', () => {
  it('no reporta issues cuando el borrador está completo', () => {
    expect(validateDraft(baseDraft)).toEqual([]);
  });

  it('detecta errores por paso', () => {
    const issues = validateDraft({
      ...baseDraft,
      name: '',
      serviceId: null,
      selectedMediaAssetId: null,
      primaryText: '',
      headline: '',
      dailyBudget: '',
    });
    const fields = issues.map((issue) => issue.field);
    expect(fields).toEqual(
      expect.arrayContaining(['name', 'serviceId', 'selectedMediaAssetId', 'primaryText', 'headline', 'dailyBudget']),
    );
  });

  it('detecta fechas invertidas', () => {
    const issues = validateDraft({
      ...baseDraft,
      startDate: '2026-09-30',
      endDate: '2026-09-22',
    });
    expect(issues.some((issue) => issue.field === 'endDate')).toBe(true);
  });
});

describe('estimateMaxSpend', () => {
  it('calcula el gasto máximo para presupuesto diario y rango de fechas', () => {
    expect(estimateMaxSpend(baseDraft)).toBe(5000 * 7);
  });

  it('devuelve null sin fechas', () => {
    expect(estimateMaxSpend({ ...baseDraft, startDate: '', endDate: '' })).toBeNull();
  });

  it('devuelve null con presupuesto inválido', () => {
    expect(estimateMaxSpend({ ...baseDraft, dailyBudget: '0' })).toBeNull();
  });
});

describe('createDraftFromBrief', () => {
  it('pre-pobla name, serviceId y objective a partir del brief', () => {
    const draft = createDraftFromBrief(buildBrief(), {
      dailyBudget: '6000',
      lifetimeBudget: '90000',
      durationDays: 10,
    });

    expect(draft.briefId).toBe('brief-1');
    expect(draft.serviceId).toBe('svc-balayage');
    expect(draft.name).toBe('Balayage Otoño');
    expect(draft.objective.length).toBeLessThanOrEqual(60);
    expect(draft.objective).toContain('Aumentar las reservas');
    expect(draft.briefObjective).toContain('Aumentar las reservas');
    expect(draft.briefKpi).toBe('Reservas por WhatsApp');
    expect(draft.briefStopIf).toBe('CPA supera los $25.000');
    expect(draft.briefScaleIf).toBe('CPA se mantiene bajo $18.000 por 5 días');
    expect(draft.dailyBudget).toBe('6000');
    expect(draft.briefContext).toMatchObject({
      businessObjective: expect.stringContaining('Aumentar las reservas'),
      primaryKpi: 'Reservas por WhatsApp',
      stopIf: 'CPA supera los $25.000',
      scaleIf: 'CPA se mantiene bajo $18.000 por 5 días',
      offer: expect.stringContaining('balayage'),
      qualifyingQuestions: ['¿Has tenido balayage antes?', '¿Qué zonas deseas aclarar?'],
      constraints: ['No usar descuentos agresivos', 'Evitar promesa de resultados en 1 sesión'],
    });
  });

  it('usa los topes del brief cuando no se pasan recomendados', () => {
    const draft = createDraftFromBrief(buildBrief());
    expect(draft.dailyBudget).toBe('8000');
  });

  it('deja el borrador sin presupuesto si no hay topes ni recomendados', () => {
    const draft = createDraftFromBrief(
      buildBrief({ dailyBudgetCap: null, lifetimeBudgetCap: null, plannedDurationDays: null }),
    );
    expect(draft.dailyBudget).toBe('');
  });

  it('cae al título cuando el businessObjective está vacío', () => {
    const draft = createDraftFromBrief(buildBrief({ businessObjective: '' }));
    expect(draft.objective).toBe('Balayage Otoño');
  });

  it('snapshot de la recomendación honesta: copia los recomendados al draft y deja goalAssessment/recommendedStartDate en null', () => {
    const draft = createDraftFromBrief(buildBrief(), {
      dailyBudget: '7500',
      lifetimeBudget: '120000',
      durationDays: 16,
    });
    expect(draft.recommendedDailyBudget).toBe('7500');
    expect(draft.recommendedLifetimeBudget).toBe('120000');
    expect(draft.recommendedDurationDays).toBe('16');
    // El brief actual no incluye estos campos; deben quedar en null/vacío.
    expect(draft.recommendedStartDate).toBe('');
    expect(draft.recommendedEndDate).toBe('');
    expect(draft.recommendedWeekdays).toEqual([]);
    expect(draft.budgetExplanation).toBeNull();
    expect(draft.scheduleExplanation).toBeNull();
    expect(draft.goalAssessment).toBeNull();
    expect(draft.recommendedConfidence).toBeNull();
  });

  it('createEmptyDraft inicializa los nuevos campos como vacío/null', () => {
    const draft = createEmptyDraft();
    expect(draft.recommendedDailyBudget).toBe('');
    expect(draft.recommendedLifetimeBudget).toBe('');
    expect(draft.recommendedDurationDays).toBe('');
    expect(draft.recommendedStartDate).toBe('');
    expect(draft.recommendedEndDate).toBe('');
    expect(draft.recommendedWeekdays).toEqual([]);
    expect(draft.budgetExplanation).toBeNull();
    expect(draft.scheduleExplanation).toBeNull();
    expect(draft.goalAssessment).toBeNull();
    expect(draft.recommendedConfidence).toBeNull();
    expect(draft.recommendedCpaTarget).toBe('');
    expect(draft.recommendedCpaCap).toBe('');
  });

  it('propaga el costPerAcquisitionCap del brief a recommendedCpaCap', () => {
    const draft = createDraftFromBrief(buildBrief());
    expect(draft.recommendedCpaCap).toBe('25000');
    // El target queda vacío hasta que el backend lo entregue en el snapshot
    // (este cambio es sólo estructura, no rellena el target desde el brief).
    expect(draft.recommendedCpaTarget).toBe('');
  });

  it('recommendedCpaCap queda vacío cuando el brief no tiene tope CPA', () => {
    const draft = createDraftFromBrief(buildBrief({ costPerAcquisitionCap: null }));
    expect(draft.recommendedCpaCap).toBe('');
    expect(draft.recommendedCpaTarget).toBe('');
  });
});
