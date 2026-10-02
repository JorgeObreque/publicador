import { Module } from '@nestjs/common';
import { BusinessContextModule } from '../../shared/business-context/business-context.module';
import { PerformanceController } from './performance.controller';
import { PerformanceService } from './performance.service';

@Module({
  imports: [BusinessContextModule],
  controllers: [PerformanceController],
  providers: [PerformanceService],
  exports: [PerformanceService],
})
export class PerformanceModule {}
