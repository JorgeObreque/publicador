import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReviewStep } from './ReviewStep';
import { createEmptyDraft } from '@/lib/campaigns/wizard';
import type { CampaignDraft } from '@/lib/campaigns/wizard';
import type { MediaAsset } from '@/lib/media/types';
import type { ServiceSummary } from '@/lib/services/api';
import type { CampaignWithCreative, PublishPausedResult } from '@/lib/campaigns/api';

const mockRouterPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

jest.mock('@/lib/campaigns/api', () => ({
  createCampaignWithCreative: jest.fn(),
  publishCampaignPaused: jest.fn(),
}));

const { createCampaignWithCreative, publishCampaignPaused } = jest.requireMock(
  '@/lib/campaigns/api',
) as {
  createCampaignWithCreative: jest.Mock;
  publishCampaignPaused: jest.Mock;
};

const sampleAsset: MediaAsset = {
  id: 'media-1',
  name: 'Imagen hero.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 12345,
  status: 'READY',
  kind: 'IMAGE',
  source: 'GOOGLE_DRIVE',
  externalFileId: 'drive-1',
  modifiedTime: null,
  requiresConversion: false,
  isAvailable: true,
  thumbnailUrl: 'https://example.com/hero.jpg',
};

const sampleService: ServiceSummary = {
  id: 'svc-1',
  name: 'Balayage',
  description: null,
  price: '50000',
  currency: 'CLP',
  duration: null,
};

const buildDraft = (overrides: Partial<CampaignDraft> = {}): CampaignDraft => ({
  ...createEmptyDraft(),
  name: 'Campaña Balayage',
  serviceId: 'svc-1',
  selectedMediaAssetId: 'media-1',
  primaryText: 'Balayage natural con profesionales.',
  headline: 'Reserva tu balayage',
  dailyBudget: '5000',
  startDate: '2026-10-01',
  endDate: '2026-10-07',
  ...overrides,
});

const sampleCreateResult: CampaignWithCreative = {
  campaign: {
    id: 'camp-123',
    name: 'Campaña Balayage',
    objective: 'Aumentar reservas de balayage',
    status: 'DRAFT',
    serviceId: 'svc-1',
    campaignBriefId: 'brief-99',
    dailyBudget: '5000',
    lifetimeBudget: null,
    startDate: '2026-10-01',
    endDate: '2026-10-07',
    notes: null,
    metaCampaignId: null,
    metaAdSetId: null,
    metaPublishStatus: 'DRAFT',
    metaPublishError: null,
    metaPublishedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    campaignCreatives: [],
  },
  creative: {
    id: 'creative-1',
    name: 'Reserva tu balayage',
    primaryText: 'Balayage natural con profesionales.',
    headline: 'Reserva tu balayage',
    description: null,
    callToAction: 'WHATSAPP_MESSAGE',
    mediaAssetId: 'media-1',
  },
  attachment: {
    id: 'attach-1',
    attributionCode: 'control',
    isControl: true,
  },
};

const samplePublishResult: PublishPausedResult = {
  campaignId: 'camp-123',
  metaCampaignId: 'meta-camp-1',
  metaAdSetId: 'meta-adset-1',
  status: 'PAUSED',
  creatives: [],
};

beforeEach(() => {
  mockRouterPush.mockReset();
  createCampaignWithCreative.mockReset();
  publishCampaignPaused.mockReset();
});

describe('ReviewStep – redirección post-creación', () => {
  it('redirige al plan comercial del que proviene tras guardar el borrador', async () => {
    createCampaignWithCreative.mockResolvedValueOnce(sampleCreateResult);

    const user = userEvent.setup();
    render(
      <ReviewStep
        draft={buildDraft({ briefId: 'brief-99' })}
        issues={[]}
        services={[sampleService]}
        selectedAsset={sampleAsset}
        maxSpend={35000}
        onPrevious={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/campaign-brief/brief-99');
    });
    // No se debe redirigir al detalle de la campaña (P1-5).
    expect(mockRouterPush).not.toHaveBeenCalledWith('/campaigns/camp-123');
    expect(publishCampaignPaused).not.toHaveBeenCalled();
  });

  it('redirige al plan comercial tras publicar en Meta como pausada', async () => {
    createCampaignWithCreative.mockResolvedValueOnce(sampleCreateResult);
    publishCampaignPaused.mockResolvedValueOnce(samplePublishResult);

    const user = userEvent.setup();
    render(
      <ReviewStep
        draft={buildDraft({ briefId: 'brief-99' })}
        issues={[]}
        services={[sampleService]}
        selectedAsset={sampleAsset}
        maxSpend={35000}
        onPrevious={jest.fn()}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: /crear y enviar a meta como pausada/i }),
    );

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/campaign-brief/brief-99');
    });
    expect(createCampaignWithCreative).toHaveBeenCalledTimes(1);
    expect(publishCampaignPaused).toHaveBeenCalledWith('camp-123');
  });

  it('cae al listado de planes cuando por alguna razón el draft llega sin briefId', async () => {
    createCampaignWithCreative.mockResolvedValueOnce(sampleCreateResult);

    const user = userEvent.setup();
    render(
      <ReviewStep
        draft={buildDraft({ briefId: null })}
        issues={[]}
        services={[sampleService]}
        selectedAsset={sampleAsset}
        maxSpend={35000}
        onPrevious={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/campaign-brief');
    });
    // Nunca al listado legacy /campaigns.
    expect(mockRouterPush).not.toHaveBeenCalledWith('/campaigns');
    expect(mockRouterPush).not.toHaveBeenCalledWith('/campaigns/camp-123');
  });

  it('envía campaignBriefId al backend al crear la campaña desde un brief', async () => {
    createCampaignWithCreative.mockResolvedValueOnce(sampleCreateResult);

    const user = userEvent.setup();
    render(
      <ReviewStep
        draft={buildDraft({ briefId: 'brief-99' })}
        issues={[]}
        services={[sampleService]}
        selectedAsset={sampleAsset}
        maxSpend={35000}
        onPrevious={jest.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /guardar borrador/i }));

    await waitFor(() => {
      expect(createCampaignWithCreative).toHaveBeenCalledTimes(1);
    });
    expect(createCampaignWithCreative).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: expect.objectContaining({ campaignBriefId: 'brief-99' }),
      }),
    );
  });
});
