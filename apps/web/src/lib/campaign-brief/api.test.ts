import { apiFetch } from '@/lib/api';
import {
  approveCampaignBrief,
  archiveCampaignBrief,
  createCampaignBrief,
  getCampaignBrief,
  listCampaignBriefs,
  updateCampaignBrief,
  type CampaignBrief,
  type CampaignBriefPayload,
} from './api';

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
  apiBaseUrl: 'http://localhost:3001/api/v1',
}));

const mockedApiFetch = jest.mocked(apiFetch);

const sampleBrief: CampaignBrief = {
  id: 'brief-1',
  businessId: 'blondor',
  serviceId: 'svc-balayage',
  title: 'Balayage Q4',
  status: 'DRAFT',
  businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
  offer: 'Evaluación + 20% descuento',
  primaryKpi: 'Evaluaciones',
  idealCustomerProfile: null,
  qualifyingQuestions: ['¿Cabello tinturado?'],
  monthlyAcquisitionGoal: 20,
  costPerAcquisitionCap: '5000.00',
  lifetimeBudgetCap: '200000.00',
  dailyBudgetCap: '25000.00',
  plannedDurationDays: 14,
  constraints: ['No usar antes/después'],
  stopIf: 'Si no hay 5 contactos en 14 días',
  scaleIf: 'Si CPL < $5.000 con >10 conversaciones',
  approvedAt: null,
  approvedBy: null,
  createdAt: '2026-09-27T00:00:00.000Z',
  updatedAt: '2026-09-27T00:00:00.000Z',
  executions: [],
};

beforeEach(() => {
  mockedApiFetch.mockReset();
});

