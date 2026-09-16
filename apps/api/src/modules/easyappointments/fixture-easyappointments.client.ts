import { Injectable } from '@nestjs/common';
import {
  EasyAppointmentsAppointment,
  EasyAppointmentsClient,
  EasyAppointmentsService,
} from './easyappointments.types';

@Injectable()
export class FixtureEasyAppointmentsClient implements EasyAppointmentsClient {
  private services: EasyAppointmentsService[] = [];
  private appointments: EasyAppointmentsAppointment[] = [];

  load(input: {
    services?: EasyAppointmentsService[];
    appointments?: EasyAppointmentsAppointment[];
  }) {
    this.services = input.services ?? [];
    this.appointments = input.appointments ?? [];
  }

  fetchAppointments(_from: Date, _to: Date): Promise<EasyAppointmentsAppointment[]> {
    return Promise.resolve(this.appointments);
  }

  fetchServices(): Promise<EasyAppointmentsService[]> {
    return Promise.resolve(this.services);
  }
}
