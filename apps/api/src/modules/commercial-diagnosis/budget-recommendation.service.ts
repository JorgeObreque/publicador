import { Injectable } from '@nestjs/common';
import type { DiagnosisEvidence } from './diagnosis-evidence.service';

/**
 * Motor determinista de recomendación de presupuesto, duración y
 * programación para el `CommercialDiagnosis`.
 *
 * Recibe la `recommended` declarada por el operador (semanal / capacidad /
 * CPA objetivo propuesto y CPA tope) más la evidencia histórica agregada
 * por `DiagnosisEvidenceService` y produce una recomendación honesta sobre:
 *
 *  - `confidence`: grado de soporte (SUPPORTED / TESTABLE / UNLIKELY /
 *    INSUFFICIENT_DATA).
 *  - `dailyBudget` y `lifetimeBudget` en CLP (enteros).
 *  - `durationDays` (entre 7 y 21).
 *  - `recommendedStartDate` y `recommendedEndDate` (YYYY-MM-DD UTC).
 *  - `recommendedWeekdays` (0..6) cuando la evidencia lo permite.
 *  - `budgetExplanation` y `scheduleExplanation` (frases en español).
 *  - `assumptions`: supuestos explícitos (≤5).
 *  - `goalAssessment`: estado de la meta + explicación + disclaimer.
 *
 * Reglas (ver `recommend`):
 *  - `conversionesObjetivo = weeklyAdd * durationDays / 7` (Math.ceil).
 *  - Caso EVIDENCE: hay evidencia suficiente y `averageCpa > 0`. El
 *    presupuesto se deriva del CPA histórico observado (no del
 *    propuesto). Mínimo 1000 CLP/día si `lifetimeBudget > 0`.
 *  - Caso TESTABLE: sin evidencia pero la IA (o el fallback) propuso un
 *    `cpaTarget > 0`. El presupuesto se calcula con ese CPA propuesto
 *    (`naturalLifetime = conversionesObjetivo * cpaTarget`); el `cpaCap`
 *    NO se usa para acotar el daily, sólo entra en `assessConfidence`
 *    como tope duro para detectar escala absurda.
 *  - Caso INSUFFICIENT_DATA: sin evidencia ni `cpaTarget` propuesto.
 *  - Si el `lifetimeBudget` excede un umbral absoluto (escala absurda),
 *    marca UNLIKELY. El tope usado es el `cpaCap` (cuando está presente).
 *
 * El servicio es puro (no toca Prisma) — los tests pueden invocarlo
 * directamente. El `CommercialDiagnosisService` lo invoca después de la
 * decisión del modelo (o del fallback determinista) y combina los
 * resultados con la respuesta del modelo.
 */

export type BudgetConfidence =
  | 'SUPPORTED'
  | 'TESTABLE'
  | 'UNLIKELY'
  | 'INSUFFICIENT_DATA';

export type GoalAssessmentStatus = BudgetConfidence;

export interface GoalAssessment {
  status: GoalAssessmentStatus;
  explanation: string;
  disclaimer: string;
}

export interface BudgetRecommendation {
  confidence: BudgetConfidence;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  durationDays: number;
  recommendedStartDate: string;
  recommendedEndDate: string;
  recommendedWeekdays: number[];
  budgetExplanation: string;
  scheduleExplanation: string;
  assumptions: string[];
  goalAssessment: GoalAssessment;
  /**
   * CPA objetivo efectivo que el motor usó como base del cálculo (el
   * promedio histórico en modo EVIDENCE, o el propuesto en modo
   * TESTABLE). Es `null` en modo INSUFFICIENT_DATA.
   */
  cpaTarget: number | null;
  /**
   * Tope duro de CPA que el motor usó para detectar "escala absurda".
   * Es el `BusinessProfile.costPerAcquisitionCap` o el propuesto por la
   * IA. Es `null` cuando no se proporcionó ninguno.
   */
  cpaCap: number | null;
}

/**
 * Disclaimer obligatorio. Se concatena a cualquier `goalAssessment` para
 * dejar claro que la propuesta no garantiza ventas/reservas.
 */
export const BUDGET_DISCLAIMER =
  'La inversión propuesta no garantiza reservas ni ventas; el resultado depende de entrega, audiencia, creatividad y conversión.';

const DEFAULT_DURATION_DAYS = 14;
const MIN_DURATION_DAYS = 7;
const MAX_DURATION_DAYS = 21;

