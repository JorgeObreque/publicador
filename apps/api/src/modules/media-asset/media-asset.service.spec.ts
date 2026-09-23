import { FixtureGoogleDriveClient } from '../google-drive/fixture-google-drive.client';
import { MediaAssetService } from './media-asset.service';
import { prisma } from '@publicador/database';
import { GoogleDriveService } from '../google-drive/google-drive.service';

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

function makeService(prismaMock: PrismaMock): {
  service: MediaAssetService;
  fixture: FixtureGoogleDriveClient;
} {
  const fixture = new FixtureGoogleDriveClient();
  const googleDrive = new GoogleDriveService({ load: () => ({ rootFolderId: 'root' }) }, fixture);
  const service = new MediaAssetService(
    { resolve: () => ({ businessId: 'test-business', source: 'env' }) },
    googleDrive,
  );
  Object.assign(prisma, prismaMock);
  (prisma as unknown as { mediaAsset: unknown })['mediaAsset'] =
    prismaMock.mediaAsset as unknown as never;
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

  it('descubre y persiste metadatos sin descargar archivos', async () => {
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
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncFromGoogleDrive();

    expect(result.folders.images?.discovered).toBe(1);
    expect(prismaMock.mediaAsset.create).toHaveBeenCalled();
    expect(prismaMock.mediaAsset.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mimeType: 'image/jpeg',
        checksum: 'hash',
        status: 'READY',
      }),
    );
  });

  it('no descarga imágenes HEIC ni genera derivados JPG persistentes', async () => {
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
    prismaMock.mediaAsset.updateMany.mockResolvedValue({ count: 0 });

    const result = await service.syncFromGoogleDrive();

    expect(result.folders.images?.discovered).toBe(1);
    expect(prismaMock.mediaAsset.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.mediaAsset.create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ mimeType: 'image/heic', kind: 'IMAGE' }),
    );
  });

  it('reutiliza metadatos sin volver a descargar ni reescribir el archivo', async () => {
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
});
