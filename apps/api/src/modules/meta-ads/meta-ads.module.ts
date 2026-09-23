import { Module } from '@nestjs/common';
import { MetaClientFactory } from '../../shared/meta/meta-client.factory';
import { FixtureMetaAdsSource } from './fixture-meta-ads.source';
import { MetaAdsController } from './meta-ads.controller';
import { MetaAdsService } from './meta-ads.service';
import { MediaAssetModule } from '../media-asset/media-asset.module';

@Module({
  imports: [MediaAssetModule],
  controllers: [MetaAdsController],
  providers: [MetaClientFactory, FixtureMetaAdsSource, MetaAdsService],
  exports: [MetaAdsService],
})
export class MetaAdsModule {}