/** Mínimo diario permitido cuando hay un lifetimeBudget > 0. */
const MIN_DAILY_BUDGET_CLP = 1_000;

/**
 * Umbral absoluto de "escala absurda": si el lifetimeBudget propuesto
 * supera `cpaCap * conversionesObjetivoMensual * 4`, marcamos UNLIKELY.
 * El factor 4x absorbe hasta un mes entero por encima del CPA objetivo.
 */
const ABSURD_SCALE_MULTIPLIER = 4;

/**
 * Padding de ceros a la izquierda de un entero (UTC).
 */
const pad2 = (value: number): string => value.toString().padStart(2, '0');

/**
 * Devuelve el día civil UTC siguiente a `now` (mañana, sin hora).
 */
export const nextDayUtc = (now: Date): Date => {
  const tomorrow = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return tomorrow;
};

/**
 * Devuelve `date` como string `YYYY-MM-DD` UTC.
 */
const toIsoDay = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;

/**
 * Devuelve `date + days` como día civil UTC.
 */
const addDaysUtc = (date: Date, days: number): Date => {
  const out = new Date(date.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
};

/**
 * Acota la duración al rango válido (7..21). Si llega `null`/`undefined`
 * o un valor fuera de rango, devuelve el default (14).
 */
const clampDuration = (days: number | null | undefined): number => {
  if (days === null || days === undefined) return DEFAULT_DURATION_DAYS;
  if (!Number.isFinite(days)) return DEFAULT_DURATION_DAYS;
  const rounded = Math.round(days);
  if (rounded < MIN_DURATION_DAYS) return MIN_DURATION_DAYS;
  if (rounded > MAX_DURATION_DAYS) return MAX_DURATION_DAYS;
  return rounded;
};

/**
 * Versión interna del input que asegura defaults sensatos incluso
 * cuando el caller entrega nulls parciales.
 *
 * Semántica:
 *  - `cpaTarget` es el CPA OBJETIVO propuesto (esperado durante la
 *    primera prueba). En modo EVIDENCE lo fija desde `evidence.averageCpa`;
 *    en modo TESTABLE lo entrega la IA (o el fallback) como hipótesis.
 *  - `cpaCap` es el CPA TOPE duro que detiene la campaña. Sólo se usa
 *    en `assessConfidence` para detectar escala absurda.
 */
export interface BudgetRecommendationInput {
  weeklyAdd: number | null;
  capacity: number | null;
  cpaTarget: number | null;
  cpaCap: number | null;
  evidence: DiagnosisEvidence;
  /** Duración solicitada (opcional). Si no viene o está fuera de rango, se usa default. */
  durationDays?: number | null;
  /** Fecha actual inyectable (tests deterministas). */
  now: Date;
}

type ExplanationMode = 'EVIDENCE' | 'TESTABLE' | 'INSUFFICIENT_DATA' | 'TESTABLE_NO_VOLUME';

@Injectable()
export class BudgetRecommendationService {
  /**
   * Produce una recomendación determinista a partir de la evidencia y los
   * topes del operador. Ver doc del servicio para el detalle de las reglas.
   */
  recommend(input: BudgetRecommendationInput): BudgetRecommendation {
    const { weeklyAdd, capacity, cpaCap, cpaTarget: cpaTargetInput, evidence } = input;
    const now = input.now;
    const durationDays = clampDuration(input.durationDays ?? null);

    const startDate = nextDayUtc(now);
    const endDate = addDaysUtc(startDate, durationDays - 1);
    const recommendedStartDate = toIsoDay(startDate);
    const recommendedEndDate = toIsoDay(endDate);

    // conversionesObjetivo = weeklyAdd * durationDays / 7 (redondeo hacia arriba)
    let conversionesObjetivo = 0;
    if (weeklyAdd !== null && weeklyAdd > 0) {
      conversionesObjetivo = Math.max(
        1,
        Math.ceil((weeklyAdd * durationDays) / 7),
      );
    }

    const assumptions: string[] = [];
    const recommendedWeekdays = this.computeRecommendedWeekdays(evidence);

    // Caso 1: hay evidencia suficiente con CPA histórico.
    // El CPA objetivo efectivo es `evidence.averageCpa`; el `cpaTarget`
    // de entrada se descarta en este modo (lo respeta la IA sólo si ella
    // lo prefiere, pero el motor ya tiene dato histórico).
    if (evidence.hasEnoughEvidence && evidence.averageCpa > 0) {
      const effectiveCpaTarget = evidence.averageCpa;
      const averageCpa = evidence.averageCpa;
      const naturalLifetime = Math.round(conversionesObjetivo * averageCpa);
      const naturalDailyBudget = naturalLifetime / durationDays;
      const { daily, belowMinimum } = this.applyDailyMinimum(
        naturalDailyBudget,
        naturalLifetime,
      );
      const dailyBudget = daily;
      // Sincronizamos el lifetime con el daily final para que la UI nunca
      // muestre una inconsistencia del tipo "$1.000 diarios · máximo $8.000"
      // (que era matemáticamente falso: 1000 × 14 = 14000).
      const lifetimeBudget = belowMinimum
        ? Math.round(dailyBudget * durationDays)
        : Math.round(naturalDailyBudget * durationDays);
      const confidence = this.assessConfidence({
        lifetimeBudget,
        dailyBudget,
        conversionesObjetivo,
        weeklyAdd,
        capacity,
        cpaTarget: effectiveCpaTarget,
        cpaCap,
        averageCpa,
        belowDailyMinimum: belowMinimum,
      });
      const { explanation, schedule, assumptions: assumptionList } =
        this.buildExplanations({
          mode: 'EVIDENCE',
          weeklyAdd,
          conversionesObjetivo,
          durationDays,
          averageCpa,
          dailyBudget,
          lifetimeBudget,
          naturalDailyBudget,
          cpaCap,
          cpaTarget: effectiveCpaTarget,
          recommendedWeekdays,
          belowMinimum,
        });
      assumptions.push(...assumptionList);
      const goalAssessment = this.buildGoalAssessment({
        confidence,
        weeklyAdd,
        capacity,
        conversionesObjetivo,
        dailyBudget,
        naturalDailyBudget,
        cpaCap,
        averageCpa,
        durationDays,
        mode: 'EVIDENCE',
        cpaTarget: effectiveCpaTarget,
      });
      return {
        confidence,
        dailyBudget,
        lifetimeBudget,
        durationDays,
        recommendedStartDate,
        recommendedEndDate,
        recommendedWeekdays,
        budgetExplanation: explanation,
        scheduleExplanation: schedule,
        assumptions,
        goalAssessment,
        cpaTarget: effectiveCpaTarget,
        cpaCap,
      };
    }

    // Caso 2a: sin evidencia, la IA (o el caller) propuso un CPA
    // objetivo > 0, y HAY volumen semanal declarado → modo TESTABLE con
    // presupuesto calculado. El presupuesto se calcula a partir del CPA
    // propuesto (sin topear el daily contra el cpaCap). El `cpaCap`
    // sólo se respeta como tope duro en `assessConfidence` para
    // detectar escala absurda.
    if (
      cpaTargetInput !== null &&
      cpaTargetInput > 0 &&
      weeklyAdd !== null &&
      weeklyAdd > 0
    ) {
      const effectiveCpaTarget = cpaTargetInput;
      const naturalLifetime = Math.round(conversionesObjetivo * effectiveCpaTarget);
      const naturalDailyBudget = naturalLifetime / durationDays;
      const { daily, belowMinimum } = this.applyDailyMinimum(
        naturalDailyBudget,
        naturalLifetime,
      );
      const dailyBudget = daily;
      // Sincronizamos el lifetime con el daily final cuando el clamp del
      // mínimo diario entró en juego (ver Caso 1 para el rationale).
      const lifetimeBudget = belowMinimum
        ? Math.round(dailyBudget * durationDays)
        : Math.round(naturalDailyBudget * durationDays);
      const confidence = this.assessConfidence({
        lifetimeBudget,
        dailyBudget,
        conversionesObjetivo,
        weeklyAdd,
        capacity,
        cpaTarget: effectiveCpaTarget,
        cpaCap,
        averageCpa: 0,
        belowDailyMinimum: belowMinimum,
      });
      const { explanation, schedule, assumptions: assumptionList } =
        this.buildExplanations({
          mode: 'TESTABLE',
          weeklyAdd,
          conversionesObjetivo,
          durationDays,
          averageCpa: 0,
          dailyBudget,
          lifetimeBudget,
          naturalDailyBudget,
          cpaCap,
          cpaTarget: effectiveCpaTarget,
          recommendedWeekdays,
          belowMinimum,
        });
      assumptions.push(...assumptionList);
      const goalAssessment = this.buildGoalAssessment({
        confidence,
        weeklyAdd,
        capacity,
        conversionesObjetivo,
        dailyBudget,
        naturalDailyBudget,
        cpaCap,
        averageCpa: 0,
        durationDays,
        mode: 'TESTABLE',
        cpaTarget: effectiveCpaTarget,
      });
      return {
        confidence,
        dailyBudget,
        lifetimeBudget,
        durationDays,
        recommendedStartDate,
        recommendedEndDate,
        recommendedWeekdays,
        budgetExplanation: explanation,
        scheduleExplanation: schedule,
        assumptions,
        goalAssessment,
        cpaTarget: effectiveCpaTarget,
        cpaCap,
      };
    }

    // Caso 2b: sin evidencia ni volumen semanal, pero la IA propuso un
    // CPA objetivo > 0 → TESTABLE sin presupuesto calculado. La IA está
    // proponiendo el CPA objetivo como primera prueba, pero no puede
    // derivar presupuesto diario ni lifetime sin conocer la meta
    // semanal. Devolvemos TESTABLE para que la UI muestre el CPA
    // objetivo propuesto y explique que el presupuesto se completará al
    // confirmar el volumen semanal.
    if (
      cpaTargetInput !== null &&
      cpaTargetInput > 0
    ) {
      const confidence: BudgetConfidence = 'TESTABLE';
      const goalAssessment = this.buildGoalAssessment({
        confidence,
        weeklyAdd,
        capacity,
        conversionesObjetivo,
        dailyBudget: null,
        naturalDailyBudget: 0,
        cpaCap,
        averageCpa: 0,
        durationDays,
        mode: 'TESTABLE_NO_VOLUME',
        cpaTarget: cpaTargetInput,
      });
      const { explanation, schedule, assumptions: assumptionList } =
        this.buildExplanations({
          mode: 'TESTABLE',
          weeklyAdd,
          conversionesObjetivo,
          durationDays,
          averageCpa: 0,
          dailyBudget: null,
          lifetimeBudget: null,
          naturalDailyBudget: 0,
          cpaCap,
          cpaTarget: cpaTargetInput,
          recommendedWeekdays,
          belowMinimum: false,
        });
      assumptions.push(...assumptionList);
      return {
        confidence,
        dailyBudget: null,
        lifetimeBudget: null,
        durationDays,
        recommendedStartDate,
        recommendedEndDate,
        recommendedWeekdays,
        budgetExplanation: explanation,
        scheduleExplanation: schedule,
        assumptions,
        goalAssessment,
        cpaTarget: cpaTargetInput,
        cpaCap,
      };
    }

    // Caso 3: sin evidencia ni cpaTarget propuesto → INSUFFICIENT_DATA.
    const confidence: BudgetConfidence = 'INSUFFICIENT_DATA';
    const goalAssessment = this.buildGoalAssessment({
      confidence,
      weeklyAdd,
      capacity,
      conversionesObjetivo,
      dailyBudget: null,
      naturalDailyBudget: 0,
      cpaCap,
      averageCpa: 0,
      durationDays,
      mode: 'INSUFFICIENT_DATA',
      cpaTarget: null,
    });
    const { explanation, schedule, assumptions: assumptionList } =
      this.buildExplanations({
        mode: 'INSUFFICIENT_DATA',
        weeklyAdd,
        conversionesObjetivo,
        durationDays,
        averageCpa: 0,
        dailyBudget: null,
        lifetimeBudget: null,
        naturalDailyBudget: 0,
        cpaCap,
        cpaTarget: null,
        recommendedWeekdays,
        belowMinimum: false,
      });
    assumptions.push(...assumptionList);
    return {
      confidence,
      dailyBudget: null,
      lifetimeBudget: null,
      durationDays,
      recommendedStartDate,
      recommendedEndDate,
      recommendedWeekdays,
      budgetExplanation: explanation,
      scheduleExplanation: schedule,
      assumptions,
      goalAssessment,
      cpaTarget: null,
      cpaCap,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private computeRecommendedWeekdays(evidence: DiagnosisEvidence): number[] {
    if (!evidence.hasEnoughEvidence) return [];
    const filtered = evidence.bestWeekdays.filter(
      (weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6,
    );
    return filtered.slice(0, 7);
  }

  private applyDailyMinimum(
    rawDaily: number,
    lifetimeBudget: number,
  ): { daily: number; belowMinimum: boolean } {
    if (lifetimeBudget <= 0) return { daily: 0, belowMinimum: false };
    const rounded = Math.round(rawDaily);
    const belowMinimum = rounded < MIN_DAILY_BUDGET_CLP;
    if (belowMinimum) {
      return { daily: MIN_DAILY_BUDGET_CLP, belowMinimum: true };
    }
    return { daily: rounded, belowMinimum: false };
  }

  private assessConfidence(args: {
    lifetimeBudget: number;
    dailyBudget: number | null;
    conversionesObjetivo: number;
    weeklyAdd: number | null;
    capacity: number | null;
    cpaTarget: number | null;
    cpaCap: number | null;
    averageCpa: number;
    belowDailyMinimum?: boolean;
  }): BudgetConfidence {
    const {
      lifetimeBudget,
      weeklyAdd,
      capacity,
      cpaCap,
      averageCpa,
      belowDailyMinimum,
    } = args;
    if (belowDailyMinimum === true) {
      return 'UNLIKELY';
    }
    // Escala absurda: lifetimeBudget > cpaCap * conversionesObjetivoMensual * 4.
    // conversionesObjetivoMensual ≈ weeklyAdd * 4 (no del periodo).
    if (cpaCap !== null && cpaCap > 0 && args.weeklyAdd !== null && args.weeklyAdd > 0) {
      const conversionesObjetivoMensual = args.weeklyAdd * 4;
      const threshold = cpaCap * conversionesObjetivoMensual * ABSURD_SCALE_MULTIPLIER;
      if (lifetimeBudget > threshold) {
        return 'UNLIKELY';
      }
    }
    // Si lifetimeBudget es 0 → INSUFFICIENT_DATA.
    if (lifetimeBudget <= 0) return 'INSUFFICIENT_DATA';
    // Si la meta semanal declarada excede la capacidad semanal
    // registrada, marcamos TESTABLE (no imposible, pero no realista).
    // Comparamos `weeklyAdd > capacity` directamente: multiplicar
    // capacidad por la propia meta hacía crecer el threshold con la
    // meta y producía falsos SUPPORTED.
    if (
      capacity !== null &&
      capacity > 0 &&
      weeklyAdd !== null &&
      weeklyAdd > capacity
    ) {
      return 'TESTABLE';
    }
    // Si hay evidencia y averageCpa > 0 → SUPPORTED.
    if (averageCpa > 0) return 'SUPPORTED';
    // Si llegamos aquí es porque había cpaTarget propuesto pero no
    // evidencia: TESTABLE (la meta es razonable a priori).
    return 'TESTABLE';
  }

  private buildExplanations(args: {
    mode: ExplanationMode;
    weeklyAdd: number | null;
    conversionesObjetivo: number;
    durationDays: number;
    averageCpa: number;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    naturalDailyBudget: number;
    cpaCap: number | null;
    cpaTarget: number | null;
    recommendedWeekdays: number[];
    belowMinimum?: boolean;
  }): { explanation: string; schedule: string; assumptions: string[] } {
    const { mode, weeklyAdd, conversionesObjetivo, durationDays } = args;
    void args.averageCpa;
    const assumptions: string[] = [];
    let explanation = '';
    let schedule = '';

    if (mode === 'EVIDENCE') {
      const cpaLabel = formatClp(args.averageCpa);
      const weeklyLabel = weeklyAdd !== null ? `${weeklyAdd}` : 'N/D';
      if (args.belowMinimum) {
        const naturalDaily = formatClp(args.naturalDailyBudget);
        const dailyLabel = formatClp(args.dailyBudget ?? MIN_DAILY_BUDGET_CLP);
        const lifetimeLabel = formatClp(args.lifetimeBudget ?? 0);
        explanation = `Con ${weeklyLabel} conversiones/semana durante ${durationDays} días (≈${conversionesObjetivo} en el periodo) y un costo por adquisición (CPA) histórico de ${cpaLabel}, el presupuesto diario natural sería de ${naturalDaily}; como Meta no entrega con menos del mínimo diario, ajustamos a ${dailyLabel} y el total del periodo sube a ${lifetimeLabel}. Esta escala queda por debajo del costo por adquisición (CPA) histórico: probablemente no alcanza la meta declarada.`;
        assumptions.push(
          `Costo por adquisición (CPA) histórico observado: ${cpaLabel}.`,
          `Presupuesto diario natural: ${naturalDaily} (subió al mínimo ${dailyLabel} para que Meta entregue).`,
          `Conversiones objetivo del periodo: ${conversionesObjetivo}.`,
        );
      } else {
        explanation = `Con ${weeklyLabel} conversiones/semana durante ${durationDays} días (≈${conversionesObjetivo} en el periodo) y un costo por adquisición (CPA) histórico de ${cpaLabel}, el presupuesto propuesto es coherente con la evidencia reciente del negocio.`;
        assumptions.push(
          `Costo por adquisición (CPA) histórico observado: ${cpaLabel}.`,
          `Conversiones objetivo del periodo: ${conversionesObjetivo}.`,
        );
      }
      if (args.cpaCap !== null && args.cpaCap > 0) {
        assumptions.push(
          `Máximo aceptable por adquisición (tope de CPA): ${formatClp(args.cpaCap)}.`,
        );
      }
    } else if (mode === 'TESTABLE') {
      const cpaLabel = formatClp(args.cpaTarget ?? 0);
      if (args.belowMinimum) {
        const naturalDaily = formatClp(args.naturalDailyBudget);
        const dailyLabel = formatClp(args.dailyBudget ?? MIN_DAILY_BUDGET_CLP);
        const lifetimeLabel = formatClp(args.lifetimeBudget ?? 0);
        explanation = `Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado. Costo por adquisición (CPA) objetivo propuesto: ${cpaLabel}. Con ${weeklyAdd ?? 'N/D'} conversiones/semana durante ${durationDays} días (≈${conversionesObjetivo} en el periodo) y CPA objetivo de ${cpaLabel}, el presupuesto diario natural sería de ${naturalDaily}; ajustamos al mínimo viable de ${dailyLabel} y el total del periodo sube a ${lifetimeLabel}. Esta escala queda por debajo del CPA objetivo: probablemente no alcanza la meta declarada.`;
        assumptions.push(
          `Costo por adquisición (CPA) objetivo propuesto: ${cpaLabel}.`,
          `Presupuesto diario natural: ${naturalDaily} (subió al mínimo ${dailyLabel} para que Meta entregue).`,
          `Sin evidencia histórica: la cifra es una hipótesis, no un promedio observado.`,
        );
      } else {
        explanation = `Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado. Costo por adquisición (CPA) objetivo propuesto: ${cpaLabel}. El presupuesto propuesto se obtiene a partir de este CPA objetivo (${cpaLabel}) y la meta declarada (${weeklyAdd ?? 'N/D'} conversiones/semana durante ${durationDays} días).`;
        assumptions.push(
          `Costo por adquisición (CPA) objetivo propuesto: ${cpaLabel}.`,
          `Sin evidencia histórica: la cifra es una hipótesis, no un promedio observado.`,
        );
      }
    } else if (mode === 'TESTABLE_NO_VOLUME') {
      // Caso 2b: hay CPA objetivo propuesto pero no hay volumen
      // semanal declarado. Sólo podemos proponer el Costo por
      // adquisición (CPA) objetivo; el presupuesto diario y total se
      // completará al confirmar el volumen semanal.
      const cpaLabel = formatClp(args.cpaTarget ?? 0);
      explanation = `Como no hay historial ni volumen semanal declarado, sólo podemos proponer el Costo por adquisición (CPA) objetivo (${cpaLabel}); el presupuesto diario y total se completará al confirmar el volumen semanal.`;
      assumptions.push(
        `Costo por adquisición (CPA) objetivo propuesto: ${cpaLabel}.`,
        `Sin evidencia histórica: la cifra es una hipótesis, no un promedio observado.`,
      );
    } else {
      explanation =
        'No hay evidencia histórica ni Costo por adquisición (CPA) propuesto. La primera meta se recomienda como prueba para recolectar evidencia.';
      assumptions.push(
        'Falta evidencia histórica de campañas previas.',
        args.cpaCap !== null && args.cpaCap > 0
          ? `Máximo aceptable por adquisición (tope de CPA) registrado: ${formatClp(args.cpaCap)} (no usado para proponer CPA objetivo).`
          : 'Falta Costo por adquisición (CPA) propuesto en el plan.',
      );
    }

    if (args.recommendedWeekdays.length === 0) {
      if (mode === 'INSUFFICIENT_DATA') {
        schedule =
          'Sin muestra suficiente para recomendar días: sugerimos publicar todos los días y aprender.';
      } else if (args.belowMinimum) {
        schedule =
          'Recomendamos publicar todos los días del periodo para maximizar la probabilidad de entrega dentro del presupuesto disponible.';
      } else {
        schedule =
          'Recomendamos publicar todos los días del periodo hasta tener suficiente muestra para detectar patrones semanales.';
      }
    } else if (args.belowMinimum) {
      const days = args.recommendedWeekdays.map(formatWeekdayName).join(', ');
      schedule = `Sugerimos concentrar la pauta en ${days} para compensar el presupuesto diario limitado; sin embargo, la escala del presupuesto probablemente no alcanza la meta declarada.`;
    } else {
      const days = args.recommendedWeekdays.map(formatWeekdayName).join(', ');
      schedule = `Concentra la pauta en ${days} (los días con mejor costo por adquisición (CPA) en la ventana histórica).`;
    }

    if (weeklyAdd !== null && weeklyAdd > 0) {
      assumptions.push(
        `Volumen semanal declarado: ${weeklyAdd} conversiones nuevas por semana.`,
      );
    }
    if (durationDays !== DEFAULT_DURATION_DAYS) {
      assumptions.push(`Duración solicitada: ${durationDays} días.`);
    }

    return { explanation, schedule, assumptions: assumptions.slice(0, 5) };
  }

  private buildGoalAssessment(args: {
    confidence: BudgetConfidence;
    weeklyAdd: number | null;
    capacity: number | null;
    conversionesObjetivo: number;
    dailyBudget: number | null;
    naturalDailyBudget: number;
    cpaCap: number | null;
    averageCpa: number;
    durationDays: number;
    mode: ExplanationMode;
    cpaTarget: number | null;
  }): GoalAssessment {
    const { confidence, weeklyAdd, capacity, conversionesObjetivo, mode } = args;
    let explanation: string;
    switch (confidence) {
      case 'SUPPORTED':
        explanation = `La meta de ${weeklyAdd ?? 'N/D'} conversiones/semana es coherente con la evidencia histórica del negocio y su capacidad registrada.`;
        break;
      case 'TESTABLE':
        if (mode === 'TESTABLE_NO_VOLUME') {
          explanation =
            'Como no hay historial ni volumen semanal declarado, sólo podemos proponer el Costo por adquisición (CPA) objetivo; el presupuesto diario y total se completará al confirmar el volumen semanal.';
        } else if (mode === 'TESTABLE') {
          explanation =
            'Como no hay historial, esta es una estimación basada en servicio, precio, ubicación y meta, no un promedio observado.';
        } else {
          explanation =
            'La meta es agresiva para la capacidad registrada o no tiene evidencia suficiente: conviene probarla y medir antes de escalarla.';
        }
        break;
      case 'UNLIKELY':
        explanation = this.buildInsufficientBudgetExplanation({
          mode,
          weeklyAdd,
          conversionesObjetivo,
          dailyBudget: args.dailyBudget,
          naturalDailyBudget: args.naturalDailyBudget,
          cpaCap: args.cpaCap,
          averageCpa: args.averageCpa,
          durationDays: args.durationDays,
          cpaTarget: args.cpaTarget,
        });
        break;
      case 'INSUFFICIENT_DATA':
      default:
        explanation =
          'Sin datos históricos ni Costo por adquisición (CPA) propuesto no podemos afirmar si la meta es viable: requiere una primera prueba para recoger evidencia.';
        break;
    }
    if (
      capacity !== null &&
      capacity > 0 &&
      weeklyAdd !== null &&
      weeklyAdd > 0 &&
      conversionesObjetivo > 0
    ) {
      const capacidadMensual = capacity * 4;
      explanation += ` Capacidad semanal registrada: ${capacity}; capacidad mensual aproximada: ${capacidadMensual}; meta del periodo: ${conversionesObjetivo} conversiones.`;
    }
    return {
      status: confidence,
      explanation,
      disclaimer: BUDGET_DISCLAIMER,
    };
  }

  /**
   * Construye una explicación honesta y accionable para el caso
   * `UNLIKELY` cuando el presupuesto diario natural quedó por debajo del
   * mínimo viable de Meta (o el lifetime quedó en una escala inviable).
   *
   * El texto incluye:
   *  - El daily natural antes del clamp (la cifra real que muestra por
   *    qué el clamp fue necesario).
   *  - Por qué el presupuesto quedó bajo (cruce CPA + meta).
   *  - Una sugerencia accionable (extender duración, subir CPA objetivo
   *    o reducir meta semanal).
   */
  private buildInsufficientBudgetExplanation(args: {
    mode: ExplanationMode;
    weeklyAdd: number | null;
    conversionesObjetivo: number;
    dailyBudget: number | null;
    naturalDailyBudget: number;
    cpaCap: number | null;
    averageCpa: number;
    durationDays: number;
    cpaTarget: number | null;
  }): string {
    const {
      mode,
      weeklyAdd,
      conversionesObjetivo,
      dailyBudget,
      naturalDailyBudget,
      cpaCap,
      averageCpa,
      durationDays,
      cpaTarget,
    } = args;

    const naturalDaily = formatClp(naturalDailyBudget);
    const dailyFinal = formatClp(dailyBudget ?? MIN_DAILY_BUDGET_CLP);
    const metaSemanal = weeklyAdd !== null ? `${weeklyAdd}` : 'la meta declarada';
    // En modo EVIDENCE el CPA relevante es el histórico observado; en
    // modo TESTABLE es el CPA objetivo propuesto.
    const effectiveCpa =
      mode === 'EVIDENCE'
        ? averageCpa > 0
          ? averageCpa
          : (cpaTarget ?? cpaCap ?? 0)
        : (cpaTarget ?? cpaCap ?? 0);
    const cpaLabel =
      effectiveCpa > 0 ? formatClp(effectiveCpa) : null;
    const cpaPhrase =
      mode === 'EVIDENCE'
        ? 'Costo por adquisición (CPA) histórico'
        : 'Costo por adquisición (CPA) objetivo propuesto';

    // Construimos la "razón" dependiendo del modo.
    let reason = '';
    if (cpaLabel !== null) {
      reason = `con ${cpaPhrase} de ${cpaLabel} y meta de ${metaSemanal} reservas/semana, el presupuesto diario natural es ${naturalDaily}`;
    } else {
      reason = `con la combinación de Costo por adquisición (CPA) y meta, el presupuesto diario natural es ${naturalDaily}`;
    }

    // Sugerencia accionable. Ofrecemos hasta 3 palancas concretas.
    // En TESTABLE la palanca "aumentar CPA objetivo" usa el `cpaTarget`
    // propuesto como base; en EVIDENCE (y como fallback) usa el `cpaCap`.
    const palancas: string[] = [];
    if (durationDays < MAX_DURATION_DAYS) {
      const candidateDays = Math.min(
        MAX_DURATION_DAYS,
        Math.max(durationDays * 2, durationDays + 7),
      );
      palancas.push(`extender la duración a ${candidateDays} días`);
    }
    const cpaAnchor =
      mode === 'TESTABLE'
        ? cpaTarget !== null && cpaTarget > 0
          ? cpaTarget
          : cpaCap
        : cpaCap;
    if (cpaAnchor !== null && cpaAnchor > 0) {
      const suggestedCpa = formatClp(Math.round(cpaAnchor * 2));
      palancas.push(`aumentar el Costo por adquisición (CPA) objetivo a ${suggestedCpa}`);
    }
    if (weeklyAdd !== null && weeklyAdd > 1) {
      const suggestedMeta = Math.max(1, weeklyAdd - 1);
      palancas.push(`reducir la meta semanal a ${suggestedMeta} reserva(s)`);
    }

    let accionable = '';
    if (palancas.length === 1) {
      accionable = `Considera ${palancas[0]}.`;
    } else if (palancas.length === 2) {
      accionable = `Considera ${palancas[0]}, o ${palancas[1]}.`;
    } else if (palancas.length >= 3) {
      accionable = `Considera ${palancas[0]}, ${palancas[1]} o ${palancas[2]}.`;
    } else {
      accionable =
        'Considera revisar la meta semanal o el Costo por adquisición (CPA) tope hasta que la combinación cierre con el presupuesto disponible.';
    }

    const conversionesLabel = `${conversionesObjetivo} conversiones en el periodo`;

    return (
      `El presupuesto diario natural sería de ${naturalDaily} (${reason}). ` +
      `Subimos al mínimo viable de Meta (${dailyFinal}) para que la campaña alcance a entregarse, pero esta escala probablemente no alcanza la meta de ${conversionesLabel}. ` +
      accionable
    );
  }
}

const formatClp = (value: number): string => {
  const rounded = Math.round(value);
  if (!Number.isFinite(rounded)) return 'N/D';
  return `$${rounded.toLocaleString('es-CL')} CLP`;
};

const WEEKDAY_NAMES_ES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

const formatWeekdayName = (weekday: number): string =>
  WEEKDAY_NAMES_ES[weekday] ?? `día ${weekday}`;