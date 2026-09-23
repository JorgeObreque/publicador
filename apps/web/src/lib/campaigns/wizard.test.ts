import { estimateMaxSpend, validateDraft } from './wizard';
import type { CampaignDraft } from './wizard';

const baseDraft: CampaignDraft = {
  name: 'Balayage Otoño',
  serviceId: 'svc-balayage',
  notes: '',
  selectedMediaAssetId: 'media-1',
  primaryText: 'Balayage natural con profesionales',
  headline: 'Reserva tu balayage',
  description: '',
  dailyBudget: '5000',
  startDate: '2026-09-22',
  endDate: '2026-09-28',
};

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
