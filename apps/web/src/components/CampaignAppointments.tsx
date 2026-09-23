import { listPendingAppointments } from '@/lib/appointments/api';
import { formatAppointmentDateTime, outcomeLabel } from '@/lib/appointments/format';

interface Props {
  campaignId: string;
}

export const dynamic = 'force-dynamic';

export async function CampaignAppointments({ campaignId }: Props) {
  let appointments: Awaited<ReturnType<typeof listPendingAppointments>> | null = null;
  let error: string | null = null;
  try {
    appointments = await listPendingAppointments();
  } catch (err) {
    error = (err as Error).message;
  }

  const filtered = (appointments ?? []).filter((item) => item.campaignId === campaignId);

  return (
    <section style={{ display: 'grid', gap: '0.5rem' }}>
      <h3 style={{ margin: 0 }}>Citas atribuidas</h3>
      {error && (
        <p style={{ color: '#991b1b', background: '#fee2e2', padding: '0.75rem', borderRadius: '8px' }}>
          No pudimos cargar las citas: {error}
        </p>
      )}
      {!error && filtered.length === 0 && (
        <p style={{ color: '#52606d' }}>Aún no hay citas atribuidas a esta campaña.</p>
      )}
      {filtered.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#3e4c59' }}>
          {filtered.map((item) => (
            <li key={item.id}>
              {formatAppointmentDateTime(item.scheduledStart)} · {outcomeLabel(item.outcome)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
