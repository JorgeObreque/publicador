import { FixtureGoogleDriveClient } from '../google-drive/fixture-google-drive.client';
import { MediaAssetService } from './media-asset.service';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import * as heif from './heif-converter';

interface PrismaMock {
  mediaAsset: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    create: jest.Mock;
    updateMany: jest.Mock;
  };
}

function makeService(prismaMock: PrismaMock): { service: MediaAssetService; fixture: FixtureGoogleDriveClient } {
  const fixture = new FixtureGoogleDriveClient();
  const googleDrive = new GoogleDriveService({ load: () => ({ rootFolderId: 'root' }) }, fixture);
  const service = new MediaAssetService(
    { resolve: () => ({ businessId: 'test-business', source: 'env' }) },
    googleDrive,
  );
  Object.assign(prisma, prismaMock);
  (prisma as unknown as { mediaAsset: unknown })['mediaAsset'] = prismaMock.mediaAsset as unknown as never;
  return { service, fixture };
}

describe('MediaAssetService (fixture)', () => {
  const businessId = 'test-business';
  let prismaMock: PrismaMock;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.BUSINESS_ID = businessId;
    prismaMock = {
      mediaAsset: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    } as unknown as PrismaMock;
  });

  it('descubre y persiste imágenes nuevas desde Drive', async () => {
    const { service, fixture } = makeService(prismaMock);
    fixture.setLayout(
      { id: 'root', name: 'root', driveFolderId: 'root' },
      [{ id: 'im', name: 'imagenes', driveFolderId: 'img-1' }],
    );
    fixture.putFiles('img-1', [
      {
        id: 'f1',
        name: 'a.jpg',
        driveFileId: 'f1',
        driveFolderId: 'img-1',
        folderKey: 'imagenes',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        modifiedTime: '2026-09-21T10:00:00Z',
        md5Checksum: 'hash',
        extension: 'jpg',
      },
    ]);
    prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
    prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
    prismaMock.mediaAsset.create.mockResolvedValue({});
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncFromGoogleDrive();

    expect(result.folders.images?.discovered).toBe(1);
    expect(prismaMock.mediaAsset.create).toHaveBeenCalled();
    expect(result.folders.images?.converted).toBe(0);
  });

  it('no duplica archivos que ya están en estado READY', async () => {
    const { service, fixture } = makeService(prismaMock);
    fixture.setLayout(
      { id: 'root', name: 'root', driveFolderId: 'root' },
      [{ id: 'im', name: 'imagenes', driveFolderId: 'img-1' }],
    );
    fixture.putFiles('img-1', [
      {
        id: 'f1',
        name: 'a.jpg',
        driveFileId: 'f1',
        driveFolderId: 'img-1',
        folderKey: 'imagenes',
        mimeType: 'image/jpeg',
        sizeBytes: 1024,
        modifiedTime: '2026-09-21T10:00:00Z',
        extension: 'jpg',
      },
    ]);
    prismaMock.mediaAsset.findUnique.mockResolvedValue({ id: 'asset-1' });
    prismaMock.mediaAsset.update.mockResolvedValue({});
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncFromGoogleDrive();

    expect(result.folders.images?.reused).toBe(1);
    expect(prismaMock.mediaAsset.create).not.toHaveBeenCalled();
    expect(prismaMock.mediaAsset.update).toHaveBeenCalled();
  });

  it('archiva referencias que dejaron de existir en Drive', async () => {
    const { service, fixture } = makeService(prismaMock);
    fixture.setLayout(
      { id: 'root', name: 'root', driveFolderId: 'root' },
      [{ id: 'im', name: 'imagenes', driveFolderId: 'img-1' }],
    );
    fixture.putFiles('img-1', []);
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 2 });

    const result = await service.syncFromGoogleDrive();

    expect(result.folders.images?.archived).toBe(2);
    expect(prismaMock.mediaAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { not: 'ARCHIVED' },
        }),
      }),
    );
  });

  it('convierte HEIC a JPG y registra el derivado junto al original', async () => {
    const { service, fixture } = makeService(prismaMock);
    fixture.setLayout(
      { id: 'root', name: 'root', driveFolderId: 'root' },
      [{ id: 'im', name: 'imagenes', driveFolderId: 'img-1' }],
    );
    fixture.putFiles('img-1', [
      {
        id: 'heic-1',
        name: 'sample.heic',
        driveFileId: 'heic-1',
        driveFolderId: 'img-1',
        folderKey: 'imagenes',
        mimeType: 'image/heic',
        sizeBytes: 4096,
        modifiedTime: '2026-09-21T10:00:00Z',
        extension: 'heic',
      },
    ]);
    prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
    prismaMock.mediaAsset.findUnique.mockResolvedValue(null);
    prismaMock.mediaAsset.create.mockResolvedValue({});
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });
    const fakeJpg = Buffer.from('jpeg-bytes');
    const convertSpy = jest
      .spyOn(heif, 'convertHeifToJpeg')
      .mockResolvedValue({
        buffer: fakeJpg,
        outputPath: '/tmp/sample.jpg',
        outputMime: 'image/jpeg',
        outputBytes: fakeJpg.length,
        sourceBytes: 4096,
        durationMs: 5,
      });

    const result = await service.syncFromGoogleDrive();

    expect(convertSpy).toHaveBeenCalledTimes(1);
    expect(result.folders.images?.converted).toBe(1);
    expect(prismaMock.mediaAsset.create).toHaveBeenCalledTimes(2);
    const createArgs = prismaMock.mediaAsset.create.mock.calls.map((c: unknown[]) => {
      const outer = c[0] as { data?: Record<string, unknown> } | undefined;
      return outer?.data;
    }).filter((entry): entry is Record<string, unknown> => Boolean(entry));
    const derived = createArgs.find(
      (entry) => entry.externalFileId === 'heic-1::jpg',
    );
    expect(derived).toBeDefined();
    expect(derived?.mimeType).toBe('image/jpeg');
    expect(derived?.parentExternalFileId).toBe('heic-1');
  });
});
