import 'reflect-metadata';
import { Controller, Get, Param, Post, Query, BadRequestException, Res } from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, statSync } from 'node:fs';
import { MediaAssetKind } from '@prisma/client';
import { MediaAssetService } from './media-asset.service';

const VALID_KINDS = new Set<MediaAssetKind>(['IMAGE', 'VIDEO']);

@Controller('media-assets')
export class MediaAssetController {
  constructor(private readonly mediaAssets: MediaAssetService) {}

  @Post('drive/sync')
  syncFromGoogleDrive() {
    return this.mediaAssets.syncFromGoogleDrive();
  }

  @Get()
  list(@Query('kind') kind?: string) {
    if (kind && !VALID_KINDS.has(kind as MediaAssetKind)) {
      throw new BadRequestException(`kind debe ser uno de: ${[...VALID_KINDS].join(', ')}`);
    }
    return this.mediaAssets.listAssets({ kind: kind as MediaAssetKind | undefined });
  }

  @Get(':id/download')
  describe(@Param('id') id: string) {
    return this.mediaAssets.describeDownloadUrl(id);
  }

  @Get(':id/file')
  async stream(@Param('id') id: string, @Res({ passthrough: false }) res: Response) {
    const asset = await this.mediaAssets.resolveFileStream(id);
    if (!asset) {
      throw new BadRequestException('MediaAsset sin archivo local disponible');
    }
    const { localPath, mimeType, name } = asset;
    const stat = statSync(localPath);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    const fileStream = createReadStream(localPath);
    fileStream.pipe(res);
    return new Promise<void>(() => undefined);
  }
}
