import { z } from 'zod';

/**
 * Esquemas Zod para la entrada y salida del módulo `CommercialDiagnosis`.
 *
 * El controlador valida los payloads con `parse(...)` (igual que en
 * `campaign-brief` y `business-profile`) y traduce los `ZodError` a
 * `BadRequestException`.
 *
 * El flujo comercial es:
 *
 *  1. `POST /commercial-diagnoses` toma la "situación actual del negocio"
 *     como texto libre y, opcionalmente, un `serviceId`. Devuelve un
 *     `CommercialDiagnosis` en estado `IN_PROGRESS` o `READY` según la IA
 *     determine que necesita más información o puede proponer una meta.
 *  2. `POST /commercial-diagnoses/:id/answer` registra la respuesta a la
 *     pregunta pendiente y vuelve a invocar a la IA (máximo 3 preguntas
 *     en total: si la IA insiste, el servicio fuerza una decisión).
 *  3. `POST /commercial-diagnoses/:id/adjust` aplica una instrucción libre
 *     sobre un diagnóstico `READY` o `ACCEPTED` para afinar la meta
 *     propuesta.
 *  4. `POST /commercial-diagnoses/:id/accept` materializa la meta
 *     recomendada en un `CampaignBrief` aprobado, dejando la diagnosis
 *     ligada al brief resultante.
 *  5. `POST /commercial-diagnoses/:id/archive` archiva el diagnóstico.
 *
 * Reglas de validación:
 * - Strings de entrada con `.trim()` y límites explícitos para impedir
 *   payloads abusivos.
 * - Los arrays (`qualifyingQuestions`, `constraints`, `progressionSteps`)
 *   tienen `max(...)` alineado con el schema Prisma y el resto de
 *   módulos.
 * - Los montos monetarios (`initialDailyBudgetCLP`,
 *   `initialLifetimeBudgetCLP`, `initialCpaTargetCLP`, `initialCpaCapCLP`)
 *   usan `coerce.number()` con `refine` que rechaza NaN/Infinity.
 * - La `provenance` se modela como `Record<key, { value, source }>` para
 *   conservar la trazabilidad que la UI debe mostrar al operador.
 */

const CURRENT_SITUATION_MIN = 10;
const CURRENT_SITUATION_MAX = 4000;
const QUESTION_KEY_MAX = 80;
const QUESTION_TEXT_MAX = 500;
const ANSWER_TEXT_MAX = 2000;
const INSTRUCTION_MAX = 1000;
const TITLE_MAX = 120;
const SHORT_TEXT_MAX = 1000;
const KPI_MAX = 80;
const PRIMARY_TEXT_MAX = 2000;
const STRATEGY_ITEM_MAX = 400;
const STRATEGY_RULE_MAX = 1000;
// Límites adicionales para validar la salida cruda de OpenAI antes de
// persistirla (P1-6). Coinciden con los tamaños del schema Prisma y los
// DTOs de respuesta para impedir payloads absurdos o ataques de costo.
const OPEN_AI_STRATEGY_RULE_MAX = 1000;
const OPEN_AI_PROGRESSION_STEPS_MAX = 10;
const OPEN_AI_BUDGET_MAX = 100_000_000_000;
const OPEN_AI_CPA_MAX = 100_000_000_000;

export const COMMERCIAL_DIAGNOSIS_STATUSES = [
  'IN_PROGRESS',
  'READY',
  'ACCEPTED',
  'ARCHIVED',
] as const;
export type CommercialDiagnosisStatus = (typeof COMMERCIAL_DIAGNOSIS_STATUSES)[number];

export const COMMERCIAL_DATA_SOURCES = [
  'USER_PROFILE',
  'USER_CURRENT_SITUATION',
  'AI_INFERENCE',
  'SYSTEM_CALCULATION',
  'AI_RECOMMENDATION',
  'CAMPAIGN_OBSERVED_DATA',
] as const;
export type CommercialDataSource = (typeof COMMERCIAL_DATA_SOURCES)[number];

