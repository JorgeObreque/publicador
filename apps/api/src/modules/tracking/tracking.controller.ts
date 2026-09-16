import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { trackingEventSchema } from './dto/tracking.dto';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post()
  record(@Body() body: ReturnType<typeof trackingEventSchema.parse>) {
    return this.tracking.record(trackingEventSchema.parse(body));
  }

  @Get()
  list(@Query('limit') limit?: string) {
    return this.tracking.list(limit ? Number(limit) : 100);
  }
}
