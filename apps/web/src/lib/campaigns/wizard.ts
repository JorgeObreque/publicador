import type { CampaignBrief } from '@/lib/campaign-brief/api';
import type { BriefContext } from '@/lib/creatives/api';

export type CampaignStepId = 'service' | 'image' | 'copy' | 'budget' | 'review';

/**
 * Estado de confianza de la meta recomendada por el diagnóstico
 * comercial. Refleja el motor determinista del backend (Fase A-D) y se
 * muestra en el wizard para que la usuaria sepa cuánto soporte tiene la
 * propuesta antes de pulsar "Aplicar recomendación".
 */
export type CampaignDraftConfidence =
  | 'SUPPORTED'
  | 'TESTABLE'
  | 'UNLIKELY'
  | 'INSUFFICIENT_DATA';

export interface CampaignDraftGoalAssessment {
  status: CampaignDraftConfidence;
  explanation: string;
  disclaimer: string;
}

export interface CampaignDraft {
  name: string;
  serviceId: string | null;
  notes: string;
  selectedMediaAssetId: string | null;
  primaryText: string;
  headline: string;
  dailyBudget: string;
  startDate: string;
  endDate: string;
  /**
   * Identificador del `CampaignBrief` aprobado que originó esta campaña
   * (cuando la usuaria llegó desde el diagnóstico comercial). `null` en
   * los flujos legacy sin brief.
   */
  briefId: string | null;
  /**
   * Objetivo comercial precargado del brief (recortado a 60 caracteres
   * para ajustarse al límite del `Campaign.objective` en el backend).
   * En flujos sin brief queda vacío.
   */
  objective: string;
  /**
   * Snapshots del brief aprobado para mostrarlos en la pantalla de
   * revisión y para alimentar el prompt de recomendaciones de copy.
   * Quedan en `null`/vacíos cuando la campaña no proviene de un brief.
   */
  briefObjective: string;
  briefKpi: string;
  briefWeeklyAdd: string;
  briefStopIf: string;
  briefScaleIf: string;
  /**
   * Bloque opcional que el frontend envía al endpoint de recomendaciones
   * para que el copy respete la estrategia aprobada. Se inicializa desde
   * el brief en `createDraftFromBrief`.
   */
  briefContext: BriefContext | null;
  /**
   * Snapshots del diagnóstico comercial (Fase E / Fase F) que el wizard
   * muestra como "recomendación honesta" en el paso de presupuesto.
   * Quedan en `''` / `[]` / `null` cuando la campaña no proviene de un
   * diagnóstico ampliado.
   */
  recommendedDailyBudget: string;
  recommendedLifetimeBudget: string;
  recommendedDurationDays: string;
  recommendedStartDate: string;
  recommendedEndDate: string;
  recommendedWeekdays: number[];
  budgetExplanation: string | null;
  scheduleExplanation: string | null;
  goalAssessment: CampaignDraftGoalAssessment | null;
  recommendedConfidence: CampaignDraftConfidence | null;
  /**
   * CPA objetivo propuesto por la IA en el diagnóstico comercial. Vacío
   * hasta que el backend lo exponga en el snapshot del wizard.
   */
  recommendedCpaTarget: string;
  /**
   * Tope máximo de CPA propuesto por la IA (suele coincidir con el
   * `costPerAcquisitionCap` del brief aprobado).
   */
  recommendedCpaCap: string;
}

const OBJECTIVE_MAX_LENGTH = 60;

const safeSlice = (value: string | null | undefined, max: number): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
};

export interface RecommendedBudgets {
  dailyBudget?: string | number | null;
  lifetimeBudget?: string | number | null;
  durationDays?: number | string | null;
}

/**
 * Convierte un valor `Decimal` (o string numérico) en la representación
 * string que espera `CampaignDraft.dailyBudget`. Si el valor es inválido
 * o nulo, devuelve `''`.
 */
const formatBudgetValue = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (str.length === 0) return '';
  // Permitimos el redondeo a entero para que el input numérico del
  // BudgetStep acepte el valor sin mostrar decimales sobrantes.
  const num = Number(str);
  if (!Number.isFinite(num)) return str;
  return String(Math.round(num));
};

/**
 * Construye un `CampaignDraft` pre-poblado a partir de un `CampaignBrief`
 * aprobado. Sólo se invoca desde la página de nueva campaña cuando la
 * usuaria llegó desde el diagnóstico comercial; en flujos sin brief el
 * wizard sigue arrancando con `createEmptyDraft()`.
 *
 * Los snapshots de la recomendación honesta (`recommendedDailyBudget`,
 * `recommendedStartDate`, etc.) NO existen en el `CampaignBrief` actual
 * (la migración que los añadirá llegará con la Fase A-D). Los dejamos
 * como `''` / `[]` / `null` aquí para que el `BudgetStep` los muestre en
 * cuanto la nueva respuesta del server action los entregue.
 */
export const createDraftFromBrief = (
  brief: CampaignBrief,
  recommended: RecommendedBudgets = {},
): CampaignDraft => {
  const objective = safeSlice(brief.businessObjective, OBJECTIVE_MAX_LENGTH);
  const briefContext: BriefContext = {
    businessObjective: brief.businessObjective || null,
    offer: brief.offer || null,
    primaryKpi: brief.primaryKpi || null,
    idealCustomerProfile: brief.idealCustomerProfile || null,
    qualifyingQuestions: [...brief.qualifyingQuestions],
    constraints: [...brief.constraints],
    stopIf: brief.stopIf || null,
    scaleIf: brief.scaleIf || null,
  };
  const recommendedDailyBudget = formatBudgetValue(
    recommended.dailyBudget ?? brief.dailyBudgetCap,
  );
  const recommendedLifetimeBudget = formatBudgetValue(
    recommended.lifetimeBudget ?? brief.lifetimeBudgetCap,
  );
  const recommendedDurationDays =
    recommended.durationDays !== null && recommended.durationDays !== undefined
      ? String(recommended.durationDays)
      : brief.plannedDurationDays !== null && brief.plannedDurationDays !== undefined
        ? String(brief.plannedDurationDays)
        : '';
  return {
    name: safeSlice(brief.title, 120),
    serviceId: brief.serviceId,
    notes: '',
    selectedMediaAssetId: null,
    primaryText: '',
    headline: '',
    dailyBudget: recommendedDailyBudget,
    startDate: '',
    endDate: '',
    briefId: brief.id,
    objective: objective || safeSlice(brief.title, OBJECTIVE_MAX_LENGTH),
    briefObjective: safeSlice(brief.businessObjective, 1000),
    briefKpi: safeSlice(brief.primaryKpi, 80),
    briefWeeklyAdd: '',
    briefStopIf: safeSlice(brief.stopIf, 1000),
    briefScaleIf: safeSlice(brief.scaleIf, 1000),
    briefContext,
    recommendedDailyBudget,
    recommendedLifetimeBudget,
    recommendedDurationDays,
    recommendedStartDate: '',
    recommendedEndDate: '',
    recommendedWeekdays: [],
    budgetExplanation: null,
    scheduleExplanation: null,
    goalAssessment: null,
    recommendedConfidence: null,
    recommendedCpaTarget: '',
    recommendedCpaCap: formatBudgetValue(brief.costPerAcquisitionCap),
  };
};

export const createEmptyDraft = (): CampaignDraft => ({
  name: '',
  serviceId: null,
  notes: '',
  selectedMediaAssetId: null,
  primaryText: '',
  headline: '',
  dailyBudget: '',
  startDate: '',
  endDate: '',
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