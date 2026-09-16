import { Body, Controller, Get, Post } from '@nestjs/common';
import { DecisionLogService } from './decision-log.service';
import { decisionSchema } from './dto/decision.dto';

@Controller('decision-log')
export class DecisionLogController {
  constructor(private readonly decisionLog: DecisionLogService) {}

  @Get()
  list() {
    return this.decisionLog.list();
  }

  @Post()
  record(@Body() body: ReturnType<typeof decisionSchema.parse>) {
    return this.decisionLog.record(decisionSchema.parse(body));
  }
}
