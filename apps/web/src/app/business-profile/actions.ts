'use server';

import {
  getBusinessProfile,
  markBusinessProfileComplete,
  upsertBusinessProfile,
  type BusinessProfile,
  type BusinessProfilePayload,
} from '@/lib/business-profile/api';
import {
  getCommuneContext,
  type CommuneContext,
} from '@/lib/commune-context/api';

export interface BusinessContextSnapshot {
  regionName: string | null;
  communeName: string | null;
  regionCutCode: string | null;
  communeCutCode: string | null;
  context: CommuneContext | null;
  neighbors: CommuneContext[];
}

export async function getBusinessProfileAction() {
  return getBusinessProfile();
}

export async function upsertBusinessProfileAction(payload: BusinessProfilePayload) {
  return upsertBusinessProfile(payload);
}

export async function markBusinessProfileCompleteAction() {
  return markBusinessProfileComplete();
}

/**
 * Server action que combina el perfil persistido con la capa de contexto
 * socioeconómico para alimentar al formulario. Si la comuna seleccionada
 * no tiene contexto cargado, devuelve `context: null` (NO se inventa).
 * Los `neighbors` son siempre un top 10 por ingreso estimado dentro de
 * la RM (o `[]` si la comuna no pertenece a la RM o no hay perfil).
 */
export async function getBusinessContextAction(): Promise<BusinessContextSnapshot> {
  const empty: BusinessContextSnapshot = {
    regionName: null,
    communeName: null,
    regionCutCode: null,
    communeCutCode: null,
    context: null,
    neighbors: [],
  };
  try {
    const profileResponse = await getBusinessProfile();
    const profile: BusinessProfile | null = profileResponse.profile;
    if (!profile) return empty;
    const communeCutCode = profile.communeCutCode;
    const regionCutCode = profile.regionCutCode;
    if (!communeCutCode || !regionCutCode) {
      return {
        regionName: profile.regionName,
        communeName: profile.communeName,
        regionCutCode,
        communeCutCode,
        context: null,
        neighbors: [],
      };
    }
    const ctxResponse = await getCommuneContext(communeCutCode);
    if (!ctxResponse) {
      return {
        regionName: profile.regionName,
        communeName: profile.communeName,
        regionCutCode,
        communeCutCode,
        context: null,
        neighbors: [],
      };
    }
    return {
      regionName: profile.regionName,
      communeName: profile.communeName,
      regionCutCode,
      communeCutCode,
      context: ctxResponse.context,
      neighbors: ctxResponse.neighbors,
    };
  } catch {
    return empty;
  }
}