export const currentSituationSchema = z
  .string()
  .trim()
  .min(CURRENT_SITUATION_MIN, {
    message: `La situación actual debe tener al menos ${CURRENT_SITUATION_MIN} caracteres`,
  })
  .max(CURRENT_SITUATION_MAX, {
    message: `La situación actual no puede superar ${CURRENT_SITUATION_MAX} caracteres`,
  });

export const startDiagnosisSchema = z
  .object({
    currentSituation: currentSituationSchema,
    serviceId: z.string().trim().min(1).optional(),
  })
  .strict();
export type StartDiagnosisInput = z.infer<typeof startDiagnosisSchema>;

export const answerQuestionSchema = z
  .object({
    questionKey: z.string().trim().min(1).max(QUESTION_KEY_MAX),
    answerText: z.string().trim().min(1).max(ANSWER_TEXT_MAX),
  })
  .strict();
export type AnswerQuestionInput = z.infer<typeof answerQuestionSchema>;

export const adjustDiagnosisSchema = z
  .object({
    instruction: z.string().trim().min(1).max(INSTRUCTION_MAX),
  })
  .strict();
export type AdjustDiagnosisInput = z.infer<typeof adjustDiagnosisSchema>;

// -----------------------------------------------------------------------------
// Esquemas de respuesta (modelo público de la API)
// -----------------------------------------------------------------------------

const nullableString = z.string().nullable();
const nullableNumber = z.number().finite().nullable();

export const pendingQuestionSchema = z.object({
  key: z.string().trim().min(1).max(QUESTION_KEY_MAX),
  text: z.string().trim().min(1).max(QUESTION_TEXT_MAX),
});
export type PendingQuestion = z.infer<typeof pendingQuestionSchema>;

export const provenanceEntrySchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  source: z.enum(COMMERCIAL_DATA_SOURCES),
});
export type ProvenanceEntry = z.infer<typeof provenanceEntrySchema>;

export const provenanceMapSchema = z.record(z.string(), provenanceEntrySchema);
export type ProvenanceMap = z.infer<typeof provenanceMapSchema>;

const recommendedFieldSchema = z.object({
  situation: nullableString,
  opportunity: nullableString,
  primaryGoal: nullableString,
  primaryConversion: nullableString,
  recommendedTitle: nullableString,
  recommendedWeeklyAdd: nullableNumber,
  availableCapacity: nullableNumber,
});

export const recommendedMetaSchema = recommendedFieldSchema.extend({
  pendingQuestion: pendingQuestionSchema.optional(),
});
export type RecommendedMeta = z.infer<typeof recommendedMetaSchema>;

export const diagnosticAnswerSchema = z.object({
  id: z.string().min(1),
  questionKey: z.string().min(1).max(QUESTION_KEY_MAX),
  questionText: z.string().min(1).max(QUESTION_TEXT_MAX),
  answerText: z.string().nullable(),
  askedAt: z.string(),
  answeredAt: z.string().nullable(),
});
export type DiagnosticAnswerResponse = z.infer<typeof diagnosticAnswerSchema>;

const decimalToString = z
  .union([z.string(), z.null()])
  .refine((value) => value === null || /^\d+(\.\d{1,2})?$/.test(value), {
    message: 'Monto CLP inválido',
  });

