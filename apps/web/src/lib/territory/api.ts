import { apiFetch } from '../api';

export interface Region {
  cutCode: string;
  name: string;
  iso3166: string;
  capital: string;
}

export interface Commune {
  cutCode: string;
  name: string;
  regionCutCode: string;
}

export interface RegionListResponse {
  regions: Region[];
}

export interface CommunesByRegionResponse {
  region: Region;
  communes: Commune[];
}

export interface CommuneSearchResponse {
  query: string;
  region: string | null;
  communes: Commune[];
}

export interface CommuneDetailResponse {
  commune: Commune;
  region: Region | null;
}

/**
 * Devuelve las 16 regiones oficiales. El resultado es estable (no
 * cambia entre deploys), por lo que se cachea en el cliente con la
 * política por defecto de Next.js.
 */
export const listRegions = (): Promise<Region[]> =>
  apiFetch<RegionListResponse>('/territory/regions', undefined, {
    revalidate: 3600,
  }).then((r) => r.regions);

export const listCommunesByRegion = (
  regionCut: string,
): Promise<CommunesByRegionResponse> =>
  apiFetch<CommunesByRegionResponse>(
    `/territory/regions/${encodeURIComponent(regionCut)}/communes`,
    undefined,
    { revalidate: 3600 },
  );

export interface SearchCommunesFilters {
  query?: string;
  region?: string;
}

export const searchCommunes = (
  filters: SearchCommunesFilters,
): Promise<CommuneSearchResponse> => {
  const params = new URLSearchParams();
  if (filters.query) params.set('query', filters.query);
  if (filters.region) params.set('region', filters.region);
  const search = params.toString();
  const path = search.length > 0 ? `/territory/communes?${search}` : '/territory/communes';
  return apiFetch<CommuneSearchResponse>(path, undefined, { cache: 'no-store' });
};

export const getCommune = (cut: string): Promise<CommuneDetailResponse> =>
  apiFetch<CommuneDetailResponse>(
    `/territory/communes/${encodeURIComponent(cut)}`,
    undefined,
    { revalidate: 3600 },
  );