import { Module } from '@nestjs/common';
import { EasyAppointmentsModule } from '../modules/easyappointments/easyappointments.module';
import { EasyAppointmentsSyncJob } from './easyappointments-sync.job';

@Module({
  imports: [EasyAppointmentsModule],
  providers: [EasyAppointmentsSyncJob],
})
export class JobsModule {}
