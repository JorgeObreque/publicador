import { Module } from '@nestjs/common';
import { EasyAppointmentsController } from './easyappointments.controller';
import { EasyAppointmentsService } from './easyappointments.service';
import { FixtureEasyAppointmentsClient } from './fixture-easyappointments.client';

@Module({
  controllers: [EasyAppointmentsController],
  providers: [FixtureEasyAppointmentsClient, EasyAppointmentsService],
  exports: [EasyAppointmentsService],
})
export class EasyAppointmentsModule {}