export const strategySchema = z.object({
  businessObjective: z.string().trim().min(5).max(SHORT_TEXT_MAX),
  offer: z.string().trim().min(5).max(SHORT_TEXT_MAX),
  primaryKpi: z.string().trim().min(1).max(KPI_MAX),
  idealCustomerProfile: z.string().trim().max(PRIMARY_TEXT_MAX).nullable(),
  qualifyingQuestions: z.array(z.string().trim().min(1).max(STRATEGY_ITEM_MAX)).max(20),
  constraints: z.array(z.string().trim().min(1).max(STRATEGY_ITEM_MAX)).max(20),
  stopIf: z.string().trim().max(STRATEGY_RULE_MAX).nullable(),
  scaleIf: z.string().trim().max(STRATEGY_RULE_MAX).nullable(),
  initialDailyBudgetCLP: decimalToString,
  initialLifetimeBudgetCLP: decimalToString,
  initialDurationDays: z.number().int().positive(),
  initialCpaTargetCLP: decimalToString,
  initialCpaCapCLP: decimalToString,
  /**
   * Justificación breve (≤ 200 caracteres) que la IA entrega para el
   * Costo por adquisición (CPA) objetivo propuesto. Sólo se usa en modo
   * sin evidencia; queda persistida codificada en `assumptions[0]` con
   * el prefijo `__cpaRationale__:` (no hay columna propia todavía —
   * ver `combineStrategyWithBudgetRecommendation`). El límite 200
   * caracteres alinea con el tope de cada entrada en `assumptions`
   * (≤200 chars) para que el merge no rompa el contrato público.
   */
  cpaRationale: z.string().trim().max(200).nullable().optional(),
  /**
   * Justificación del precio objetivo de la oferta. Opcional — se
   * persiste codificada en `qualifyingQuestions` con el prefijo
   * `__priceJustification__:` y se filtra al serializar (no hay columna
   * propia todavía). Límite 200 caracteres para alinear con el resto
   * de los strings cortos.
   */
  priceJustification: z.string().trim().max(200).nullable().optional(),
  progressionSteps: z.array(z.number().int().positive()).min(1).max(20),
  recommendedStartDate: z.string().nullable(),
  recommendedEndDate: z.string().nullable(),
  recommendedWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  budgetExplanation: z.string().max(500).nullable(),
  scheduleExplanation: z.string().max(500).nullable(),
  assumptions: z.array(z.string().min(1).max(200)).max(10),
  goalAssessment: z
    .object({
      status: z.enum(['SUPPORTED', 'TESTABLE', 'UNLIKELY', 'INSUFFICIENT_DATA']),
      explanation: z.string().min(1).max(500),
      disclaimer: z.string().min(1).max(500),
    })
    .nullable(),
  provenance: provenanceMapSchema,
});
export type StrategyResponse = z.infer<typeof strategySchema>;

