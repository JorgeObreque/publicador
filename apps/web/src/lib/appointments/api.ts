import { apiFetch } from '../api';

export type AppointmentOutcome = 'ATTENDED' | 'CANCELLED' | 'NO_SHOW' | 'PENDING' | 'DEPOSIT_CONFIRMED';

export interface PendingAppointment {
  id: string;
  externalAppointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  appointmentStatus: string;
  notesRaw: string | null;
  attributionCode: string | null;
  campaignId: string | null;
  creativeId: string | null;
  campaignCreativeId: string | null;
  depositConfirmed: boolean;
  depositAmount: string | null;
  outcome: AppointmentOutcome | null;
  finalRevenue: string | null;
}

export interface SyncAppointmentsResult {
  processed: number;
}

const sanitize = (raw: unknown): PendingAppointment => {
  const appointment = raw as PendingAppointment;
  return {
    ...appointment,
    externalAppointmentId: String(appointment.externalAppointmentId),
  };
};

export const listPendingAppointments = async (): Promise<PendingAppointment[]> => {
  const data = await apiFetch<PendingAppointment[]>(
    '/easyappointments/pending',
    undefined,
    { cache: 'no-store' },
  );
  return data.map(sanitize);
};

export const syncAppointments = (from: string, to: string) =>
  apiFetch<SyncAppointmentsResult>('/easyappointments/sync', {
    method: 'POST',
    body: JSON.stringify({ from, to }),
  });

export interface ConfirmDepositInput {
  amount?: number;
}

export const confirmDeposit = (externalAppointmentId: string, input: ConfirmDepositInput = {}) =>
  apiFetch<PendingAppointment>(
    `/easyappointments/${externalAppointmentId}/deposit`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then(sanitize);

export interface RecordOutcomeInput {
  outcome: 'ATTENDED' | 'CANCELLED' | 'NO_SHOW';
  finalRevenue?: number;
}

export const recordOutcome = (externalAppointmentId: string, input: RecordOutcomeInput) =>
  apiFetch<PendingAppointment>(
    `/easyappointments/${externalAppointmentId}/outcome`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  ).then(sanitize);
