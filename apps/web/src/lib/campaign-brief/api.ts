import { apiFetch } from '../api';

export type CampaignBriefStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED';

export type CampaignExecutionStatus =
  | 'DRAFT'
  | 'PAUSED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ARCHIVED';

export type CampaignExecutionMetaPublishStatus =
  | 'DRAFT'
  | 'PUBLISHING'
  | 'PAUSED'
  | 'FAILED';

export interface CampaignExecutionSummary {
  id: string;
  name: string;
  status: CampaignExecutionStatus;
  dailyBudget: string | null;
  lifetimeBudget: string | null;
  metaPublishStatus: CampaignExecutionMetaPublishStatus;
  metaPublishedAt: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

export interface CampaignBrief {
  id: string;
  businessId: string;
  serviceId: string;
  title: string;
  status: CampaignBriefStatus;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile: string | null;
  qualifyingQuestions: string[];
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: string | null;
  lifetimeBudgetCap: string | null;
  dailyBudgetCap: string | null;
  plannedDurationDays: number | null;
  constraints: string[];
  stopIf: string | null;
  scaleIf: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Resumen de las ejecuciones (`Campaign`) vinculadas al plan. El
   * backend siempre devuelve este campo en `listCampaignBriefs` y
   * `getCampaignBrief`. Las campañas huérfanas (`campaignBriefId = NULL`)
   * nunca aparecen aquí.
   */
  executions: CampaignExecutionSummary[];
}

export interface CampaignBriefPayload {
  title: string;
  serviceId: string;
  businessObjective: string;
  offer: string;
  primaryKpi: string;
  idealCustomerProfile?: string;
  qualifyingQuestions?: string[];
  constraints?: string[];
  stopIf?: string;
  scaleIf?: string;
  monthlyAcquisitionGoal?: number;
  costPerAcquisitionCap?: number;
  lifetimeBudgetCap?: number;
  dailyBudgetCap?: number;
  plannedDurationDays?: number;
}

export interface CampaignBriefListResponse {
  briefs: CampaignBrief[];
  counts: {
    DRAFT: number;
    APPROVED: number;
    ARCHIVED: number;
  };
}

export interface ListCampaignBriefFilters {
  status?: CampaignBriefStatus;
}

const buildListParams = (
  filters: ListCampaignBriefFilters,
): { search: string } => {
  if (!filters.status) return { search: '' };
  const params = new URLSearchParams();
  params.set('status', filters.status);
  return { search: `?${params.toString()}` };
};

export const listCampaignBriefs = async (
  filters: ListCampaignBriefFilters = {},
): Promise<CampaignBrief[]> => {
  const { search } = buildListParams(filters);
  return apiFetch<CampaignBrief[]>(
    `/campaign-briefs${search}`,
    undefined,
    { cache: 'no-store' },
  );
};

export const getCampaignBrief = (id: string): Promise<CampaignBrief> =>
  apiFetch<CampaignBrief>(`/campaign-briefs/${id}`, undefined, { cache: 'no-store' });

export const createCampaignBrief = (
  payload: CampaignBriefPayload,
): Promise<CampaignBrief> =>
  apiFetch<CampaignBrief>('/campaign-briefs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const updateCampaignBrief = (
  id: string,
  payload: Partial<CampaignBriefPayload>,
): Promise<CampaignBrief> =>
  apiFetch<CampaignBrief>(`/campaign-briefs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });

export const approveCampaignBrief = (id: string): Promise<CampaignBrief> =>
  apiFetch<CampaignBrief>(`/campaign-briefs/${id}/approve`, {
    method: 'POST',
  });

export const archiveCampaignBrief = (id: string): Promise<CampaignBrief> =>
  apiFetch<CampaignBrief>(`/campaign-briefs/${id}/archive`, {
    method: 'POST',
  });

export type SuggestRulesSource = 'AI' | 'FALLBACK';

export interface SuggestRulesResponse {
  stopIf: string;
  scaleIf: string;
  source: SuggestRulesSource;
}

export const suggestCampaignBriefRules = (
  id: string,
): Promise<SuggestRulesResponse> =>
  apiFetch<SuggestRulesResponse>(`/campaign-briefs/${id}/suggest-rules`, {
    method: 'POST',
  });
