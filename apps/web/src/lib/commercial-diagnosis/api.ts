import { apiFetch } from '../api';

export type CommercialDiagnosisStatus =
  | 'IN_PROGRESS'
  | 'READY'
  | 'ACCEPTED'
  | 'ARCHIVED';

export type CommercialDataSource =
  | 'USER_PROFILE'
  | 'USER_CURRENT_SITUATION'
  | 'AI_INFERENCE'
  | 'SYSTEM_CALCULATION'
  | 'AI_RECOMMENDATION'
  | 'CAMPAIGN_OBSERVED_DATA';

export interface ProvenanceEntry {
  value: string | number | boolean | null;
  source: CommercialDataSource;
}

export type ProvenanceMap = Record<string, ProvenanceEntry>;

export interface CommercialDiagnosisAnswer {
  id: string;
  questionKey: string;
  questionText: string;
  answerText: string | null;
  askedAt: string;
  answeredAt: string | null;
}

/**
 * Estados de la recomendación honesta (Phase E / Phase F).
 *
 * - `SUPPORTED`: la meta es coherente con la evidencia histórica del
 *   negocio y la capacidad registrada.
 * - `TESTABLE`: la meta es agresiva o no tiene evidencia suficiente:
 *   conviene probarla antes de escalarla.
 * - `UNLIKELY`: el presupuesto o la escala propuesta es inviable.
 * - `INSUFFICIENT_DATA`: no hay datos para afirmar nada; requiere una
 *   primera prueba para recoger evidencia.
 */
export type ConfidenceStatus =
  | 'SUPPORTED'
  | 'TESTABLE'
  | 'UNLIKELY'
  | 'INSUFFICIENT_DATA';

/**
 * Bloque de "valoración honesta de la meta" que el backend devuelve
 * junto a la estrategia (Phase E). Aparece en el `strategy.goalAssessment`
 * y el frontend debe mostrarlo de forma obligatoria para evitar que la
 * usuaria lea la recomendación como una promesa de resultados.
 */
export interface GoalAssessment {
  status: ConfidenceStatus;
  explanation: string;
  disclaimer: string;
}

export interface CommercialDiagnosisRecommended {
  situation: string | null;
  opportunity: string | null;
  primaryGoal: string | null;
  primaryConversion: string | null;
  recommendedTitle: string | null;
  recommendedWeeklyAdd: number | null;
  availableCapacity: number | null;
  /**
   * Estado de confianza de la meta propuesta. Refleja el mismo valor que
   * `strategy.goalAssessment.status` (cuando ambos están presentes) y se
   * expone a nivel de `recommended` para que la `RecommendedGoalCard`
   * pueda mostrar el badge sin depender de la estrategia.
   *
   * Opcional: las respuestas anteriores a la Fase E no lo incluyen.
   */
  goalConfidence?: ConfidenceStatus;
  pendingQuestion?: { key: string; text: string };
}

