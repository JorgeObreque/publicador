const FORMATTER = new Intl.DateTimeFormat('es-CL', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Santiago',
});

const CURRENCY = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' });

export const formatAppointmentDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return FORMATTER.format(date);
};

export const formatAmount = (value: string | null): string => {
  if (!value) return '—';
  const parsed = Number(value);
  return Number.isFinite(parsed) ? CURRENCY.format(parsed) : '—';
};

export const outcomeLabel = (outcome: string | null): string => {
  switch (outcome) {
    case 'ATTENDED':
      return 'Asistió';
    case 'CANCELLED':
      return 'Cancelada';
    case 'NO_SHOW':
      return 'No se presentó';
    case 'DEPOSIT_CONFIRMED':
      return 'Depósito confirmado';
    case 'PENDING':
      return 'Pendiente';
    default:
      return 'Sin resultado';
  }
};

export const outcomeTone = (
  outcome: string | null,
): 'neutral' | 'pending' | 'paused' | 'archived' | 'error' => {
  if (outcome === 'ATTENDED' || outcome === 'DEPOSIT_CONFIRMED') return 'paused';
  if (outcome === 'CANCELLED' || outcome === 'NO_SHOW') return 'error';
  return 'pending';
};
