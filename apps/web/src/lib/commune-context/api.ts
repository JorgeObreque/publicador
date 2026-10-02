import { apiFetch } from '../api';

export interface CommuneContext {
  cutCode: string;
  population: number;
  adultShare25_55: number;
  avgHouseholdIncomeCLP: number;
  profileDescription: string;
  source: string;
  year: number;
}

export interface CommuneContextResponse {
  context: CommuneContext;
  commune: { cutCode: string; name: string; regionCutCode: string };
  neighbors: CommuneContext[];
}

export interface RegionSummaryResponse {
  region: { cutCode: string; name: string };
  totalCommunes: number;
  entries: CommuneContext[];
}

/**
 * Devuelve el contexto socioeconómico estimado de una comuna junto con la
 * ficha territorial y el top 10 vecinas por ingreso. Devuelve `null` si la
 * comuna no existe o no tiene contexto cargado (404 del backend).
 */
export const getCommuneContext = (cut: string): Promise<CommuneContextResponse | null> =>
  apiFetch<CommuneContextResponse | null>(
    `/commune-context/communes/${encodeURIComponent(cut)}`,
    undefined,
    { cache: 'no-store' },
  ).catch((err: unknown) => {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  });

/**
 * Devuelve el resumen de contexto de una región (lista de comunas con su
 * estimación). Devuelve `null` si la región no existe (404).
 */
export const getRegionContextSummary = (regionCut: string): Promise<RegionSummaryResponse | null> =>
  apiFetch<RegionSummaryResponse | null>(
    `/commune-context/regions/${encodeURIComponent(regionCut)}/summary`,
    undefined,
    { cache: 'no-store' },
  ).catch((err: unknown) => {
    if (err instanceof Error && err.message.includes('404')) return null;
    throw err;
  });