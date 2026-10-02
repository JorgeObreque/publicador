import { apiFetch } from '@/lib/api';
import {
  getBusinessProfile,
  markBusinessProfileComplete,
  upsertBusinessProfile,
  type BusinessProfile,
  type BusinessProfilePayload,
} from './api';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
  apiBaseUrl: 'http://localhost:3001/api/v1',
}));

const mockedApiFetch = jest.mocked(apiFetch);

const sampleProfile: BusinessProfile = {
  id: 'prof-1',
  businessId: 'biz-1',
  addressLine: 'Av. Apoquindo 4501',
  neighborhood: 'Las Condes',
  regionCutCode: '13',
  communeCutCode: '13114',
  regionName: 'Región Metropolitana de Santiago',
  communeName: 'Las Condes',
  countryCode: 'CL',
  phone: '+56222222222',
  whatsappNumber: '+56912345678',
  publicEmail: 'a@b.cl',
  googleMapsUrl: 'https://maps.google.com/?q=foo',
  brandVoiceKeywords: ['profesional'],
  wordsToAvoid: ['barato'],
  preferredEmojiSemantics: ['✨'],
  primaryCustomerProfile: 'Mujer 30-45 que busca balayage',
  commonObjections: ['Es muy caro'],
  qualifyingQuestions: ['¿Tienes el cabello tinturado?'],
  weeklyServiceCapacity: 20,
  monthlyRevenueTarget: '3000000.00',
  monthlyAcquisitionGoal: 10,
  costPerAcquisitionCap: '50000.00',
  tagline: 'Tu pelo, nuestras manos',
  differentiators: ['20 años de experiencia'],
  nearbyCommunesCutCodes: [],
  profileCompletedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe('business-profile api', () => {
  it('getBusinessProfile hace GET a /business-profile con cache no-store', async () => {
    mockedApiFetch.mockResolvedValueOnce({ profile: sampleProfile, ready: true });

    const result = await getBusinessProfile();

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/business-profile',
      undefined,
      { cache: 'no-store' },
    );
    expect(result).toEqual({ profile: sampleProfile, ready: true });
  });

  it('upsertBusinessProfile hace POST a /business-profile con el body serializado', async () => {
    const updatedProfile: BusinessProfile = {
      ...sampleProfile,
      communeCutCode: '05101',
      communeName: 'Valparaíso',
    };
    mockedApiFetch.mockResolvedValueOnce({ profile: updatedProfile, ready: true });

    const payload: BusinessProfilePayload = {
      addressLine: 'Av. Apoquindo 4501',
      regionCutCode: '05',
      communeCutCode: '05101',
      primaryCustomerProfile: 'Mujer 30-45 que busca balayage',
      brandVoiceKeywords: ['profesional'],
      qualifyingQuestions: ['¿Tienes el cabello tinturado?'],
      monthlyRevenueTarget: 3000000,
      costPerAcquisitionCap: '50000',
    };

    const result = await upsertBusinessProfile(payload);

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/business-profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual({ profile: updatedProfile, ready: true });
  });

  it('markBusinessProfileComplete hace POST a /business-profile/complete sin body', async () => {
    const completedProfile: BusinessProfile = {
      ...sampleProfile,
      profileCompletedAt: '2026-02-01T00:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce({ profile: completedProfile, ready: true });

    const result = await markBusinessProfileComplete();

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/business-profile/complete', {
      method: 'POST',
    });
    expect(result).toEqual({ profile: completedProfile, ready: true });
  });

  it('propaga los errores que lanza apiFetch', async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error('API error 500: oops'));
    await expect(getBusinessProfile()).rejects.toThrow('API error 500: oops');
  });
});
