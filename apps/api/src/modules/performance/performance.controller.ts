import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { z } from 'zod';
import { PerformanceService } from './performance.service';

const civilDay = (field: string) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, `${field} debe usar YYYY-MM-DD`)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    }, { message: `${field} no es una fecha válida` });

const rangeQuery = z.object({ from: civilDay('from'), to: civilDay('to') });

@Controller('meta-ads')
export class PerformanceController {
  constructor(private readonly performance: PerformanceService) {}

  @Get('performance')
  summarize(@Query() query: Record<string, string | undefined>) {
    const parsed = rangeQuery.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Parámetros inválidos');
    }
    return this.performance.summarize(parsed.data.from, parsed.data.to);
  }

  @Get('campaigns/remote/:metaCampaignId/performance')
  campaignPerformance(
    @Param('metaCampaignId') metaCampaignId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const parsed = rangeQuery.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Parámetros inválidos');
    }
    return this.performance.campaignPerformance(metaCampaignId, parsed.data.from, parsed.data.to);
  }
}