export interface CommercialDiagnosisStrategy {
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  initialDailyBudgetCLP: string | null;
  initialLifetimeBudgetCLP: string | null;
  initialDurationDays: number;
  initialCpaTargetCLP: string | null;
  initialCpaCapCLP: string | null;
  /**
   * Justificación filtrada de la IA para el `initialCpaTargetCLP` (proviene
   * de `assumptions` con el prefijo `__cpaRationale__:` que el backend
   * ya removió). `null` cuando el backend no devolvió una explicación.
   */
  cpaRationale: string | null;
  /**
   * Justificación de por qué el CPA objetivo es razonable contra el
   * precio del servicio (proviene de `qualifyingQuestions` filtradas por
   el backend). `null` cuando no aplica.
   */
  priceJustification: string | null;
  /**
   * Unidad de conversión que el backend infiere a partir del
   * `primaryConversion` declarado. Sirve para que el frontend pueda
   * mostrar "Contacto / CPL" vs "Reserva / CPA" en la tarjeta de
   * presupuesto.
   *
   * Opcional: el backend no la devuelve dentro de `strategy` (sólo en
   * `diagnosis.primaryConversion` y `diagnosis.recommended.primaryConversion`).
   * El frontend debe resolverla desde esos campos como fallback.
   */
  primaryConversion?: string | null;
  progressionSteps: number[];
  provenance: ProvenanceMap;
  /**
   * Fecha de inicio recomendada por el motor de presupuesto
   * determinista (YYYY-MM-DD UTC). `null` cuando el backend aún no ha
   * sido ampliado con la Fase A-D.
   */
  recommendedStartDate: string | null;
  /**
   * Fecha de término recomendada (YYYY-MM-DD UTC). `null` en versiones
   * del backend anteriores a la Fase A-D.
   */
  recommendedEndDate: string | null;
  /**
   * Días de la semana (0=domingo..6=sábado) en los que la evidencia
   * histórica muestra mejor CPA. Lista vacía cuando no hay muestra
   * suficiente.
   */
  recommendedWeekdays: number[];
  /**
   * Frase corta que explica por qué se propuso el presupuesto.
   * `null` en versiones del backend anteriores a la Fase A-D.
   */
  budgetExplanation: string | null;
  /**
   * Frase corta que explica por qué se propuso la programación (días,
   * duración, etc.). `null` en versiones del backend anteriores a la
   * Fase A-D.
   */
  scheduleExplanation: string | null;
  /**
   * Lista de supuestos explícitos que el frontend debe mostrar al pie
   * de la tarjeta de presupuesto. Vacía cuando no hay supuestos.
   */
  assumptions: string[];
  /**
   * Valoración honesta de la meta recomendada. `null` cuando la
   * estrategia no incluye todavía la Fase A-D.
   */
  goalAssessment: GoalAssessment | null;
}

export interface CommercialDiagnosis {
  id: string;
  businessId: string;
  status: CommercialDiagnosisStatus;
  currentSituation: string;
  serviceId: string | null;
  situation: string | null;
  opportunity: string | null;
  primaryGoal: string | null;
  primaryConversion: string | null;
  recommendedTitle: string | null;
  recommendedWeeklyAdd: number | null;
  availableCapacity: number | null;
  recommended: CommercialDiagnosisRecommended;
  strategy: CommercialDiagnosisStrategy | null;
  answers: CommercialDiagnosisAnswer[];
  campaignBriefId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommercialDiagnosisAcceptResult {
  diagnosis: CommercialDiagnosis;
  campaignBrief: unknown;
}

export interface StartCommercialDiagnosisPayload {
  currentSituation: string;
  serviceId?: string;
}

export interface AnswerCommercialDiagnosisPayload {
  questionKey: string;
  answerText: string;
}

export interface AdjustCommercialDiagnosisPayload {
  instruction: string;
}

export const startCommercialDiagnosis = (
  payload: StartCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> =>
  apiFetch<CommercialDiagnosis>('/commercial-diagnoses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getCommercialDiagnosis = (
  id: string,
): Promise<CommercialDiagnosis> =>
  apiFetch<CommercialDiagnosis>(`/commercial-diagnoses/${id}`, undefined, {
    cache: 'no-store',
  });

export const answerCommercialDiagnosis = (
  id: string,
  payload: AnswerCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> =>
  apiFetch<CommercialDiagnosis>(`/commercial-diagnoses/${id}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const adjustCommercialDiagnosis = (
  id: string,
  payload: AdjustCommercialDiagnosisPayload,
): Promise<CommercialDiagnosis> =>
  apiFetch<CommercialDiagnosis>(`/commercial-diagnoses/${id}/adjust`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const acceptCommercialDiagnosis = (
  id: string,
): Promise<CommercialDiagnosisAcceptResult> =>
  apiFetch<CommercialDiagnosisAcceptResult>(
    `/commercial-diagnoses/${id}/accept`,
    { method: 'POST' },
  );