export const commercialDiagnosisResponseSchema = z.object({
  id: z.string().min(1),
  businessId: z.string().min(1),
  status: z.enum(COMMERCIAL_DIAGNOSIS_STATUSES),
  currentSituation: z.string().min(1),
  serviceId: z.string().nullable(),
  situation: nullableString,
  opportunity: nullableString,
  primaryGoal: nullableString,
  primaryConversion: nullableString,
  recommendedTitle: nullableString,
  recommendedWeeklyAdd: nullableNumber,
  availableCapacity: nullableNumber,
  recommended: recommendedMetaSchema,
  strategy: strategySchema.optional(),
  answers: z.array(diagnosticAnswerSchema),
  campaignBriefId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CommercialDiagnosisResponse = z.infer<typeof commercialDiagnosisResponseSchema>;

export const acceptDiagnosisResponseSchema = z.object({
  diagnosis: commercialDiagnosisResponseSchema,
  campaignBrief: z.object({
    id: z.string().min(1),
    businessId: z.string().min(1),
    serviceId: z.string().min(1),
    title: z.string().min(1).max(TITLE_MAX),
    status: z.enum(['DRAFT', 'APPROVED', 'ARCHIVED']),
    businessObjective: z.string().min(5),
    offer: z.string().min(5),
    primaryKpi: z.string().min(1),
    idealCustomerProfile: z.string().nullable(),
    qualifyingQuestions: z.array(z.string()),
    monthlyAcquisitionGoal: z.number().int().nullable(),
    costPerAcquisitionCap: z.string().nullable(),
    lifetimeBudgetCap: z.string().nullable(),
    dailyBudgetCap: z.string().nullable(),
    plannedDurationDays: z.number().int().nullable(),
    constraints: z.array(z.string()),
    stopIf: z.string().nullable(),
    scaleIf: z.string().nullable(),
    approvedAt: z.string().nullable(),
    approvedBy: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});
export type AcceptDiagnosisResponse = z.infer<typeof acceptDiagnosisResponseSchema>;

// -----------------------------------------------------------------------------
// Constantes que la UI y el módulo comparten
// -----------------------------------------------------------------------------

export const COMMERCIAL_DIAGNOSIS_MAX_QUESTIONS = 3;
export const RECOMMENDED_FALLBACK_TITLE = 'Plan basado en diagnóstico';
export const RECOMMENDED_FALLBACK_OFFER =
  'Reserva tu próxima sesión con agenda previa';

// -----------------------------------------------------------------------------
// Esquema Zod para validar la salida cruda del modelo (P1-6)
// -----------------------------------------------------------------------------

/**
 * Esquema discriminado para validar la respuesta cruda del modelo antes
 * de persistirla. El parser tolerante del servicio sigue aceptando
 * variantes razonables (claves con mayúsculas/minúsculas, números como
 * strings, etc.) y este Zod es la red de seguridad final: cualquier
 * valor fuera de rango se descarta y se fuerza un fallback determinista.
 *
 * Decisión:
 *  - `READY`: la IA ya tiene suficiente información. Trae `situation`,
 *    `opportunity`, `primaryGoal`, `recommendedTitle` como strings no
 *    vacíos; `recommendedWeeklyAdd` y `availableCapacity` como enteros en
 *    rangos razonables; `strategy` opcional con los topes duros
 *    (presupuestos positivos, listas acotadas).
 *  - `ASK`: la IA necesita UNA pregunta concreta. `key` y `text` son
 *    strings no vacíos dentro de los límites ya definidos.
 *
 * NO se aplica este esquema al JSON de la respuesta cruda
 * (`OpenAISummaryResult.parsed`); se aplica a la estructura ya coercida
 * por el parser tolerante para mantener compatibilidad con prompts
 * históricos.
 */
const openAiBudget = z
  .number()
  .positive()
  .finite()
  .max(OPEN_AI_BUDGET_MAX);
void openAiBudget; // marcador para mantener la constante; el consumo real usa `openAiBudgetOrNull`

const openAiBudgetOrNull = z
  .number()
  .positive()
  .finite()
  .max(OPEN_AI_BUDGET_MAX)
  .nullable()
  .optional();

const openAiCpa = z
  .number()
  .positive()
  .finite()
  .max(OPEN_AI_CPA_MAX)
  .nullable()
  .optional()
  .refine((value) => value === undefined || value === null || value > 0, {
    message: 'Costo por adquisición (CPA) debe ser positivo cuando se entrega',
  });

/**
 * Valida que, cuando la IA entrega TANTO el CPA objetivo como el
 * máximo aceptable (tope), el tope no quede por debajo del objetivo. Si
 * llega así, descartamos el candidato con un mensaje claro (la IA debe
 * proponer un tope coherente con el objetivo que eligió).
 */
const assertCpaOrdering = (
  value: { initialCpaTargetCLP?: number | null; initialCpaCapCLP?: number | null },
  ctx: z.RefinementCtx,
): void => {
  const target = value.initialCpaTargetCLP;
  const cap = value.initialCpaCapCLP;
  if (
    typeof target === 'number' &&
    Number.isFinite(target) &&
    target > 0 &&
    typeof cap === 'number' &&
    Number.isFinite(cap) &&
    cap > 0 &&
    cap < target
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'El máximo aceptable por adquisición (tope de CPA) no puede ser menor que el Costo por adquisición (CPA) objetivo propuesto',
      path: ['initialCpaCapCLP'],
    });
  }
};

const openAiStrategySchema = z
  .object({
    businessObjective: z.string().trim().min(1).max(OPEN_AI_STRATEGY_RULE_MAX),
    offer: z.string().trim().min(1).max(OPEN_AI_STRATEGY_RULE_MAX),
    primaryKpi: z.string().trim().min(1).max(KPI_MAX),
    idealCustomerProfile: z
      .string()
      .trim()
      .max(OPEN_AI_STRATEGY_RULE_MAX)
      .nullable()
      .optional(),
    qualifyingQuestions: z
      .array(z.string().trim().min(1).max(STRATEGY_ITEM_MAX))
      .max(20),
    constraints: z
      .array(z.string().trim().min(1).max(STRATEGY_ITEM_MAX))
      .max(20),
    stopIf: z.string().trim().max(OPEN_AI_STRATEGY_RULE_MAX).nullable().optional(),
    scaleIf: z.string().trim().max(OPEN_AI_STRATEGY_RULE_MAX).nullable().optional(),
    initialDailyBudgetCLP: openAiBudgetOrNull,
    initialLifetimeBudgetCLP: openAiBudgetOrNull,
    initialDurationDays: z.number().int().positive().max(365),
    initialCpaTargetCLP: openAiCpa,
    initialCpaCapCLP: openAiCpa,
    /**
     * Justificación breve que la IA entrega para el Costo por
     * adquisición (CPA) objetivo propuesto en modo `NO_EVIDENCE`.
     * Opcional: si la IA no la entrega, la omitimos sin romper el
     * contrato. Límite 200 caracteres para alinear con el tope de
     * cada entrada en `assumptions` (≤200 chars) y no romper el
     * contrato público.
     */
    cpaRationale: z.string().trim().max(200).optional(),
    /**
     * Justificación del precio objetivo de la oferta. Opcional — sólo
     * se exige si la IA propone un precio distinto al del servicio.
     * Límite 200 caracteres para alinear con el resto de strings cortos.
     */
    priceJustification: z.string().trim().max(200).optional(),
    progressionSteps: z
      .array(z.number().int().positive().max(1000))
      .max(OPEN_AI_PROGRESSION_STEPS_MAX),
  })
  .strict()
  .superRefine(assertCpaOrdering);

const readyDecisionFields = {
  situation: z.string().trim().min(1).max(PRIMARY_TEXT_MAX),
  opportunity: z.string().trim().min(1).max(PRIMARY_TEXT_MAX),
  primaryGoal: z.string().trim().min(1).max(PRIMARY_TEXT_MAX),
  primaryConversion: z.string().trim().min(1).max(KPI_MAX).nullable().optional(),
  recommendedTitle: z.string().trim().min(1).max(TITLE_MAX),
  recommendedWeeklyAdd: z
    .number()
    .int()
    .positive()
    .max(100)
    .nullable()
    .optional(),
  availableCapacity: z.number().int().nonnegative().max(1000).nullable().optional(),
};

const askDecisionFields = {
  situation: z.string().trim().min(1).max(PRIMARY_TEXT_MAX),
  opportunity: z.string().trim().max(PRIMARY_TEXT_MAX).nullable().optional(),
  primaryGoal: z.string().trim().max(PRIMARY_TEXT_MAX).nullable().optional(),
  primaryConversion: z.string().trim().max(KPI_MAX).nullable().optional(),
  recommendedTitle: z.string().trim().max(TITLE_MAX).nullable().optional(),
  recommendedWeeklyAdd: z
    .number()
    .int()
    .positive()
    .max(100)
    .nullable()
    .optional(),
  availableCapacity: z.number().int().nonnegative().max(1000).nullable().optional(),
};

export const OPEN_AI_DECISION_SCHEMA = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('READY'),
      ...readyDecisionFields,
      strategy: openAiStrategySchema.optional(),
    })
    .strict(),
  z
    .object({
      decision: z.literal('ASK'),
      ...askDecisionFields,
      pendingQuestion: z.object({
        key: z.string().trim().min(1).max(QUESTION_KEY_MAX),
        text: z.string().trim().min(1).max(QUESTION_TEXT_MAX),
      }),
    })
    .strict(),
]);

export type OpenAiDecision = z.infer<typeof OPEN_AI_DECISION_SCHEMA>;