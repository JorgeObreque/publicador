import { Module } from '@nestjs/common';
import { GoogleDriveModule } from '../google-drive/google-drive.module';
import { MediaAssetController } from './media-asset.controller';
import { MediaAssetService } from './media-asset.service';

@Module({
  imports: [GoogleDriveModule],
  controllers: [MediaAssetController],
  providers: [MediaAssetService],
  exports: [MediaAssetService],
})
export class MediaAssetModule {}