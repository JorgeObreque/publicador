import { Body, Controller, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { MetaAdsService } from './meta-ads.service';

const civilDay = (field: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${field} debe usar YYYY-MM-DD`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, { message: `${field} no es una fecha válida` });

const importRangeSchema = z.object({ from: civilDay('from'), to: civilDay('to') });

@Controller('meta-ads')
export class MetaAdsController {
  constructor(private readonly metaAds: MetaAdsService) {}

  @Post('campaigns/:id/publish-paused')
  publishPaused(@Param('id') id: string) {
    return this.metaAds.publishPaused(id);
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
