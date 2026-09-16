import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Get('ready')
  async ready() {
    const report = await this.health.check();
    if (report.status !== 'ok') {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
