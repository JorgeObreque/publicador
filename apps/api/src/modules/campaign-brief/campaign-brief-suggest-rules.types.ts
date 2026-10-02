import type { CampaignBrief } from '@prisma/client';

/**
 * Tipos internos del servicio `CampaignBriefSuggestRulesService`.
 *
 * Separa el contrato HTTP (en `dto/campaign-brief-suggest-rules.dto.ts`)
 * de los payloads que el servicio ensambla para el prompt y para el
 * cálculo de usage.
 */

/**
 * Contexto del negocio + servicio + comuna que se inyecta en el user
 * prompt. Es opcional porque tanto el `BusinessProfile` como el contexto
 * socioeconómico de la comuna pueden no estar cargados todavía (perfil
 * sin completar, comuna sin match, etc.). El servicio sigue funcionando
 * sin este bloque.
 */
export interface SuggestRulesContext {
  businessName: string | null;
  serviceName: string | null;
  serviceDescription: string | null;
  displayLocation: string;
  regionName: string | null;
  communeName: string | null;
  /** Población estimada de la comuna. `null` cuando no hay match. */
  population: number | null;
  /** Ingreso mensual estimado del hogar mediano, en CLP. `null` sin match. */
  income: number | null;
  /** Descripción cualitativa del contexto territorial. `null` sin match. */
  profileDescription: string | null;
  /** Fracción (0-1) estimada de adultos entre 25 y 55 años. `null` sin match. */
  adultShare25_55: number | null;
}

/**
 * Snapshot del `CampaignBrief` que el prompt necesita. Es interno: lo
 * construye el servicio a partir del row de Prisma. NO se devuelve al
 * frontend.
 */
export interface SuggestRulesPayload {
  title: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: number | null;
  lifetimeBudgetCap: number | null;
  dailyBudgetCap: number | null;
  plannedDurationDays: number | null;
  context: SuggestRulesContext | null;
}

export const buildSuggestRulesPayloadFromBrief = (
  brief: CampaignBrief,
  context: SuggestRulesContext | null,
): SuggestRulesPayload => ({
  title: brief.title,
  businessObjective: brief.businessObjective,
  offer: brief.offer,
  primaryKpi: brief.primaryKpi,
  idealCustomerProfile: brief.idealCustomerProfile,
  qualifyingQuestions: [...(brief.qualifyingQuestions ?? [])],
  monthlyAcquisitionGoal: brief.monthlyAcquisitionGoal,
  costPerAcquisitionCap:
    brief.costPerAcquisitionCap === null ? null : Number(brief.costPerAcquisitionCap.toString()),
  lifetimeBudgetCap:
    brief.lifetimeBudgetCap === null ? null : Number(brief.lifetimeBudgetCap.toString()),
  dailyBudgetCap:
    brief.dailyBudgetCap === null ? null : Number(brief.dailyBudgetCap.toString()),
  plannedDurationDays: brief.plannedDurationDays,
  context,
});