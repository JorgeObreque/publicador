import { apiFetch } from '@/lib/api';
import {
  acceptCommercialDiagnosis,
  adjustCommercialDiagnosis,
  answerCommercialDiagnosis,
  getCommercialDiagnosis,
  startCommercialDiagnosis,
  type CommercialDiagnosis,
} from './api';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
  apiBaseUrl: 'http://localhost:3001/api/v1',
}));

const mockedApiFetch = jest.mocked(apiFetch);

const sampleDiagnosis: CommercialDiagnosis = {
  id: 'diag-1',
  businessId: 'test-business',
  status: 'IN_PROGRESS',
  currentSituation: 'Tengo clientas principalmente jueves a domingo',
  serviceId: 'svc-balayage',
  situation: 'Demasiada disponibilidad entre semana',
  opportunity: 'Hay demanda latente los lunes',
  primaryGoal: null,
  primaryConversion: null,
  recommendedTitle: null,
  recommendedWeeklyAdd: null,
  availableCapacity: 10,
  recommended: {
    situation: 'Demasiada disponibilidad entre semana',
    opportunity: 'Hay demanda latente los lunes',
    primaryGoal: null,
    primaryConversion: null,
    recommendedTitle: null,
    recommendedWeeklyAdd: null,
    availableCapacity: 10,
    pendingQuestion: {
      key: 'pain_point',
      text: '¿Cuál es tu principal dolor esta semana?',
    },
  },
  strategy: null,
  answers: [
    {
      id: 'ans-1',
      questionKey: 'pain_point',
      questionText: '¿Cuál es tu principal dolor esta semana?',
      answerText: null,
      askedAt: '2026-09-27T00:00:00.000Z',
      answeredAt: null,
    },
  ],
  campaignBriefId: null,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
};

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe('commercial-diagnosis api', () => {
  it('startCommercialDiagnosis hace POST a /commercial-diagnoses con el body serializado', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleDiagnosis);

    const result = await startCommercialDiagnosis({
      currentSituation: 'Tengo clientas principalmente jueves a domingo',
      serviceId: 'svc-balayage',
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/commercial-diagnoses', {
      method: 'POST',
      body: JSON.stringify({
        currentSituation: 'Tengo clientas principalmente jueves a domingo',
        serviceId: 'svc-balayage',
      }),
    });
    expect(result).toEqual(sampleDiagnosis);
  });

  it('startCommercialDiagnosis omite serviceId cuando no se entrega', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleDiagnosis);

    await startCommercialDiagnosis({
      currentSituation: 'Algo',
    });

    const callArgs = mockedApiFetch.mock.calls[0]![1] as { body: string };
    const body = JSON.parse(callArgs.body) as Record<string, unknown>;
    expect(body).toEqual({ currentSituation: 'Algo' });
    expect(body['serviceId']).toBeUndefined();
  });

  it('getCommercialDiagnosis hace GET a /commercial-diagnoses/:id sin cache', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleDiagnosis);

    const result = await getCommercialDiagnosis('diag-1');

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/commercial-diagnoses/diag-1',
      undefined,
      { cache: 'no-store' },
    );
    expect(result).toEqual(sampleDiagnosis);
  });

  it('answerCommercialDiagnosis hace POST a /commercial-diagnoses/:id/answer con {questionKey, answerText}', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleDiagnosis);

    const result = await answerCommercialDiagnosis('diag-1', {
      questionKey: 'pain_point',
      answerText: 'No llegan evaluaciones los lunes',
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/commercial-diagnoses/diag-1/answer',
      {
        method: 'POST',
        body: JSON.stringify({
          questionKey: 'pain_point',
          answerText: 'No llegan evaluaciones los lunes',
        }),
      },
    );
    expect(result).toEqual(sampleDiagnosis);
  });

  it('adjustCommercialDiagnosis hace POST a /commercial-diagnoses/:id/adjust con {instruction}', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleDiagnosis);

    const result = await adjustCommercialDiagnosis('diag-1', {
      instruction: 'Enfoca la meta solo en lunes y martes.',
    });

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/commercial-diagnoses/diag-1/adjust',
      {
        method: 'POST',
        body: JSON.stringify({
          instruction: 'Enfoca la meta solo en lunes y martes.',
        }),
      },
    );
    expect(result).toEqual(sampleDiagnosis);
  });

  it('acceptCommercialDiagnosis hace POST a /commercial-diagnoses/:id/accept', async () => {
    mockedApiFetch.mockResolvedValueOnce({
      diagnosis: { ...sampleDiagnosis, status: 'ACCEPTED' },
      campaignBrief: { id: 'brief-1' },
    });

    const result = await acceptCommercialDiagnosis('diag-1');

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/commercial-diagnoses/diag-1/accept',
      { method: 'POST' },
    );
    expect(result.diagnosis.status).toBe('ACCEPTED');
    expect(result.campaignBrief).toEqual({ id: 'brief-1' });
  });

  it('propaga los errores que lanza apiFetch', async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error('API error 400: faltan datos'));
    await expect(
      startCommercialDiagnosis({ currentSituation: 'Algo' }),
    ).rejects.toThrow('API error 400: faltan datos');
  });
});