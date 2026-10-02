import { BadRequestException, Body, Controller, Param, Post, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import { AnalyzeService } from './analyze.service';

const analyzeBodySchema = z
  .object({
    periodDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional(),
  })
  .strict();

export type AnalyzeBody = z.infer<typeof analyzeBodySchema>;

@Controller('meta-ads/campaigns/remote')
export class AnalyzeController {
  constructor(private readonly analyzeService: AnalyzeService) {}

  @Post(':metaCampaignId/analyze')
  analyze(
    @Param('metaCampaignId') metaCampaignId: string,
    @Body() body: Record<string, unknown> | undefined,
  ) {
    if (!metaCampaignId || metaCampaignId.trim().length === 0) {
      throw new BadRequestException('metaCampaignId es obligatorio');
    }
    const parsed = analyzeBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues[0]?.message ?? 'Body inválido');
    }
    if (!this.analyzeService.isConfigured()) {
      throw new ServiceUnavailableException('Falta OPENAI_API_KEY');
    }
    return this.analyzeService.analyzeCampaign(metaCampaignId, parsed.data.periodDays ?? 30);
  }
}
