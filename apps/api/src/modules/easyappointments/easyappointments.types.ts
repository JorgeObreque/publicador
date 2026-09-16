export interface EasyAppointmentsAppointment {
  id: number;
  book: string;
  start: string;
  end: string;
  serviceId: number;
  providerId: number;
  customerId: number;
  status: string;
  notes: string;
}

export interface EasyAppointmentsService {
  id: number;
  name: string;
  duration: number;
  price: number;
  currency: string;
}

export interface EasyAppointmentsClient {
  fetchAppointments(from: Date, to: Date): Promise<EasyAppointmentsAppointment[]>;
  fetchServices(): Promise<EasyAppointmentsService[]>;
}