describe('campaign-brief api', () => {
  it('listCampaignBriefs hace GET a /campaign-briefs sin query cuando no hay filtro', async () => {
    mockedApiFetch.mockResolvedValueOnce([sampleBrief]);

    const result = await listCampaignBriefs();

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/campaign-briefs',
      undefined,
      { cache: 'no-store' },
    );
    expect(result).toEqual([sampleBrief]);
  });

  it('listCampaignBriefs propaga el resumen de ejecuciones (brief.executions) tal cual lo devuelve la API', async () => {
    const briefWithExecutions: CampaignBrief = {
      ...sampleBrief,
      executions: [
        {
          id: 'exec-1',
          name: 'Balayage Q4 — iteración 1',
          status: 'PAUSED',
          dailyBudget: '5000.00',
          lifetimeBudget: null,
          metaPublishStatus: 'PAUSED',
          metaPublishedAt: '2026-09-30T12:00:00.000Z',
          startDate: '2026-09-30T00:00:00.000Z',
          endDate: null,
          createdAt: '2026-09-30T00:00:00.000Z',
        },
        {
          id: 'exec-2',
          name: 'Balayage Q4 — iteración 2',
          status: 'DRAFT',
          dailyBudget: null,
          lifetimeBudget: '200000.00',
          metaPublishStatus: 'DRAFT',
          metaPublishedAt: null,
          startDate: null,
          endDate: null,
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    };
    mockedApiFetch.mockResolvedValueOnce([briefWithExecutions]);

    const result = await listCampaignBriefs();

    expect(result).toHaveLength(1);
    expect(result[0].executions).toHaveLength(2);
    expect(result[0].executions?.[0]).toMatchObject({
      id: 'exec-1',
      name: 'Balayage Q4 — iteración 1',
      status: 'PAUSED',
    });
    expect(result[0].executions?.[1]).toMatchObject({
      id: 'exec-2',
      status: 'DRAFT',
    });
  });

  it('getCampaignBrief devuelve las ejecuciones del plan para alimentar el breadcrumb del detalle', async () => {
    const briefWithExecutions: CampaignBrief = {
      ...sampleBrief,
      executions: [
        {
          id: 'exec-9',
          name: 'Ejecución legacy',
          status: 'ACTIVE',
          dailyBudget: '7000.00',
          lifetimeBudget: null,
          metaPublishStatus: 'PAUSED',
          metaPublishedAt: '2026-09-29T08:00:00.000Z',
          startDate: '2026-09-29T00:00:00.000Z',
          endDate: null,
          createdAt: '2026-09-29T00:00:00.000Z',
        },
      ],
    };
    mockedApiFetch.mockResolvedValueOnce(briefWithExecutions);

    const result = await getCampaignBrief('brief-1');

    expect(result.id).toBe('brief-1');
    expect(result.executions).toHaveLength(1);
    expect(result.executions?.[0].id).toBe('exec-9');
  });

  it('listCampaignBriefs agrega ?status=APPROVED cuando se filtra', async () => {
    const approvedBrief: CampaignBrief = { ...sampleBrief, status: 'APPROVED' };
    mockedApiFetch.mockResolvedValueOnce([approvedBrief]);

    const result = await listCampaignBriefs({ status: 'APPROVED' });

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/campaign-briefs?status=APPROVED',
      undefined,
      { cache: 'no-store' },
    );
    expect(result).toEqual([approvedBrief]);
  });

  it('getCampaignBrief hace GET a /campaign-briefs/:id', async () => {
    mockedApiFetch.mockResolvedValueOnce(sampleBrief);

    const result = await getCampaignBrief('brief-1');

    expect(mockedApiFetch).toHaveBeenCalledWith(
      '/campaign-briefs/brief-1',
      undefined,
      { cache: 'no-store' },
    );
    expect(result).toEqual(sampleBrief);
  });

  it('createCampaignBrief hace POST a /campaign-briefs con body serializado', async () => {
    const created: CampaignBrief = { ...sampleBrief, id: 'brief-new' };
    mockedApiFetch.mockResolvedValueOnce(created);

    const payload: CampaignBriefPayload = {
      title: 'Balayage Q4',
      serviceId: 'svc-balayage',
      businessObjective: 'Conseguir 5 evaluaciones de balayage en 14 días',
      offer: 'Evaluación + 20% descuento',
      primaryKpi: 'Evaluaciones',
      qualifyingQuestions: ['¿Cabello tinturado?'],
      constraints: ['No usar antes/después'],
    };

    const result = await createCampaignBrief(payload);

    expect(mockedApiFetch).toHaveBeenCalledTimes(1);
    expect(mockedApiFetch).toHaveBeenCalledWith('/campaign-briefs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    expect(result).toEqual(created);
  });

  it('updateCampaignBrief hace PATCH a /campaign-briefs/:id con body serializado parcial', async () => {
    const updated: CampaignBrief = { ...sampleBrief, title: 'Balayage Q4 v2' };
    mockedApiFetch.mockResolvedValueOnce(updated);

    const result = await updateCampaignBrief('brief-1', { title: 'Balayage Q4 v2' });

    expect(mockedApiFetch).toHaveBeenCalledWith('/campaign-briefs/brief-1', {
      method: 'PATCH',
      body: JSON.stringify({ title: 'Balayage Q4 v2' }),
    });
    expect(result).toEqual(updated);
  });

  it('approveCampaignBrief hace POST a /campaign-briefs/:id/approve', async () => {
    const approved: CampaignBrief = {
      ...sampleBrief,
      status: 'APPROVED',
      approvedAt: '2026-09-27T05:00:00.000Z',
    };
    mockedApiFetch.mockResolvedValueOnce(approved);

    const result = await approveCampaignBrief('brief-1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/campaign-briefs/brief-1/approve', {
      method: 'POST',
    });
    expect(result).toEqual(approved);
  });

  it('archiveCampaignBrief hace POST a /campaign-briefs/:id/archive', async () => {
    const archived: CampaignBrief = { ...sampleBrief, status: 'ARCHIVED' };
    mockedApiFetch.mockResolvedValueOnce(archived);

    const result = await archiveCampaignBrief('brief-1');

    expect(mockedApiFetch).toHaveBeenCalledWith('/campaign-briefs/brief-1/archive', {
      method: 'POST',
    });
    expect(result).toEqual(archived);
  });

  it('propaga los errores que lanza apiFetch', async () => {
    mockedApiFetch.mockRejectedValueOnce(new Error('API error 400: faltan campos'));
    await expect(listCampaignBriefs()).rejects.toThrow('API error 400: faltan campos');
  });
});
