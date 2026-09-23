import { listPendingAppointments } from '@/lib/appointments/api';
import { AppointmentsBoard } from '@/components/AppointmentsBoard';

export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  let error: string | null = null;
  let appointments: Awaited<ReturnType<typeof listPendingAppointments>> | null = null;
  try {
    appointments = await listPendingAppointments();
  } catch (err) {
    error = (err as Error).message;
  }

  return (
    <section style={{ display: 'grid', gap: '1.5rem' }}>
      <header>
        <h2 style={{ margin: 0 }}>Citas atribuidas</h2>
        <p style={{ margin: '0.25rem 0 0', color: '#52606d' }}>
          Revisa las citas que llegaron desde campañas y confirma depósito, asistencia o cancelación.
        </p>
      </header>
      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos cargar las citas: {error}
        </p>
      )}
      {appointments && <AppointmentsBoard initialAppointments={appointments} />}
    </section>
  );
}
