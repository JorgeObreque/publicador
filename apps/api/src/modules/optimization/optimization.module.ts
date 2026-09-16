import { Module } from '@nestjs/common';
import { DecisionLogModule } from '../decision-log/decision-log.module';
import { OptimizationController } from './optimization.controller';
import { OptimizationService } from './optimization.service';

@Module({
  imports: [DecisionLogModule],
  controllers: [OptimizationController],
  providers: [OptimizationService],
})
export class OptimizationModule {}
