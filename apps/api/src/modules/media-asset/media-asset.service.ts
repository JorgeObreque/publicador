import { Injectable, Logger } from '@nestjs/common';
import { MediaAssetKind, MediaAssetSource, Prisma } from '@prisma/client';
import { prisma } from '@publicador/database';
import { BusinessContextResolver } from '../../shared/business-context/business-context.resolver';
import { GoogleDriveService } from '../google-drive/google-drive.service';
import { GoogleDriveFile } from '../google-drive/google-drive.types';
import {
  convertHeifToJpeg,
  HeifConversionError,
  HeifConversionResult,
} from './heif-converter';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
  converted: number;
}

export interface ReadyMediaAsset {
  id: string;
  kind: MediaAssetKind;
  mimeType: string;
  externalLink: string | null;
  localPath: string | null;
  name: string;
  parentExternalFileId: string | null;
}

const SUPPORTED_IMAGE_KINDS: MediaAssetKind[] = ['IMAGE'];
const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const CONVERTIBLE_IMAGE_MIME_TYPES = ['image/heic', 'image/heif'] as const;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export const MEDIA_ASSET_CONVERSION_DIR =
  process.env.PUBLICADOR_MEDIA_DIR ?? join(process.cwd(), '.data', 'media-assets');

@Injectable()
export class MediaAssetService {
  private readonly logger = new Logger(MediaAssetService.name);

