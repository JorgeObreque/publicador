import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import {
  EasyAppointmentsAppointment,
  EasyAppointmentsClient,
  EasyAppointmentsService,
} from './easyappointments.types';

@Injectable()
export class EasyAppointmentsHttpClient implements EasyAppointmentsClient {
  private readonly http: AxiosInstance;
  private readonly logger = new Logger(EasyAppointmentsHttpClient.name);

  constructor(
    baseURL: string,
    username: string,
    password: string,
  ) {
    if (!baseURL || !username || !password) {
      throw new Error('EasyAppointments requiere baseURL, usuario y contraseña.');
    }
    this.http = axios.create({
      baseURL: `${baseURL.replace(/\/$/, '')}/index.php/api/v1`,
      auth: { username, password },
      timeout: 30000,
    });
  }

  async fetchAppointments(from: Date, to: Date): Promise<EasyAppointmentsAppointment[]> {
    const { data } = await this.http.get<EasyAppointmentsAppointment[]>('/appointments', {
      params: {
        from: from.toISOString().slice(0, 10),
        till: to.toISOString().slice(0, 10),
        sort: '-id',
      },
    });
    return data;
  }

  async fetchServices(): Promise<EasyAppointmentsService[]> {
    const { data } = await this.http.get<EasyAppointmentsService[]>('/services');
    return data;
  }
}
