'use server';

import { getCampaignBrief } from '@/lib/campaign-brief/api';
import type { CampaignBrief } from '@/lib/campaign-brief/api';
import {
  requestCreativeRecommendations,
  type RecommendationRequest,
} from '@/lib/creatives/api';

export interface CampaignBriefForWizardResponse {
  brief: CampaignBrief;
  recommendedDailyBudget: string | null;
  recommendedLifetimeBudget: string | null;
  recommendedDurationDays: string | null;
  /**
   * Snapshots de la recomendación honesta del diagnóstico comercial
   * (Fase A-D). El `CampaignBrief` actual NO los incluye; los añadimos
   * aquí como `null` para que el `BudgetStep` los muestre en cuanto el
   * brief los exponga (la migración del backend los llevará).
   */
  recommendedStartDate: string | null;
  recommendedEndDate: string | null;
  recommendedWeekdays: number[];
  budgetExplanation: string | null;
  scheduleExplanation: string | null;
  goalAssessment: {
    status: 'SUPPORTED' | 'TESTABLE' | 'UNLIKELY' | 'INSUFFICIENT_DATA';
    explanation: string;
    disclaimer: string;
  } | null;
  recommendedConfidence:
    | 'SUPPORTED'
    | 'TESTABLE'
    | 'UNLIKELY'
    | 'INSUFFICIENT_DATA'
    | null;
  /**
   * CPA objetivo propuesto por la IA en el diagnóstico comercial.
   * `null` hasta que la respuesta del diagnóstico llegue al snapshot del
   * wizard (Fase E/F).
   */
  recommendedCpaTarget: string | null;
  /**
   * Tope máximo de CPA. Mientras la IA no lo entregue, propagamos el
   * `costPerAcquisitionCap` del brief para que el `BudgetStep` ya pueda
   * mostrarlo en la tarjeta de recomendación.
   */
  recommendedCpaCap: string | null;
}

/**
 * Carga un `CampaignBrief` validando pertenencia al negocio actual y
 * devolviendo los topes de presupuesto/duración del propio brief (no se
 * recalculan; son los que la usuaria aprobó en el diagnóstico). El
 * frontend ya filtra por `status === 'APPROVED'` antes de pre-poblar el
 * wizard, pero conservamos el `status` en la respuesta para que esa
 * comprobación sea explícita.
 *
 * Los campos de la recomendación honesta (`recommendedStartDate`,
 * `goalAssessment`, etc.) se devuelven como `null` hasta que la próxima
 * migración del backend los añada al `CampaignBrief`. Mantener la forma
 * aquí garantiza que `BudgetStep` pueda mostrar la tarjeta sin tocar el
 * resto del wizard cuando llegue la migración.
 */
export async function getCampaignBriefForWizardAction(
  briefId: string,
): Promise<CampaignBriefForWizardResponse> {
  const brief = await getCampaignBrief(briefId);
  return {
    brief,
    recommendedDailyBudget: brief.dailyBudgetCap ?? null,
    recommendedLifetimeBudget: brief.lifetimeBudgetCap ?? null,
    recommendedDurationDays:
      brief.plannedDurationDays !== null && brief.plannedDurationDays !== undefined
        ? String(brief.plannedDurationDays)
        : null,
    recommendedStartDate: null,
    recommendedEndDate: null,
    recommendedWeekdays: [],
    budgetExplanation: null,
    scheduleExplanation: null,
    goalAssessment: null,
    recommendedConfidence: null,
    recommendedCpaTarget: null,
    recommendedCpaCap: brief.costPerAcquisitionCap ?? null,
  };
}

export async function requestCreativeRecommendationsAction(payload: RecommendationRequest) {
  return requestCreativeRecommendations(payload);
}