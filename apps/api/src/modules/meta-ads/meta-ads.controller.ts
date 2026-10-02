import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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

const syncBudgetSchema = z
  .object({
    strategy: z.enum(['campaign', 'adset', 'detect']).default('detect'),
    dailyBudget: z.number().int().positive().optional(),
  })
  .refine(
    (value) => value.strategy === 'detect' || typeof value.dailyBudget === 'number',
    { message: 'dailyBudget es obligatorio cuando strategy es campaign o adset', path: ['dailyBudget'] },
  );

export type SyncBudgetInput = z.infer<typeof syncBudgetSchema>;

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

  @Post('campaigns/remote/import')
  importRemoteCampaigns(@Body() body: unknown) {
    const parsed = z
      .object({ limit: z.number().int().positive().max(500).optional() })
      .safeParse(body ?? {});
    return this.metaAds.importRemoteCampaigns(parsed.success ? parsed.data : undefined);
  }

  @Get('campaigns/remote')
  listRemoteCampaigns() {
    return this.metaAds.listRemoteCampaigns();
  }

  @Post('metrics/import')
  importMetrics(@Body() body: z.infer<typeof importRangeSchema>) {
    const parsed = importRangeSchema.parse(body);
    return this.metaAds.importMetrics(parsed.from, parsed.to);
  }

  @Post('campaigns/:id/sync-budget-strategy')
  syncBudgetStrategy(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed: SyncBudgetInput = syncBudgetSchema.parse(body ?? {});
    return this.metaAds.syncBudgetStrategy(id, parsed);
  }

  @Get('overview')
  fetchOverview(@Query('limit') limit?: string) {
    const parsed = Number(limit);
    return this.metaAds.fetchOverview(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
  }
}
