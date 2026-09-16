import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { EasyAppointmentsService } from './easyappointments.service';

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const depositSchema = z.object({ amount: z.number().nonnegative().optional() });

const outcomeSchema = z.object({
  outcome: z.enum(['ATTENDED', 'CANCELLED', 'NO_SHOW']),
  finalRevenue: z.number().nonnegative().optional(),
});

@Controller('easyappointments')
export class EasyAppointmentsController {
  constructor(private readonly service: EasyAppointmentsService) {}

  @Post('sync')
  sync(@Body() body: z.infer<typeof rangeSchema>) {
    const parsed = rangeSchema.parse(body);
    return this.service.syncAppointments(parsed.from, parsed.to);
  }

  @Get('pending')
  pending() {
    return this.service.listPending();
  }

  @Post(':externalAppointmentId/deposit')
  confirmDeposit(
    @Param('externalAppointmentId') id: string,
    @Body() body: z.infer<typeof depositSchema>,
  ) {
    const parsed = depositSchema.parse(body ?? {});
    return this.service.confirmDeposit(id, parsed.amount);
  }

  @Post(':externalAppointmentId/outcome')
  outcome(
    @Param('externalAppointmentId') id: string,
    @Body() body: z.infer<typeof outcomeSchema>,
  ) {
    const parsed = outcomeSchema.parse(body);
    return this.service.recordOutcome(id, parsed.outcome, parsed.finalRevenue);
  }
}
