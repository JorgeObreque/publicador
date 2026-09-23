import 'reflect-metadata';
import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MediaAssetService } from './media-asset.service';

@Controller('media-assets')
export class MediaAssetController {
  constructor(private readonly mediaAssets: MediaAssetService) {}

  @Post('drive/sync')
  syncFromGoogleDrive() {
    return this.mediaAssets.syncFromGoogleDrive();
  }

  @Get()
  list() {
    return this.mediaAssets.listAssets();
  }

  @Get('images')
  listImages() {
    return this.mediaAssets.listImages();
  }

  @Get(':id/thumbnail')
  async thumbnail(@Param('id') id: string, @Res({ passthrough: false }) res: Response) {
    const asset = await this.mediaAssets.fetchThumbnailStream(id);
    if (!asset) {
      res.status(404).json({ message: 'MediaAsset no encontrado' });
      return;
    }
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Length', asset.buffer.byteLength);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Disposition', `inline; filename="${asset.name}"`);
    res.status(200).end(asset.buffer);
  }
}
