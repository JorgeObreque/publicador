import { apiFetch } from '../api';

export interface Creative {
  id: string;
  name: string;
  format: string;
  primaryText: string;
  headline: string;
  description: string | null;
  callToAction: string;
  imageUrl: string | null;
  mediaAssetId: string | null;
  isAiGenerated: boolean;
  metaCreativeId: string | null;
}

export interface CreativeAttachment {
  id: string;
  campaignId: string;
  creativeId: string;
  attributionCode: string;
  isControl: boolean;
  metaCreativeId: string | null;
  metaAdId: string | null;
  metaPublishedAt: string | null;
  creative?: Creative;
}

export interface CreateCreativeInput {
  name: string;
  format: string;
  primaryText: string;
  headline: string;
  description?: string;
  callToAction: string;
  mediaAssetId: string;
}

export const createCreative = (input: CreateCreativeInput) =>
  apiFetch<Creative>('/creatives', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export interface AttachCreativeInput {
  campaignId: string;
  creativeId: string;
  isControl?: boolean;
}

export const attachCreative = (input: AttachCreativeInput) =>
  apiFetch<CreativeAttachment>('/creatives/attach', {
    method: 'POST',
    body: JSON.stringify(input),
  });

export type RecommendationMode =
  | 'INITIAL'
  | 'REGENERATE_PRIMARY_TEXT'
  | 'REGENERATE_HEADLINE';

export interface CreativeSuggestion {
  primaryText: string;
  headline: string;
}

/**
 * Snapshot opcional del `CampaignBrief` aprobado por el diagnóstico
 * comercial. Se inyecta al prompt del backend para que el copy respete la
 * estrategia aprobada en lugar de inventar su propia dirección. Todos los
 * campos son opcionales/nullable para mantener compatibilidad con los
 * flujos legacy que aún no viajan con un brief.
 */
export interface BriefContext {
  businessObjective?: string | null;
  offer?: string | null;
  primaryKpi?: string | null;
  idealCustomerProfile?: string | null;
  qualifyingQuestions?: string[];
  constraints?: string[];
  stopIf?: string | null;
  scaleIf?: string | null;
  primaryConversion?: string | null;
  recommendedWeeklyAdd?: number | null;
  primaryGoal?: string | null;
}

export interface RecommendationResponse {
  mode: RecommendationMode;
  suggestions: CreativeSuggestion[];
}

export interface RecommendationRequest {
  mode: RecommendationMode;
  serviceId: string;
  mediaAssetId: string;
  currentCopy?: { primaryText?: string; headline?: string };
  context?: Record<string, unknown>;
  briefContext?: BriefContext;
}

export const requestCreativeRecommendations = (args: RecommendationRequest) =>
  apiFetch<RecommendationResponse>(
    '/creatives/recommendations',
    { method: 'POST', body: JSON.stringify(args) },
    { cache: 'no-store' },
  );
