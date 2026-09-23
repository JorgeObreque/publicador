import { formatAmount, formatAppointmentDateTime, outcomeLabel, outcomeTone } from './format';
import type { AppointmentOutcome } from './api';

describe('appointment formatters', () => {
  it('formatea fecha en horario de Chile', () => {
    expect(formatAppointmentDateTime('2026-09-12T15:00:00.000Z')).toMatch(/2026/);
  });

  it('formatea montos en CLP', () => {
    expect(formatAmount('12000')).toContain('12');
    expect(formatAmount(null)).toBe('—');
  });

  it('traduce outcome a lenguaje humano', () => {
    expect(outcomeLabel('ATTENDED' as AppointmentOutcome)).toBe('Asistió');
    expect(outcomeLabel('CANCELLED' as AppointmentOutcome)).toBe('Cancelada');
    expect(outcomeLabel(null)).toBe('Sin resultado');
  });

  it('asigna tono según outcome', () => {
    expect(outcomeTone('ATTENDED' as AppointmentOutcome)).toBe('paused');
    expect(outcomeTone('CANCELLED' as AppointmentOutcome)).toBe('error');
    expect(outcomeTone(null)).toBe('pending');
  });
});