  constructor(
    private readonly businessContext: BusinessContextResolver,
    private readonly googleDrive: GoogleDriveService,
  ) {
    void mkdir(MEDIA_ASSET_CONVERSION_DIR, { recursive: true }).catch(() => undefined);
  }

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
        ['VIDEO'],
        ['video/mp4', 'video/quicktime'],
        false,
      );
    }
    return result;
  }

  async listAssets(filter: { kind?: MediaAssetKind } = {}): Promise<unknown[]> {
    const where: Prisma.MediaAssetWhereInput = { businessId: this.businessId, status: { not: 'ARCHIVED' } };
    if (filter.kind) {
      where.kind = filter.kind;
    }
    return prisma.mediaAsset.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findReadyImageById(id: string): Promise<ReadyMediaAsset | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, businessId: this.businessId, status: 'READY' },
    });
    if (!asset) return null;
    return this.toReady(asset);
  }

  async findReadyImageByName(name: string): Promise<ReadyMediaAsset | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { businessId: this.businessId, name, status: 'READY' },
      orderBy: { lastSyncedAt: 'desc' },
    });
    return asset ? this.toReady(asset) : null;
  }

  async describeDownloadUrl(id: string): Promise<{
    id: string;
    publicUrl: string;
    mimeType: string;
    name: string;
    sizeBytes: number;
  } | null> {
    const asset = await this.resolveDownload(id);
    return asset;
  }

  async resolveDownload(id: string): Promise<{
    id: string;
    publicUrl: string;
    mimeType: string;
    name: string;
    sizeBytes: number;
  } | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, businessId: this.businessId, status: 'READY' },
    });
    if (!asset || !asset.externalLocalPath) return null;
    const base =
      process.env.PUBLICADOR_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      'http://localhost:3001';
    return {
      id: asset.id,
      publicUrl: `${base.replace(/\/$/, '')}/api/v1/media-assets/${asset.id}/file`,
      mimeType: asset.mimeType,
      name: asset.name,
      sizeBytes: asset.sizeBytes,
    };
  }

  async resolveFileStream(id: string): Promise<{
    localPath: string;
    mimeType: string;
    name: string;
  } | null> {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, businessId: this.businessId, status: 'READY' },
    });
    if (!asset?.externalLocalPath) return null;
    return {
      localPath: asset.externalLocalPath,
      mimeType: asset.mimeType,
      name: asset.name,
    };
  }

  private toReady(asset: Prisma.MediaAssetGetPayload<true>): ReadyMediaAsset {
    return {
      id: asset.id,
      kind: asset.kind,
      mimeType: asset.mimeType,
      externalLink: asset.externalLink,
      localPath: asset.externalLocalPath,
      name: asset.name,
      parentExternalFileId: asset.parentExternalFileId,
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
      converted: 0,
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
      const isStandard = SUPPORTED_IMAGE_MIME_TYPES.includes(
        mime as (typeof SUPPORTED_IMAGE_MIME_TYPES)[number],
      );
      const isConvertible = CONVERTIBLE_IMAGE_MIME_TYPES.includes(
        mime as (typeof CONVERTIBLE_IMAGE_MIME_TYPES)[number],
      );
      if (!isStandard && !isConvertible) continue;
      if (file.sizeBytes > MAX_IMAGE_BYTES) {
        this.logger.warn(`Excede el tamaño máximo: ${file.name}`);
        continue;
      }
      seen.add(file.driveFileId);

      if (isConvertible) {
        const converted = await this.convertAndPersistRawImage(file, summary);
        if (converted) summary.converted += 1;
        continue;
      }
      await this.upsertStandardImage(file, summary);
    }

    const archivedImageNow = await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFolderId: folder.driveFolderId,
        AND: [
          { externalFileId: { notIn: Array.from(seen) } },
          { NOT: { parentExternalFileId: { in: Array.from(seen) } } },
        ],
        status: { not: 'ARCHIVED' },
      },
      data: { status: 'ARCHIVED', archivedAt: new Date(), lastSyncedAt: new Date() },
    });
    summary.archived = archivedImageNow.count;
    return summary;
  }

  private async syncMediaFolder(
    folder: { driveFolderId: string; name: string },
    kinds: MediaAssetKind[],
    allowedMimeTypes: string[],
    _convertible: boolean,
  ): Promise<SyncFolderSummary> {
    const summary: SyncFolderSummary = {
      folderId: folder.driveFolderId,
      discovered: 0,
      upserts: 0,
      archived: 0,
      reused: 0,
      converted: 0,
    };
    const files = kinds.includes('IMAGE')
      ? await this.googleDrive.listImages({
          id: folder.driveFolderId,
          name: folder.name,
          driveFolderId: folder.driveFolderId,
        })
      : await this.googleDrive.listVideos({
          id: folder.driveFolderId,
          name: folder.name,
          driveFolderId: folder.driveFolderId,
        });
    summary.discovered = files.length;

    const seen = new Set<string>();
    const allowedKinds = new Set(kinds);
    for (const file of files) {
      if (!allowedMimeTypes.includes(file.mimeType)) continue;
      if (file.sizeBytes > MAX_IMAGE_BYTES) {
        this.logger.warn(`Excede el tamaño máximo: ${file.name}`);
        continue;
      }
      seen.add(file.driveFileId);
      const existing = await prisma.mediaAsset.findUnique({
        where: {
          businessId_source_externalFileId: {
            businessId: this.businessId,
            source: MediaAssetSource.GOOGLE_DRIVE,
            externalFileId: file.driveFileId,
          },
        },
      });
      const nextKind = (allowedKinds.has('IMAGE') ? 'IMAGE' : 'VIDEO') as MediaAssetKind;
      if (existing) {
        summary.reused += 1;
        await prisma.mediaAsset.update({
          where: { id: existing.id },
          data: this.buildUpdateFromFile(file),
        });
        continue;
      }
      await prisma.mediaAsset.create({
        data: {
          ...this.buildCreateFromFile(file),
          kind: nextKind,
        },
      });
      summary.upserts += 1;
    }

    const archivedNow = await prisma.mediaAsset.updateMany({
      where: {
        businessId: this.businessId,
        source: MediaAssetSource.GOOGLE_DRIVE,
        externalFolderId: folder.driveFolderId,
        externalFileId: { notIn: Array.from(seen) },
        status: { not: 'ARCHIVED' },
      },
      data: { status: 'ARCHIVED', archivedAt: new Date(), lastSyncedAt: new Date() },
    });
    summary.archived = archivedNow.count;
    return summary;
  }

  private async upsertStandardImage(file: GoogleDriveFile, summary: SyncFolderSummary): Promise<void> {
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
      data: { ...this.buildCreateFromFile(file), kind: SUPPORTED_IMAGE_KINDS[0] },
    });
    summary.upserts += 1;
  }

  private async convertAndPersistRawImage(
    file: GoogleDriveFile,
    summary: SyncFolderSummary,
  ): Promise<boolean> {
    const existingRaw = await prisma.mediaAsset.findUnique({
      where: {
        businessId_source_externalFileId: {
          businessId: this.businessId,
          source: MediaAssetSource.GOOGLE_DRIVE,
          externalFileId: file.driveFileId,
        },
      },
    });
    if (!existingRaw) {
      await prisma.mediaAsset.create({
        data: {
          ...this.buildCreateFromFile(file),
          kind: SUPPORTED_IMAGE_KINDS[0],
        },
      });
    }
    void summary;

    let buffer: Buffer;
    try {
      buffer = await this.googleDrive.download(file);
    } catch (error) {
      this.logger.warn(`No se pudo descargar ${file.name}: ${(error as Error).message}`);
      return false;
    }
    let conversion: HeifConversionResult | null;
    try {
      conversion = await convertHeifToJpeg(buffer);
    } catch (error) {
      if (error instanceof HeifConversionError) {
        this.logger.warn(`Conversión HEIC fallida para ${file.name}: ${error.message}`);
      } else {
        this.logger.warn(`Fallo inesperado al convertir ${file.name}: ${(error as Error).message}`);
      }
      return false;
    }
    const derivedName = this.derivedName(file.name);
    const localPath = await this.persistDerived(derivedName, conversion.buffer);
    const derivedId = `${file.driveFileId}::jpg`;

    const existingDerived = await prisma.mediaAsset.findUnique({
      where: {
        businessId_source_externalFileId: {
          businessId: this.businessId,
          source: MediaAssetSource.GOOGLE_DRIVE,
          externalFileId: derivedId,
        },
      },
    });
    const derivedData = {
      businessId: this.businessId,
      source: MediaAssetSource.GOOGLE_DRIVE,
      kind: SUPPORTED_IMAGE_KINDS[0],
      externalFileId: derivedId,
      externalFolderId: file.driveFolderId,
      externalFolderKey: file.folderKey,
      externalLink: file.webContentLink,
      externalLocalPath: localPath,
      parentExternalFileId: file.driveFileId,
      name: derivedName,
      mimeType: conversion.outputMime,
      sizeBytes: conversion.outputBytes,
      lastSyncedAt: new Date(),
    } as Prisma.MediaAssetUncheckedCreateInput;

    if (existingDerived) {
      summary.reused += 1;
      await prisma.mediaAsset.update({
        where: { id: existingDerived.id },
        data: { ...derivedData, name: derivedName } as Prisma.MediaAssetUpdateInput,
      });
    } else {
      summary.upserts += 1;
      await prisma.mediaAsset.create({ data: derivedData });
    }
    return true;
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
      status: 'READY',
    };
  }

  private buildCreateFromFile(file: GoogleDriveFile, kind: MediaAssetKind = SUPPORTED_IMAGE_KINDS[0]): Prisma.MediaAssetUncheckedCreateInput {
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
    };
  }

  private async persistDerived(name: string, buffer: Buffer): Promise<string> {
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const target = join(MEDIA_ASSET_CONVERSION_DIR, safeName);
    await writeFile(target, buffer);
    return target;
  }

  private derivedName(name: string): string {
    const base = name.replace(/\.(heic|heif)$/i, '');
    return `${base}.jpg`;
  }
}
