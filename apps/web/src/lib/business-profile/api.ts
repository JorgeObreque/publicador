import { apiFetch } from '../api';

export interface BusinessProfile {
  id: string;
  businessId: string;
  addressLine: string | null;
  neighborhood: string | null;
  regionCutCode: string | null;
  communeCutCode: string | null;
  regionName: string | null;
  communeName: string | null;
  countryCode: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  publicEmail: string | null;
  googleMapsUrl: string | null;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  preferredEmojiSemantics: string[];
  primaryCustomerProfile: string;
  commonObjections: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: number | null;
  monthlyRevenueTarget: string | null;
  monthlyAcquisitionGoal: number | null;
  costPerAcquisitionCap: string | null;
  tagline: string | null;
  differentiators: string[];
  nearbyCommunesCutCodes: string[];
  profileCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessProfileResponse {
  profile: BusinessProfile;
  ready: boolean;
}

export interface BusinessProfilePayload {
  addressLine?: string;
  neighborhood?: string;
  regionCutCode?: string;
  communeCutCode?: string;
  countryCode?: string;
  phone?: string;
  whatsappNumber?: string;
  publicEmail?: string;
  googleMapsUrl?: string;
  brandVoiceKeywords?: string[];
  wordsToAvoid?: string[];
  preferredEmojiSemantics?: string[];
  primaryCustomerProfile: string;
  commonObjections?: string[];
  qualifyingQuestions?: string[];
  weeklyServiceCapacity?: number;
  monthlyAcquisitionGoal?: number;
  monthlyRevenueTarget?: number | string;
  costPerAcquisitionCap?: number | string;
  tagline?: string;
  differentiators?: string[];
  nearbyCommunesCutCodes?: string[];
}

export const getBusinessProfile = (): Promise<BusinessProfileResponse> =>
  apiFetch<BusinessProfileResponse>('/business-profile', undefined, { cache: 'no-store' });

export const upsertBusinessProfile = (
  payload: BusinessProfilePayload,
): Promise<BusinessProfileResponse> =>
  apiFetch<BusinessProfileResponse>('/business-profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const markBusinessProfileComplete = (): Promise<BusinessProfileResponse> =>
  apiFetch<BusinessProfileResponse>('/business-profile/complete', {
    method: 'POST',
  });
