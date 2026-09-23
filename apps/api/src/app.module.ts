import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_PREFIX } from './config/app.tokens';
import { BusinessContextModule } from './shared/business-context/business-context.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { CreativesModule } from './modules/creatives/creatives.module';
import { ServicesModule } from './modules/services/services.module';
import { MetaAdsModule } from './modules/meta-ads/meta-ads.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ConversionsModule } from './modules/conversions/conversions.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ExperimentsModule } from './modules/experiments/experiments.module';
import { OptimizationModule } from './modules/optimization/optimization.module';
import { InsightsModule } from './modules/insights/insights.module';
import { DecisionLogModule } from './modules/decision-log/decision-log.module';
import { EasyAppointmentsModule } from './modules/easyappointments/easyappointments.module';
import { GoogleDriveModule } from './modules/google-drive/google-drive.module';
import { MediaAssetModule } from './modules/media-asset/media-asset.module';
import { JobsModule } from './jobs/jobs.module';
import { HealthModule } from './modules/health/health.module';
import { SerializersModule } from './shared/serializers/serializers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    BusinessContextModule,
    CampaignsModule,
    CreativesModule,
    ServicesModule,
    MetaAdsModule,
    TrackingModule,
    ConversionsModule,
    AnalyticsModule,
    ExperimentsModule,
    OptimizationModule,
    InsightsModule,
    DecisionLogModule,
    EasyAppointmentsModule,
    GoogleDriveModule,
    MediaAssetModule,
    JobsModule,
    HealthModule,
    SerializersModule,
  ],
  providers: [
    {
      provide: APP_PREFIX,
      useValue: process.env.API_PREFIX ?? 'api/v1',
    },
  ],
})
export class AppModule {}
