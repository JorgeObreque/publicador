import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EasyAppointmentsService } from '../modules/easyappointments/easyappointments.service';

@Injectable()
export class EasyAppointmentsSyncJob {
  private readonly logger = new Logger(EasyAppointmentsSyncJob.name);

  constructor(private readonly easyAppointments: EasyAppointmentsService) {}

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'easyappointments-sync' })
  async run() {
    const to = new Date();
    const from = new Date(to.getTime() - 72 * 60 * 60 * 1000);
    try {
      const result = await this.easyAppointments.syncAppointments(from, to);
      this.logger.log(`Sincronizadas ${result.processed} citas de EasyAppointments`);
    } catch (err) {
      this.logger.error('Fallo sincronizando EasyAppointments', err as Error);
    }
  }
}
