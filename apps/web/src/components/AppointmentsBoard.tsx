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
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
        {items.map((item) => {
          const tone = outcomeTone(item.outcome);
          const badgeKey = tone === 'paused' ? 'PUBLISHED_PAUSED' : tone === 'error' ? 'PUBLISH_ERROR' : 'PUBLISHING';
          const badgeLabel = outcomeLabel(item.outcome);
          return (
            <li
              key={item.id}
              style={{
                padding: '1rem',
                border: '1px solid #e4e7eb',
                borderRadius: '12px',
                background: '#ffffff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600 }}>{formatAppointmentDateTime(item.scheduledStart)}</p>
                  <p style={{ margin: '0.25rem 0 0', color: '#52606d', fontSize: '0.85rem' }}>
                    Estado EasyAppointments: {item.appointmentStatus}
                  </p>
                </div>
                <StatusBadge status={{ key: badgeKey, label: badgeLabel, description: badgeLabel, tone }} />
              </div>
              <p style={{ margin: '0.5rem 0 0', color: '#3e4c59' }}>
                Código de atribución: {item.attributionCode ? <code>{item.attributionCode}</code> : 'sin atribución'}
              </p>
              {item.depositAmount && (
                <p style={{ margin: '0.25rem 0 0', color: '#3e4c59' }}>
                  Depósito: {formatAmount(item.depositAmount)}
                </p>
              )}
              {item.finalRevenue && (
                <p style={{ margin: '0.25rem 0 0', color: '#3e4c59' }}>
                  Ingreso final: {formatAmount(item.finalRevenue)}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const primaryButtonStyle = {
  padding: '0.5rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  padding: '0.5rem 0.85rem',
  borderRadius: '8px',
  border: '1px solid #cbd2d9',
  background: '#ffffff',
  color: '#1f2933',
  cursor: 'pointer',
  fontSize: '0.9rem',
} as const;

const errorStyle = {
  color: '#991b1b',
  background: '#fee2e2',
  padding: '0.75rem',
  borderRadius: '8px',
} as const;
