import { Body, Controller, Get, Post } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { InsightsService } from './insights.service';

const createSchema = z.object({
  experimentId: z.string().optional(),
  category: z.string().min(1),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

@Controller('insights')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get()
  list() {
    return this.insights.list();
  }

  @Post()
  create(@Body() body: z.infer<typeof createSchema>) {
    const parsed = createSchema.parse(body);
    return this.insights.create({
      ...parsed,
      evidence: parsed.evidence as Prisma.JsonObject | undefined,
    });
  }
}
