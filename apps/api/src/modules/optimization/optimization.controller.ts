import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { OptimizationService } from './optimization.service';
import { createRecommendationSchema } from './dto/recommendation.dto';

@Controller('optimization')
export class OptimizationController {
  constructor(private readonly optimization: OptimizationService) {}

  @Get()
  list(@Query('status') status?: RecommendationStatus) {
    return this.optimization.list(status);
  }

  @Post()
  create(@Body() body: ReturnType<typeof createRecommendationSchema.parse>) {
    return this.optimization.create(createRecommendationSchema.parse(body));
  }

  @Patch(':id/accept')
  accept(@Param('id') id: string) {
    return this.optimization.accept(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() body: { rationale?: string }) {
    return this.optimization.reject(id, body?.rationale);
  }
}
