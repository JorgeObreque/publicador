export type CampaignStepId = 'service' | 'image' | 'copy' | 'budget' | 'review';

export interface CampaignDraft {
  name: string;
  serviceId: string | null;
  notes: string;
  selectedMediaAssetId: string | null;
  primaryText: string;
  headline: string;
  description: string;
  dailyBudget: string;
  startDate: string;
  endDate: string;
}

export const createEmptyDraft = (): CampaignDraft => ({
  name: '',
  serviceId: null,
  notes: '',
  selectedMediaAssetId: null,
  primaryText: '',
  headline: '',
  description: '',
  dailyBudget: '',
  startDate: '',
  endDate: '',
});

export const STEPS: Array<{ id: CampaignStepId; label: string; description: string }> = [
  { id: 'service', label: 'Qué promocionar', description: 'Elige el servicio y nombra la campaña.' },
  { id: 'image', label: 'Fotografía', description: 'Selecciona una imagen desde Google Drive.' },
  { id: 'copy', label: 'Mensaje', description: 'Escribe el texto y revisa cómo se verá.' },
  { id: 'budget', label: 'Presupuesto', description: 'Define cuánto invertir y durante cuánto tiempo.' },
  { id: 'review', label: 'Revisión', description: 'Confirma antes de enviar a Meta.' },
];

export interface ValidationIssue {
  step: CampaignStepId;
  field: keyof CampaignDraft | 'global';
  message: string;
}

export const issuesForStep = (
  issues: ValidationIssue[],
  step: CampaignStepId,
): ValidationIssue[] => issues.filter((issue) => issue.step === step);

export const issueForField = (
  issues: ValidationIssue[],
  step: CampaignStepId,
  field: keyof CampaignDraft,
): string | undefined =>
  issues.find((issue) => issue.step === step && issue.field === field)?.message;

export const validateDraft = (draft: CampaignDraft): ValidationIssue[] => {
  const issues: ValidationIssue[] = [];
  if (!draft.name.trim()) {
    issues.push({ step: 'service', field: 'name', message: 'Asigna un nombre a la campaña.' });
  }
  if (!draft.serviceId) {
    issues.push({ step: 'service', field: 'serviceId', message: 'Elige el servicio que quieres promocionar.' });
  }
  if (!draft.selectedMediaAssetId) {
    issues.push({ step: 'image', field: 'selectedMediaAssetId', message: 'Selecciona una fotografía.' });
  }
  if (!draft.primaryText.trim()) {
    issues.push({ step: 'copy', field: 'primaryText', message: 'Escribe el mensaje principal.' });
  }
  if (!draft.headline.trim()) {
    issues.push({ step: 'copy', field: 'headline', message: 'Escribe un título corto.' });
  }
  const budget = Number(draft.dailyBudget);
  if (!draft.dailyBudget.trim() || Number.isNaN(budget) || budget <= 0) {
    issues.push({ step: 'budget', field: 'dailyBudget', message: 'Define un presupuesto diario positivo.' });
  }
  if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
    issues.push({ step: 'budget', field: 'endDate', message: 'La fecha de término debe ser posterior a la fecha de inicio.' });
  }
  return issues;
};

export const estimateMaxSpend = (draft: CampaignDraft): number | null => {
  const budget = Number(draft.dailyBudget);
  if (!Number.isFinite(budget) || budget <= 0) return null;
  if (!draft.startDate || !draft.endDate) return null;
  const start = new Date(draft.startDate);
  const end = new Date(draft.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  if (end < start) return null;
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  return budget * days;
};
