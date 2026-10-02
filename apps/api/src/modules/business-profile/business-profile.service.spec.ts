import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { CommuneContextService } from '../commune-context/commune-context.service';
import { TerritoryService } from '../territory/territory.service';
import { BusinessProfileService } from './business-profile.service';
import { prisma } from '@publicador/database';

interface BusinessProfileFixture {
  id: string;
  businessId: string;
  addressLine: string | null;
  neighborhood: string | null;
  regionCutCode: string | null;
  communeCutCode: string | null;
  countryCode: string | null;
  brandVoiceKeywords: string[];
  wordsToAvoid: string[];
  preferredEmojiSemantics: string[];
  primaryCustomerProfile: string | null;
  commonObjections: string[];
  qualifyingQuestions: string[];
  weeklyServiceCapacity: number | null;
  monthlyAcquisitionGoal: number | null;
  tagline: string | null;
  differentiators: string[];
  nearbyCommunesCutCodes: string[];
  profileCompletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PrismaMock {
  businessProfile: {
    findUnique: jest.Mock;
    upsert: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
}

const baseFixture = (
  overrides: Partial<BusinessProfileFixture> = {},
): BusinessProfileFixture => ({
  id: 'profile-1',
  businessId: 'test-business',
  addressLine: null,
  neighborhood: null,
  regionCutCode: null,
  communeCutCode: null,
  countryCode: null,
  brandVoiceKeywords: [],
  wordsToAvoid: [],
  preferredEmojiSemantics: [],
  primaryCustomerProfile: '',
  commonObjections: [],
  qualifyingQuestions: [],
  weeklyServiceCapacity: null,
  monthlyAcquisitionGoal: null,
  tagline: null,
  differentiators: [],
  nearbyCommunesCutCodes: [],
  profileCompletedAt: null,
  createdAt: new Date('2026-09-27T00:00:00Z'),
  updatedAt: new Date('2026-09-27T00:00:00Z'),
  ...overrides,
});

function makeService(prismaMock: PrismaMock): {
  service: BusinessProfileService;
} {
  if (!prismaMock.businessProfile.create) {
    (prismaMock.businessProfile as { create: jest.Mock }).create = jest.fn(
      async ({ data }: { data: Partial<BusinessProfileFixture> }) =>
        baseFixture({ ...data, id: 'profile-new' }),
    );
  }
  (prisma as unknown as { businessProfile: PrismaMock['businessProfile'] }).businessProfile =
    prismaMock.businessProfile;
  return {
    service: new BusinessProfileService(
      new BusinessContextResolver(),
      new TerritoryService(),
      new CommuneContextService(new TerritoryService()),
    ),
  };
}

describe('BusinessProfileService', () => {
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

  it('getOrCreate crea un perfil vacío si no existe', async () => {
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(),
        create: jest.fn(async ({ data }: { data: Partial<BusinessProfileFixture> }) =>
          baseFixture({ ...data, id: 'profile-new' }),
        ),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);
    const profile = await service.getOrCreate();

    expect(profile.id).toBe('profile-new');
    expect(profile.businessId).toBe('test-business');
    expect(profile.primaryCustomerProfile).toBe('');
    expect(profile.brandVoiceKeywords).toEqual([]);
    expect(profile.profileCompletedAt).toBeNull();
    expect(prismaMock.businessProfile.create).toHaveBeenCalled();
    expect(prismaMock.businessProfile.upsert).not.toHaveBeenCalled();
  });

  it('getOrCreate devuelve el perfil existente si ya está persistido', async () => {
    const existing = baseFixture({
      id: 'profile-existing',
      addressLine: 'Centro Comercial Omnium',
      regionCutCode: '13',
      communeCutCode: '13114',
      countryCode: 'CL',
    });
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);
    const profile = await service.getOrCreate();

    expect(profile.id).toBe('profile-existing');
    expect(profile.addressLine).toBe('Centro Comercial Omnium');
    expect(profile.regionCutCode).toBe('13');
    expect(profile.communeCutCode).toBe('13114');
    expect(prismaMock.businessProfile.create).not.toHaveBeenCalled();
  });

  it('upsert actualiza los campos enviados y NO crea nuevo perfil si ya existe', async () => {
    const existing = baseFixture({ id: 'profile-existing' });
    const upserted = baseFixture({
      ...existing,
      addressLine: 'Centro Comercial Omnium',
      regionCutCode: '13',
      communeCutCode: '13114',
      countryCode: 'CL',
      primaryCustomerProfile: 'Mujeres 30-45',
    });
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: jest.fn(async () => upserted),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);
    const result = await service.upsert({
      addressLine: 'Centro Comercial Omnium',
      regionCutCode: '13',
      communeCutCode: '13114',
      primaryCustomerProfile: 'Mujeres 30-45',
    });

    expect(result.addressLine).toBe('Centro Comercial Omnium');
    expect(result.regionCutCode).toBe('13');
    expect(result.communeCutCode).toBe('13114');
    expect(result.primaryCustomerProfile).toBe('Mujeres 30-45');
    expect(prismaMock.businessProfile.upsert).toHaveBeenCalledTimes(1);
    const callArgs = prismaMock.businessProfile.upsert.mock.calls[0][0];
    expect(callArgs.where).toEqual({ businessId: 'test-business' });
    expect(callArgs.create.businessId).toBe('test-business');
    expect(callArgs.create.primaryCustomerProfile).toBe('Mujeres 30-45');
    expect(callArgs.create.regionCutCode).toBe('13');
    expect(callArgs.create.communeCutCode).toBe('13114');
    expect(callArgs.update.primaryCustomerProfile).toBe('Mujeres 30-45');
    expect(callArgs.update.regionCutCode).toBe('13');
    expect(callArgs.update.communeCutCode).toBe('13114');
    expect(callArgs.update.countryCode).toBe('CL');
  });

