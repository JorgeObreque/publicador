import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('campaigns/:id')
  summarize(@Param('id') id: string) {
    return this.analytics.summarize(id);
  }

  @Get('experiments/:id')
  compareVariants(@Param('id') id: string) {
    return this.analytics.compareVariants(id);
  }
}
