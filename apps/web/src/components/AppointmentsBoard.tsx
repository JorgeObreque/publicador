'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  confirmDeposit,
  recordOutcome,
  syncAppointments,
} from '@/lib/appointments/api';
import type { PendingAppointment } from '@/lib/appointments/api';
import { formatAmount, formatAppointmentDateTime, outcomeLabel, outcomeTone } from '@/lib/appointments/format';
import { StatusBadge } from '@/components/StatusBadge';

interface Props {
  initialAppointments: PendingAppointment[];
}

const EASY_APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  booked: 'Reservada',
  Attended: 'Asistió',
  'No Show': 'No se presentó',
  Cancelled: 'Cancelada',
};

function easyAppointmentLabel(raw: string): string {
  if (!raw) return 'Sin estado';
  return EASY_APPOINTMENT_STATUS_LABEL[raw] ?? raw;
}

export function AppointmentsBoard({ initialAppointments }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<PendingAppointment[]>(initialAppointments);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const replaceItem = (next: PendingAppointment) => {
    setItems((current) =>
      current.map((item) => (item.id === next.id ? next : item)),
    );
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const now = new Date();
      const start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      await syncAppointments(start, now.toISOString());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeposit = async (item: PendingAppointment) => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await confirmDeposit(item.externalAppointmentId, {});
      replaceItem(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const handleOutcome = async (item: PendingAppointment, outcome: 'ATTENDED' | 'CANCELLED' | 'NO_SHOW') => {
    setBusyId(item.id);
    setError(null);
    try {
      const updated = await recordOutcome(item.externalAppointmentId, { outcome });
      replaceItem(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  if (items.length === 0) {
    return (
      <section style={{ display: 'grid', gap: '0.75rem' }}>
        <p style={{ color: '#52606d' }}>No hay citas pendientes con atribución. Sincroniza EasyAppointments para revisar.</p>
        <button type="button" onClick={handleSync} disabled={syncing} style={primaryButtonStyle}>
          {syncing ? 'Sincronizando…' : 'Sincronizar EasyAppointments'}
        </button>
      </section>
    );
  }

  return (
    <section style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={handleSync} disabled={syncing} style={primaryButtonStyle}>
          {syncing ? 'Sincronizando…' : 'Sincronizar EasyAppointments'}
        </button>
      </div>
      {error && <p style={errorStyle}>{error}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            background: '#ffffff',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid #e4e7eb',
            fontSize: '0.85rem',
          }}
        >
          <thead>
            <tr style={{ background: '#f0f4f8', textAlign: 'left' }}>
              <th style={th()}>Fecha y hora</th>
              <th style={th()}>Estado EasyAppointments</th>
              <th style={th()}>Resultado</th>
              <th style={th()}>Atribuida</th>
              <th style={th()}>Depósito</th>
              <th style={th()}>Ingreso final</th>
              <th style={th()}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const tone = outcomeTone(item.outcome);
              const badgeKey = tone === 'paused' ? 'PUBLISHED_PAUSED' : tone === 'error' ? 'PUBLISH_ERROR' : 'PUBLISHING';
              const badgeLabel = outcomeLabel(item.outcome);
              const attributed = item.attributionCode ? 'Sí' : 'No';
              return (
                <tr key={item.id} data-testid={`appointment-row-${item.id}`} style={{ borderTop: '1px solid #e4e7eb' }}>
                  <td style={td()}>
                    <strong>{formatAppointmentDateTime(item.scheduledStart)}</strong>
                  </td>
                  <td style={td()}>{easyAppointmentLabel(item.appointmentStatus)}</td>
                  <td style={td()}>
                    <StatusBadge status={{ key: badgeKey, label: badgeLabel, description: badgeLabel, tone }} />
                  </td>
                  <td style={td()}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '999px',
                        background: attributed === 'Sí' ? '#dcfce7' : '#e5e7eb',
                        color: attributed === 'Sí' ? '#166534' : '#374151',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {attributed}
                    </span>
                    {item.attributionCode ? (
                      <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.75rem' }}>
                        Código: <code>{item.attributionCode}</code>
                      </p>
                    ) : (
                      <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.75rem' }}>
                        sin atribución
                      </p>
                    )}
                  </td>
                  <td style={td()}>
                    {item.depositAmount ? formatAmount(item.depositAmount) : '—'}
                  </td>
                  <td style={td()}>
                    {item.finalRevenue ? formatAmount(item.finalRevenue) : '—'}
                  </td>
                  <td style={td()}>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => handleDeposit(item)}
                        disabled={item.depositConfirmed || busyId === item.id}
                        style={{
                          ...secondaryButtonStyle,
                          opacity: item.depositConfirmed || busyId === item.id ? 0.5 : 1,
                        }}
                      >
                        Confirmar depósito
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcome(item, 'ATTENDED')}
                        disabled={busyId === item.id}
                        style={{ ...secondaryButtonStyle, opacity: busyId === item.id ? 0.5 : 1 }}
                      >
                        Asistió
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcome(item, 'CANCELLED')}
                        disabled={busyId === item.id}
                        style={{ ...secondaryButtonStyle, opacity: busyId === item.id ? 0.5 : 1 }}
                      >
                        Cancelada
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOutcome(item, 'NO_SHOW')}
                        disabled={busyId === item.id}
                        style={{ ...secondaryButtonStyle, opacity: busyId === item.id ? 0.5 : 1 }}
                      >
                        No se presentó
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const th = () => ({ padding: '0.6rem 0.75rem', fontWeight: 600, color: '#52606d' });
const td = () => ({ padding: '0.6rem 0.75rem', color: '#1f2933' });

const primaryButtonStyle = {
  padding: '0.5rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  padding: '0.4rem 0.65rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  cursor: 'pointer',
  fontSize: '0.8rem',
} as const;

const errorStyle = {
  color: '#991b1b',
  background: '#fee2e2',
  padding: '0.75rem',
  borderRadius: '8px',
} as const;