  it('upsert setea profileCompletedAt cuando se completan todos los campos críticos', async () => {
    const existing = baseFixture({ id: 'profile-existing' });
    const upsertSpy = jest.fn(async () =>
      baseFixture({
        ...(existing as BusinessProfileFixture),
        addressLine: 'Centro Comercial Omnium',
        neighborhood: 'Las Condes',
        regionCutCode: '13',
        communeCutCode: '13114',
        countryCode: 'CL',
        primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        qualifyingQuestions: ['¿Buscas un cambio sutil?'],
        brandVoiceKeywords: ['cercana'],
        profileCompletedAt: new Date('2026-09-27T01:00:00Z'),
      }),
    );
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: upsertSpy,
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);

    const result = await service.upsert({
      addressLine: 'Centro Comercial Omnium',
      neighborhood: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
      qualifyingQuestions: ['¿Buscas un cambio sutil?'],
      brandVoiceKeywords: ['cercana'],
    });

    expect(result.profileCompletedAt).toBeInstanceOf(Date);
    const createCallArgs = upsertSpy.mock.calls[0][0].create;
    expect(createCallArgs.profileCompletedAt).toBeInstanceOf(Date);
  });

  it('upsert NO setea profileCompletedAt si ya estaba seteado (idempotente)', async () => {
    const completedAt = new Date('2026-09-27T00:00:00Z');
    const existing = baseFixture({
      id: 'profile-existing',
      addressLine: 'Centro Comercial Omnium',
      neighborhood: 'Las Condes',
      regionCutCode: '13',
      communeCutCode: '13114',
      countryCode: 'CL',
      primaryCustomerProfile: 'Mujeres 30-45',
      qualifyingQuestions: ['Pregunta existente'],
      brandVoiceKeywords: ['cercana'],
      profileCompletedAt: completedAt,
    });
    const upsertSpy = jest.fn(async () => ({
      ...existing,
      tagline: 'Nueva frase',
    }));
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: upsertSpy,
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);
    const result = await service.upsert({
      tagline: 'Nueva frase',
    });

    expect(result.profileCompletedAt).toEqual(completedAt);
    // El update (que sí se ejecuta porque existing existe) NO debe
    // sobrescribir `profileCompletedAt` con un `new Date()` nuevo.
    const updateCallArgs = upsertSpy.mock.calls[0][0].update;
    expect(updateCallArgs.profileCompletedAt).toBeUndefined();
  });

  it('upsert rellena countryCode a CL por defecto si el cliente lo omite', async () => {
    const existing = baseFixture({ id: 'profile-existing' });
    const upsertSpy = jest.fn(async () =>
      baseFixture({ ...existing, countryCode: 'CL' }),
    );
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: upsertSpy,
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);

    await service.upsert({
      primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
      regionCutCode: '13',
      communeCutCode: '13114',
    });

    expect(upsertSpy.mock.calls[0][0].update.countryCode).toBe('CL');
    expect(upsertSpy.mock.calls[0][0].create.countryCode).toBe('CL');
  });

  it('upsert rechaza con BadRequestException si regionCutCode no existe en el catálogo', async () => {
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);

    await expect(
      service.upsert({
        primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        regionCutCode: '99',
      }),
    ).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('Región inválida'),
    });
    expect(prismaMock.businessProfile.upsert).not.toHaveBeenCalled();
  });

  it('upsert rechaza con BadRequestException si communeCutCode no pertenece a la región', async () => {
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => null),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);

    await expect(
      service.upsert({
        primaryCustomerProfile: 'Mujeres 30-45 con cabello dañado.',
        regionCutCode: '13',
        communeCutCode: '05101',
      }),
    ).rejects.toMatchObject({
      name: 'BadRequestException',
      message: expect.stringContaining('La comuna no pertenece a la región'),
    });
    expect(prismaMock.businessProfile.upsert).not.toHaveBeenCalled();
  });

  it('getDisplayLocation devuelve "Las Condes, Región Metropolitana de Santiago" + dirección', () => {
    const { service } = makeService({
      businessProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const location = service.getDisplayLocation(
      baseFixture({
        addressLine: 'Centro Comercial Omnium, Local 12',
        neighborhood: 'Las Condes',
        regionCutCode: '13',
        communeCutCode: '13114',
        countryCode: 'CL',
      }),
    );
    expect(location).toBe(
      'Centro Comercial Omnium, Local 12, Las Condes, Región Metropolitana de Santiago',
    );
  });

  it('getDisplayLocation omite la comuna cuando no hay CUT conocido', () => {
    const { service } = makeService({
      businessProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const location = service.getDisplayLocation(
      baseFixture({
        regionCutCode: '13',
        communeCutCode: null,
      }),
    );
    expect(location).toBe('Región Metropolitana de Santiago');
  });

  it('isReady devuelve false cuando profileCompletedAt es null', () => {
    const service = new BusinessProfileService(
      new BusinessContextResolver(),
      new TerritoryService(),
      new CommuneContextService(new TerritoryService()),
    );
    expect(service.isReady(null)).toBe(false);
    expect(service.isReady({ profileCompletedAt: null })).toBe(false);
  });

  it('isReady devuelve true cuando profileCompletedAt está seteado', () => {
    const service = new BusinessProfileService(
      new BusinessContextResolver(),
      new TerritoryService(),
      new CommuneContextService(new TerritoryService()),
    );
    expect(service.isReady({ profileCompletedAt: new Date() })).toBe(true);
  });

  it('upsert persiste nearbyCommunesCutCodes cuando se envía en el input', async () => {
    const existing = baseFixture({ id: 'profile-existing' });
    const upsertSpy = jest.fn(async ({ create }: { create: Record<string, unknown> }) =>
      baseFixture({
        ...existing,
        ...create,
        id: 'profile-existing',
      }),
    );
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: upsertSpy,
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    const { service } = makeService(prismaMock);

    await service.upsert({
      primaryCustomerProfile: 'Mujeres 30-45',
      nearbyCommunesCutCodes: ['13114', '13123', '13132'],
    });

    const createArgs = upsertSpy.mock.calls[0][0].create;
    const updateArgs = upsertSpy.mock.calls[0][0].update;
    expect(createArgs.nearbyCommunesCutCodes).toEqual(['13114', '13123', '13132']);
    expect(updateArgs.nearbyCommunesCutCodes).toEqual(['13114', '13123', '13132']);
  });

  it('getBusinessContext devuelve contexto + vecinos para una comuna RM con datos', () => {
    const { service } = makeService({
      businessProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const result = service.getBusinessContext(
      baseFixture({
        regionCutCode: '13',
        communeCutCode: '13114',
      }),
    );
    expect(result.regionName).toBe('Región Metropolitana de Santiago');
    expect(result.communeName).toBe('Las Condes');
    expect(result.regionCutCode).toBe('13');
    expect(result.communeCutCode).toBe('13114');
    expect(result.context).not.toBeNull();
    expect(result.context?.cutCode).toBe('13114');
    expect(result.context?.avgHouseholdIncomeCLP).toBeGreaterThan(1_500_000);
    expect(result.neighbors).toHaveLength(10);
    expect(result.neighbors.find((n) => n.cutCode === '13114')).toBeUndefined();
  });

  it('getBusinessContext devuelve context=null y neighbors=[] cuando no hay comuna', () => {
    const { service } = makeService({
      businessProfile: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    });
    const result = service.getBusinessContext(baseFixture({ regionCutCode: null, communeCutCode: null }));
    expect(result.context).toBeNull();
    expect(result.neighbors).toEqual([]);
    expect(result.regionName).toBeNull();
    expect(result.communeName).toBeNull();
  });

  it('markCompleted setea profileCompletedAt una sola vez', async () => {
    const existing = baseFixture({ id: 'profile-existing' });
    const completed = baseFixture({
      ...existing,
      profileCompletedAt: new Date('2026-09-27T01:00:00Z'),
    });
    const prismaMock: PrismaMock = {
      businessProfile: {
        findUnique: jest.fn(async () => existing),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(async () => completed),
      },
    };
    const { service } = makeService(prismaMock);

    const result = await service.markCompleted();
    expect(result.profileCompletedAt).toBeInstanceOf(Date);
    expect(prismaMock.businessProfile.update).toHaveBeenCalled();

    // Si ya estaba completado, no debe volver a llamar a update
    const alreadyCompleted = baseFixture({ profileCompletedAt: new Date() });
    prismaMock.businessProfile.findUnique.mockResolvedValueOnce(alreadyCompleted);
    prismaMock.businessProfile.update.mockClear();
    const result2 = await service.markCompleted();
    expect(result2.profileCompletedAt).toEqual(alreadyCompleted.profileCompletedAt);
    expect(prismaMock.businessProfile.update).not.toHaveBeenCalled();
  });
});
