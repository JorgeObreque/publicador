import { render, screen } from '@testing-library/react';
import { AppointmentsBoard } from './AppointmentsBoard';
import type { PendingAppointment } from '@/lib/appointments/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock('@/lib/appointments/api', () => ({
  syncAppointments: jest.fn(),
  confirmDeposit: jest.fn(),
  recordOutcome: jest.fn(),
}));

const sample: PendingAppointment = {
  id: 'appt-1',
  externalAppointmentId: 'ea-1',
  scheduledStart: '2026-10-01T14:00:00.000Z',
  scheduledEnd: '2026-10-01T15:00:00.000Z',
  appointmentStatus: 'booked',
  notesRaw: null,
  attributionCode: 'ABC123',
  campaignId: 'cmp-1',
  creativeId: null,
  campaignCreativeId: null,
  depositConfirmed: false,
  depositAmount: null,
  outcome: 'PENDING',
  finalRevenue: null,
};

describe('AppointmentsBoard', () => {
  it('muestra la tabla con encabezados traducidos', () => {
    render(<AppointmentsBoard initialAppointments={[sample]} />);
    expect(screen.getByRole('columnheader', { name: /fecha y hora/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /estado easyappointments/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /resultado/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /atribuida/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /depósito/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /ingreso final/i })).toBeInTheDocument();
  });

  it('traduce los estados crudos de EasyAppointments al español', () => {
    render(
      <AppointmentsBoard
        initialAppointments={[
          { ...sample, appointmentStatus: 'booked' },
          { ...sample, id: 'appt-2', appointmentStatus: 'Attended' },
          { ...sample, id: 'appt-3', appointmentStatus: 'No Show' },
          { ...sample, id: 'appt-4', appointmentStatus: 'Cancelled' },
        ]}
      />,
    );
    const cells = screen.getAllByRole('cell');
    const translated = cells.map((cell) => cell.textContent);
    expect(translated).toEqual(expect.arrayContaining(['Reservada', 'Asistió', 'No se presentó', 'Cancelada']));
  });

  it('muestra Sí/No en la columna Atribuida según el código', () => {
    render(
      <AppointmentsBoard
        initialAppointments={[
          { ...sample, attributionCode: 'XYZ' },
          { ...sample, id: 'appt-2', attributionCode: null },
        ]}
      />,
    );
    expect(screen.getByText('Sí')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });
});