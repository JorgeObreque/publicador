import { redirect } from 'next/navigation';
import NewCampaignPage from './page';

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT;push;${url};307;${url}`);
  }),
  permanentRedirect: jest.fn(),
  notFound: jest.fn(),
}));

jest.mock('@/app/campaigns/new/actions', () => ({
  getCampaignBriefForWizardAction: jest.fn(),
  requestCreativeRecommendationsAction: jest.fn(),
}));

jest.mock('@/components/wizard/CampaignWizard', () => ({
  CampaignWizard: ({ initialDraft }: { initialDraft: { briefId: string | null; name: string } }) => (
    <div
      data-testid="campaign-wizard"
      data-brief-id={initialDraft.briefId}
      data-name={initialDraft.name}
    />
  ),
}));

const mockedRedirect = redirect as unknown as jest.Mock;
const mockedAction = jest.requireMock('@/app/campaigns/new/actions')
  .getCampaignBriefForWizardAction as jest.Mock;

const baseApprovedBrief = {
  id: 'brief-1',
  businessId: 'biz-1',
  serviceId: 'svc-1',
  title: 'Balayage Otoño',
  status: 'APPROVED' as const,
  businessObjective: 'Aumentar reservas de balayage',
  offer: null,
  primaryKpi: 'Reservas por WhatsApp',
  idealCustomerProfile: null,
  qualifyingQuestions: [],
  monthlyAcquisitionGoal: 12,
  costPerAcquisitionCap: null,
  lifetimeBudgetCap: '120000',
  dailyBudgetCap: '8000',
  plannedDurationDays: 14,
  constraints: [],
  stopIf: null,
  scaleIf: null,
  approvedAt: null,
  archivedAt: null,
  diagnosisId: null,
  executions: [],
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

beforeEach(() => {
  mockedRedirect.mockClear();
  mockedAction.mockReset();
});

describe('NewCampaignPage – guard de briefId APPROVED', () => {
  it('redirige a /campaign-brief/new cuando NO llega briefId', async () => {
    await expect(
      NewCampaignPage({ searchParams: {} }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedRedirect).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith('/campaign-brief/new');
    expect(mockedAction).not.toHaveBeenCalled();
  });

  it('redirige a /campaign-brief/new cuando el brief existe pero NO está APPROVED', async () => {
    mockedAction.mockResolvedValueOnce({
      brief: { ...baseApprovedBrief, status: 'DRAFT' },
      recommendedDailyBudget: '8000',
      recommendedLifetimeBudget: '120000',
      recommendedDurationDays: '14',
    });

    await expect(
      NewCampaignPage({ searchParams: { briefId: 'brief-1' } }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedRedirect).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith('/campaign-brief/new');
  });

  it('redirige a /campaign-brief/new si la acción lanza una excepción', async () => {
    mockedAction.mockRejectedValueOnce(new Error('brief no encontrado'));

    await expect(
      NewCampaignPage({ searchParams: { briefId: 'brief-1' } }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedRedirect).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith('/campaign-brief/new');
  });

  it('redirige a /campaign-brief/new cuando el briefId viene como array vacío', async () => {
    await expect(
      NewCampaignPage({ searchParams: { briefId: [] } }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedRedirect).toHaveBeenCalledTimes(1);
    expect(mockedRedirect).toHaveBeenCalledWith('/campaign-brief/new');
    expect(mockedAction).not.toHaveBeenCalled();
  });

  it('redirige a /campaign-brief/new cuando el briefId llega vacío o solo espacios', async () => {
    await expect(
      NewCampaignPage({ searchParams: { briefId: '   ' } }),
    ).rejects.toThrow(/NEXT_REDIRECT/);

    expect(mockedRedirect).toHaveBeenCalledWith('/campaign-brief/new');
    expect(mockedAction).not.toHaveBeenCalled();
  });

  it('renderiza el wizard pre-poblado cuando el brief está APPROVED', async () => {
    mockedAction.mockResolvedValueOnce({
      brief: baseApprovedBrief,
      recommendedDailyBudget: '8000',
      recommendedLifetimeBudget: '120000',
      recommendedDurationDays: '14',
    });

    const tree = await NewCampaignPage({ searchParams: { briefId: 'brief-1' } });
    expect(mockedRedirect).not.toHaveBeenCalled();
    expect(mockedAction).toHaveBeenCalledWith('brief-1');
    expect(tree).toBeTruthy();
  });
});
