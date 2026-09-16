import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { ConversionStatus } from '@prisma/client';
import { ConversionsService } from './conversions.service';

const createSchema = z.object({
  campaignId: z.string().optional(),
  creativeId: z.string().optional(),
  serviceId: z.string().optional(),
  attributionCode: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  contactRef: z.string().optional(),
  notes: z.string().optional(),
});

@Controller('conversions')
export class ConversionsController {
  constructor(private readonly conversions: ConversionsService) {}

  @Get()
  list(@Query('campaignId') campaignId?: string, @Query('status') status?: ConversionStatus) {
    return this.conversions.list({ campaignId, status });
  }

  @Post()
  create(@Body() body: z.infer<typeof createSchema>) {
    return this.conversions.createManual(createSchema.parse(body));
  }
}
