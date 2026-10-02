import { BadRequestException } from '@nestjs/common';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CampaignsService } from './campaigns.service';

interface CampaignBriefFixture {
  id: string;
  businessId: string;
  status: 'DRAFT' | 'APPROVED' | 'ARCHIVED';
}

const buildBrief = (
  overrides: Partial<CampaignBriefFixture> = {},
): CampaignBriefFixture => ({
  id: 'brief-1',
  businessId: 'test-business',
  status: 'APPROVED',
  ...overrides,
});

interface PrismaMock {
  campaignBrief: { findFirst: jest.Mock; create?: jest.Mock };
  campaign: {
    create: jest.Mock;
    update: jest.Mock;
    findFirst: jest.Mock;
    findMany?: jest.Mock;
  };
  mediaAsset: { findFirst: jest.Mock };
  creative: { create: jest.Mock };
  campaignCreative: { create: jest.Mock };
  $transaction: jest.Mock;
}

function attachPrismaMock(mock: PrismaMock): void {
  (prisma as unknown as { campaignBrief: PrismaMock['campaignBrief'] }).campaignBrief =
    mock.campaignBrief;
  (prisma as unknown as { campaign: PrismaMock['campaign'] }).campaign = mock.campaign;
  (prisma as unknown as { mediaAsset: PrismaMock['mediaAsset'] }).mediaAsset =
    mock.mediaAsset;
  (prisma as unknown as { creative: PrismaMock['creative'] }).creative = mock.creative;
  (prisma as unknown as { campaignCreative: PrismaMock['campaignCreative'] }).campaignCreative =
    mock.campaignCreative;
  (prisma as unknown as { $transaction: jest.Mock }).$transaction = mock.$transaction;
}

function buildService(): { service: CampaignsService } {
  return { service: new CampaignsService(new BusinessContextResolver()) };
}

describe('CampaignsService (P1-4: validación de campaignBriefId)', () => {
  const originalBusinessId = process.env.BUSINESS_ID;

  beforeEach(() => {
    process.env.BUSINESS_ID = 'test-business';
  });

  afterEach(() => {
    if (originalBusinessId === undefined) {
      delete process.env.BUSINESS_ID;
    } else {
      process.env.BUSINESS_ID = originalBusinessId;
    }
  });

  it('lanza BadRequest cuando campaignBriefId no pertenece al negocio actual', async () => {
    const briefFindFirst = jest.fn(async () => null);
    const campaignCreate = jest.fn(async () => ({}));
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: campaignCreate, update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    await expect(
      service.create({
        name: 'Promo Balayage',
        objective: 'Reservas',
        campaignBriefId: 'brief-otro-negocio',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(briefFindFirst).toHaveBeenCalledWith({
      where: { id: 'brief-otro-negocio', businessId: 'test-business' },
      select: { id: true, status: true },
    });
    expect(campaignCreate).not.toHaveBeenCalled();
  });

  it('lanza BadRequest cuando campaignBriefId existe pero está en DRAFT', async () => {
    const briefFindFirst = jest.fn(async () => buildBrief({ id: 'brief-draft', status: 'DRAFT' }));
    const campaignCreate = jest.fn(async () => ({}));
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: campaignCreate, update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    await expect(
      service.create({
        name: 'Promo Balayage',
        objective: 'Reservas',
        campaignBriefId: 'brief-draft',
      }),
    ).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('aprobado'),
    });
    expect(campaignCreate).not.toHaveBeenCalled();
  });

  it('lanza BadRequest cuando campaignBriefId está ARCHIVED', async () => {
    const briefFindFirst = jest.fn(async () =>
      buildBrief({ id: 'brief-arch', status: 'ARCHIVED' }),
    );
    const campaignCreate = jest.fn(async () => ({}));
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: campaignCreate, update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    await expect(
      service.create({
        name: 'Promo Balayage',
        objective: 'Reservas',
        campaignBriefId: 'brief-arch',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(campaignCreate).not.toHaveBeenCalled();
  });

  it('rechaza crear una campaña sin campaignBriefId con BadRequest accionable', async () => {
    const briefFindFirst = jest.fn(async () => null);
    const campaignCreate = jest.fn(async () => ({ id: 'cmp-1' }));
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: campaignCreate, update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    await expect(
      service.create({
        name: 'Promo Balayage',
        objective: 'Reservas',
      }),
    ).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('plan aprobado'),
    });
    expect(briefFindFirst).not.toHaveBeenCalled();
    expect(campaignCreate).not.toHaveBeenCalled();
  });

  it('rechaza createWithCreative si la campaña no trae campaignBriefId', async () => {
    const briefFindFirst = jest.fn(async () => null);
    const transaction = jest.fn();
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: transaction,
    });
    const { service } = buildService();

    await expect(
      service.createWithCreative({
        campaign: {
          name: 'Promo Balayage',
          objective: 'Reservas',
          dailyBudget: 5000,
        },
        creative: {
          name: 'Balayage',
          format: 'image',
          primaryText: 'Texto',
          headline: 'Titulo',
          callToAction: 'WHATSAPP_MESSAGE',
          mediaAssetId: 'asset-1',
        },
      }),
    ).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('plan aprobado'),
    });
    expect(briefFindFirst).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('list filtra las campañas huérfanas (campaignBriefId = null)', async () => {
    const findMany = jest.fn(async () => [
      {
        id: 'cmp-1',
        name: 'Con brief',
        dailyBudget: null,
        lifetimeBudget: null,
      },
    ]);
    attachPrismaMock({
      campaignBrief: { findFirst: jest.fn() },
      campaign: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany,
      },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(findMany).toHaveBeenCalledWith({
      where: {
        businessId: 'test-business',
        campaignBriefId: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('permite crear una campaña con campaignBriefId APPROVED del propio negocio', async () => {
    const briefFindFirst = jest.fn(async () =>
      buildBrief({ id: 'brief-ok', status: 'APPROVED' }),
    );
    const campaignCreate = jest.fn(async () => ({ id: 'cmp-1' }));
    attachPrismaMock({
      campaignBrief: { findFirst: briefFindFirst },
      campaign: { create: campaignCreate, update: jest.fn(), findFirst: jest.fn() },
      mediaAsset: { findFirst: jest.fn() },
      creative: { create: jest.fn() },
      campaignCreative: { create: jest.fn() },
      $transaction: jest.fn(),
    });
    const { service } = buildService();

    await expect(
      service.create({
        name: 'Promo Balayage',
        objective: 'Reservas',
        campaignBriefId: 'brief-ok',
      }),
    ).resolves.toEqual({ id: 'cmp-1' });
    expect(briefFindFirst).toHaveBeenCalledWith({
      where: { id: 'brief-ok', businessId: 'test-business' },
      select: { id: true, status: true },
    });
  });
});
