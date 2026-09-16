import { Body, Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { MetaAdsService } from './meta-ads.service';

const importRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

@Controller('meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAds: MetaAdsService) {}

  @Post('campaigns/:id/publish-paused')
  publishPaused(@Param('id') id: string) {
    return this.metaAds.createCampaign(id);
  }

  @Post('campaigns/import')
  importCampaigns() {
    return this.metaAds.importCampaigns();
  }

  @Post('metrics/import')
  importMetrics(@Body() body: z.infer<typeof importRangeSchema>) {
    const parsed = importRangeSchema.parse(body);
    return this.metaAds.importMetrics(parsed.from, parsed.to);
  }
}
