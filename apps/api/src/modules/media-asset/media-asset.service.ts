import { Injectable, Logger } from '@nestjs/common';
import { MediaAssetKind, MediaAssetSource, MediaAssetStatus, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { GoogleDriveFile } from '../google-drive/google-drive.types';

export interface SyncMediaAssetsResult {
  rootFolderId: string;
  folders: {
    images?: SyncFolderSummary;
    videos?: SyncFolderSummary;
  };
  failures: Array<{ folder: string; message: string }>;
}

export interface SyncFolderSummary {
  folderId: string;
  discovered: number;
  upserts: number;
  archived: number;
  reused: number;
}

export interface ReadyMediaAsset {
  id: string;
  kind: MediaAssetKind;
  mimeType: string;
  name: string;
  status: MediaAssetStatus;
}

export interface MediaAssetSummary {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: MediaAssetStatus;
  kind: MediaAssetKind;
  source: MediaAssetSource;
  externalFileId: string;
  modifiedTime: string | null;
  requiresConversion: boolean;
  isAvailable: boolean;
  thumbnailUrl: string;
}

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const CONVERTIBLE_IMAGE_MIME_TYPES = new Set(['image/heic', 'image/heif']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime']);
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

@Injectable()
export class MediaAssetService {
  private readonly logger = new Logger(MediaAssetService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    private readonly googleDrive: GoogleDriveService,
  ) {}

  private get businessId(): string {
    return this.businessContext.resolve().businessId;
  }

  async syncFromGoogleDrive(): Promise<SyncMediaAssetsResult> {
    const result: SyncMediaAssetsResult = {
      rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? '',
      folders: {},
      failures: [],
    };
    const folders = await this.googleDrive.findNamedSubfolders();
    if (!folders.images && !folders.videos) {
      this.logger.warn('No se encontraron subcarpetas imagenes ni videos en la raíz Drive.');
      return result;
    }
    if (folders.images) {
      result.folders.images = await this.syncImageFolder(folders.images);
    }
    if (folders.videos) {
      result.folders.videos = await this.syncMediaFolder(
        folders.videos,
        VIDEO_MIME_TYPES,
        ['VIDEO'],
      );
    }
    return result;
  }

  async listAssets(): Promise<MediaAssetSummary[]> {
    const assets = await prisma.mediaAsset.findMany({
      where: { businessId: this.businessId, status: { not: MediaAssetStatus.ARCHIVED } },
      orderBy: { name: 'asc' },
    });
    return assets.map((asset) => this.toSummary(asset));
  }

  async listImages(): Promise<MediaAssetSummary[]> {
    const assets = await prisma.mediaAsset.findMany({
      where: {
        businessId: this.businessId,
        kind: 'IMAGE',
        status: { not: MediaAssetStatus.ARCHIVED },
      },
      orderBy: { name: 'asc' },
    });
    return assets.map((asset) => this.toSummary(asset));
  }

  async findImageForPublishing(id: string): Promise<{
    id: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    status: MediaAssetStatus;
  } | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id,
        businessId: this.businessId,
        kind: 'IMAGE',
        status: { not: MediaAssetStatus.ARCHIVED },
      },
    });
    if (!asset) return null;
    return {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
    };
  }

  async markMissing(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFileId: { in: fileIds },
      },
      data: { status: MediaAssetStatus.MISSING },
    });
  }

  async markReady(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;
    await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFileId: { in: fileIds },
      },
      data: { status: MediaAssetStatus.READY },
    });
  }

  async downloadImageBytes(id: string): Promise<{
    name: string;
    mimeType: string;
    buffer: Buffer;
    status: MediaAssetStatus;
  } | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: {
        id,
        businessId: this.businessId,
        kind: 'IMAGE',
        status: { not: MediaAssetStatus.ARCHIVED },
      },
    });
    if (!asset) return null;
    const file: GoogleDriveFile = {
      id: asset.externalFileId,
      name: asset.name,
      driveFileId: asset.externalFileId,
      driveFolderId: asset.externalFolderId ?? '',
      folderKey: asset.externalFolderKey ?? 'imagenes',
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      modifiedTime: asset.lastSyncedAt.toISOString(),
      md5Checksum: asset.checksum ?? undefined,
      extension: '',
    };
    const buffer = await this.googleDrive.download(file);
    return {
      name: asset.name,
      mimeType: asset.mimeType,
      buffer,
      status: asset.status,
    };
  }

  async fetchThumbnailStream(id: string): Promise<{
    buffer: Buffer;
    mimeType: string;
    name: string;
  } | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, businessId: this.businessId, status: { not: MediaAssetStatus.ARCHIVED } },
    });
    if (!asset) return null;
    const file: GoogleDriveFile = {
      id: asset.externalFileId,
      name: asset.name,
      driveFileId: asset.externalFileId,
      driveFolderId: asset.externalFolderId ?? '',
      folderKey: asset.externalFolderKey ?? 'imagenes',
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      modifiedTime: asset.lastSyncedAt.toISOString(),
      md5Checksum: asset.checksum ?? undefined,
      extension: '',
    };
    const buffer = await this.googleDrive.fetchThumbnail(file);
    return { buffer, mimeType: 'image/jpeg', name: asset.name };
  }

  private toSummary(asset: Prisma.MediaAssetGetPayload<true>): MediaAssetSummary {
    const base =
      process.env.PUBLICADOR_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:3001';
    return {
      id: asset.id,
      name: asset.name,
      mimeType: asset.mimeType,
      sizeBytes: asset.sizeBytes,
      status: asset.status,
      kind: asset.kind,
      source: asset.source,
      externalFileId: asset.externalFileId,
      modifiedTime: asset.lastSyncedAt.toISOString(),
      requiresConversion: CONVERTIBLE_IMAGE_MIME_TYPES.has(asset.mimeType.toLowerCase()),
      isAvailable: asset.status === MediaAssetStatus.READY,
      thumbnailUrl: `${base.replace(/\/$/, '')}/api/v1/media-assets/${asset.id}/thumbnail`,
    };
  }

  private async syncImageFolder(folder: {
    driveFolderId: string;
    name: string;
  }): Promise<SyncFolderSummary> {
    const summary: SyncFolderSummary = {
      folderId: folder.driveFolderId,
      discovered: 0,
      upserts: 0,
      archived: 0,
      reused: 0,
    };
    const files = await this.googleDrive.listImages({
      id: folder.driveFolderId,
      name: folder.name,
      driveFolderId: folder.driveFolderId,
    });
    summary.discovered = files.length;
    const seen = new Set<string>();
    for (const file of files) {
      const mime = file.mimeType.toLowerCase();
      if (!IMAGE_MIME_TYPES.has(mime)) continue;
      if (file.sizeBytes > MAX_IMAGE_BYTES) {
        this.logger.warn(`Excede el tamaño máximo: ${file.name}`);
        continue;
      }
      seen.add(file.driveFileId);
      await this.upsertImage(file, summary);
    }

    const archived = await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFolderId: folder.driveFolderId,
        externalFileId: { notIn: Array.from(seen) },
        status: { not: MediaAssetStatus.ARCHIVED },
      },
      data: {
        status: MediaAssetStatus.ARCHIVED,
        archivedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
    summary.archived = archived.count;
    return summary;
  }

  private async syncMediaFolder(
    folder: { driveFolderId: string; name: string },
    allowedMimeTypes: Set<string>,
    kinds: MediaAssetKind[],
  ): Promise<SyncFolderSummary> {
    const summary: SyncFolderSummary = {
      folderId: folder.driveFolderId,
      discovered: 0,
      upserts: 0,
      archived: 0,
      reused: 0,
    };
    const files = await this.googleDrive.listVideos({
      id: folder.driveFolderId,
      name: folder.name,
      driveFolderId: folder.driveFolderId,
    });
    summary.discovered = files.length;
    const seen = new Set<string>();
    for (const file of files) {
      if (!allowedMimeTypes.has(file.mimeType)) continue;
      if (file.sizeBytes > MAX_IMAGE_BYTES) {
        this.logger.warn(`Excede el tamaño máximo: ${file.name}`);
        continue;
      }
      seen.add(file.driveFileId);
      await this.upsertVideo(file, summary, kinds);
    }
    const archived = await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFolderId: folder.driveFolderId,
        externalFileId: { notIn: Array.from(seen) },
        status: { not: MediaAssetStatus.ARCHIVED },
      },
      data: {
        status: MediaAssetStatus.ARCHIVED,
        archivedAt: new Date(),
        lastSyncedAt: new Date(),
      },
    });
    summary.archived = archived.count;
    return summary;
  }

  private async upsertImage(file: GoogleDriveFile, summary: SyncFolderSummary): Promise<void> {
    const existing = await prisma.mediaAsset.findUnique({
      where: {
        businessId_source_externalFileId: {
          businessId: this.businessId,
          source: MediaAssetSource.GOOGLE_DRIVE,
          externalFileId: file.driveFileId,
        },
      },
    });
    if (existing) {
      summary.reused += 1;
      await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: this.buildUpdateFromFile(file),
      });
      return;
    }
    await prisma.mediaAsset.create({
      data: { ...this.buildCreateFromFile(file), kind: 'IMAGE' },
    });
    summary.upserts += 1;
  }

  private async upsertVideo(
    file: GoogleDriveFile,
    summary: SyncFolderSummary,
    kinds: MediaAssetKind[],
  ): Promise<void> {
    const existing = await prisma.mediaAsset.findUnique({
      where: {
        businessId_source_externalFileId: {
          businessId: this.businessId,
          source: MediaAssetSource.GOOGLE_DRIVE,
          externalFileId: file.driveFileId,
        },
      },
    });
    if (existing) {
      summary.reused += 1;
      await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: this.buildUpdateFromFile(file),
      });
      return;
    }
    await prisma.mediaAsset.create({
      data: { ...this.buildCreateFromFile(file), kind: kinds[0] },
    });
    summary.upserts += 1;
  }

  private buildUpdateFromFile(file: GoogleDriveFile): Prisma.MediaAssetUpdateInput {
    return {
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.md5Checksum ?? undefined,
      externalFolderId: file.driveFolderId,
      externalFolderKey: file.folderKey,
      externalLink: file.webContentLink ?? undefined,
      lastSyncedAt: new Date(),
      status: MediaAssetStatus.READY,
    };
  }

  private buildCreateFromFile(
    file: GoogleDriveFile,
    kind: MediaAssetKind = 'IMAGE',
  ): Prisma.MediaAssetUncheckedCreateInput {
    return {
      businessId: this.businessId,
      source: MediaAssetSource.GOOGLE_DRIVE,
      kind,
      externalFileId: file.driveFileId,
      externalFolderId: file.driveFolderId,
      externalFolderKey: file.folderKey,
      externalLink: file.webContentLink,
      name: file.name,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksum: file.md5Checksum,
      lastSyncedAt: new Date(),
      status: MediaAssetStatus.READY,
    };
  }
}
