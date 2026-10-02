import type { Service } from '@prisma/client';
import type { ProvenanceMap } from './dto/commercial-diagnosis.dto';

/**
 * Tipos internos del módulo `CommercialDiagnosis`. Separan el contrato
 * HTTP (en `dto/commercial-diagnosis.dto.ts`) de los snapshots que se
 * inyectan en el prompt y de las formas que consume el servicio al
 * persistir.
 *
 * Mantener este archivo aparte evita acoplar el DTO al prompt y a las
 * decisiones internas (por ejemplo `wasClarification`).
 */

/**
 * Modo de estimación de CPA que se inyecta al prompt. Determina si la
 * IA puede proponer un Costo por adquisición (CPA) objetivo inicial (sin
 * evidencia histórica) o si debe atenerse al promedio observado.
 *  - `EVIDENCE`: hay muestra suficiente (`hasEnoughEvidence=true`). La
 *    IA debe atenerse al Costo por adquisición (CPA) histórico.
 *  - `NO_EVIDENCE`: no hay muestra suficiente. La IA PUEDE proponer un
 *    CPA objetivo inicial, un máximo aceptable (tope) y una
 *    justificación breve.
 */
export type EvidenceMode = 'EVIDENCE' | 'NO_EVIDENCE';

/**
 * Snapshot del contexto del negocio que se inyecta al prompt. Es la
 * combinación del `BusinessProfile` resuelto, el contexto territorial
 * (cuando está disponible) y los servicios activos. NO se devuelve al
 * frontend.
 */
export interface DiagnosisContext {
  profileReady: boolean;
  primaryCustomerProfile: string;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: number | null;
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: number | null;
  displayLocation: string;
  communeName: string | null;
  regionName: string | null;
  income: number | null;
  population: number | null;
  profileDescription: string | null;
  /**
   * Modo de evidencia que afecta las reglas del SYSTEM_INSTRUCTIONS:
   * permite a la IA proponer CPA objetivo inicial sólo en modo
   * `NO_EVIDENCE`. El `DiagnosisContext` NO carga directamente la
   * evidencia (eso lo hace el servicio para alimentar el motor
   * determinista); aquí sólo necesitamos el flag para el prompt.
   */
  evidenceMode: EvidenceMode;
  /**
   * Precio referencial del servicio principal (CLP). Se usa sólo cuando
   * la IA propone un CPA objetivo inicial: permite descartar valores
   * absurdos (CPA > 2× precio del servicio) en la validación del
   * payload final. `null` cuando no hay servicio o no tiene precio.
   */
  primaryServicePrice: number | null;
  services: Array<Pick<Service, 'id' | 'name' | 'description' | 'price' | 'currency' | 'duration'>>;
}

/**
 * Payload completo que consume el prompt builder. Es la combinación de:
 *
 *  - `context`: el snapshot del negocio.
 *  - `currentSituation`: el texto libre que escribió el operador.
 *  - `conversation`: las preguntas formuladas y respondidas hasta el
 *    momento (puede estar vacío en la primera llamada).
 *  - `existingRecommended`: la `recommended` previa cuando estamos en una
 *    llamada de `adjust`. `null` en el flujo normal de `start`/`answer`.
 */
export interface DiagnosisPayload {
  context: DiagnosisContext;
  currentSituation: string;
  serviceId: string | null;
  conversation: DiagnosticConversationEntry[];
  existingRecommended: {
    situation: string | null;
    opportunity: string | null;
    primaryGoal: string | null;
    primaryConversion: string | null;
    recommendedTitle: string | null;
    recommendedWeeklyAdd: number | null;
    availableCapacity: number | null;
  } | null;
}

/**
 * Una entrada de la conversación del operador con la IA. `answerText`
 * puede ser `null` mientras la pregunta está pendiente; `wasClarification`
 * distingue la pregunta IA → operador de las réplicas operario → IA.
 */
export interface DiagnosticConversationEntry {
  questionKey: string;
  questionText: string;
  answerText: string | null;
  wasClarification: boolean;
}

/**
 * Salida cruda esperada del modelo. El parser tolerante (`parseModelDecision`)
 * acepta variantes razonables antes de volcarla a este shape.
 */
export interface ParsedDiagnosisDecision {
  decision: 'READY' | 'ASK';
  recommended: {
    situation: string | null;
    opportunity: string | null;
    primaryGoal: string | null;
    primaryConversion: string | null;
    recommendedTitle: string | null;
    recommendedWeeklyAdd: number | null;
    availableCapacity: number | null;
    pendingQuestion: { key: string; text: string } | null;
  };
  provenance: ProvenanceMap;
  strategy: StrategyShape | null;
}

export interface StrategyShape {
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  initialDailyBudgetCLP: number | null;
  initialLifetimeBudgetCLP: number | null;
  initialDurationDays: number;
  initialCpaTargetCLP: number | null;
  initialCpaCapCLP: number | null;
  /**
   * Justificación breve que la IA entrega para el Costo por
   * adquisición (CPA) objetivo propuesto. Sólo se usa en modo
   * `NO_EVIDENCE` (cuando la IA está proponiendo el CPA en lugar de
   * medirlo). En modo `EVIDENCE` queda como `null`. La persistencia no
   * tiene columna propia: el servicio la guarda en `assumptions[0]` (ver
   * `combineStrategyWithBudgetRecommendation`).
   */
  cpaRationale: string | null;
  /**
   * Justificación del precio objetivo de la oferta (≤ 500 caracteres).
   * Cuando el servicio valida el JSON de OpenAI, los precios objetivo
   * deben estar respaldados por `priceJustification` si difieren del
   * precio del servicio registrado. Opcional — no se persiste todavía,
   * queda en la strategy para futuras rondas.
   */
  priceJustification: string | null;
  progressionSteps: number[];
  recommendedStartDate: string | null;
  recommendedEndDate: string | null;
  recommendedWeekdays: number[];
  budgetExplanation: string | null;
  scheduleExplanation: string | null;
  assumptions: string[];
  goalAssessment:
    | {
        status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA';
        explanation: string;
        disclaimer: string;
      }
    | null;
}

/**
 * Helper de construcción del payload a partir del contexto resuelto.
 * Acepta un `currentSituation` libre y una lista de respuestas previas.
 * Lo centraliza aquí para que `service.start`, `service.answer` y
 * `service.adjust` compartan exactamente la misma forma.
 */
export const buildDiagnosisPayload = (params: {
  context: DiagnosisContext;
  currentSituation: string;
  serviceId: string | null;
  conversation?: DiagnosticConversationEntry[];
  existingRecommended?: DiagnosisPayload['existingRecommended'];
}): DiagnosisPayload => ({
  context: params.context,
  currentSituation: params.currentSituation,
  serviceId: params.serviceId,
  conversation: params.conversation ?? [],
  existingRecommended: params.existingRecommended ?? null,
});

/**
 * Tipo de instrucción adicional para el prompt de ajuste. Lo definimos
 * aparte porque sólo lo consume `adjust` (no el flujo normal).
 */
export type DiagnosisAdjustment = {
  instruction: string;
  payload: DiagnosisPayload;
};