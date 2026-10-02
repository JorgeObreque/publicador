import { humanizeMetaStatus, statusBadgeFromMetaStatus } from './meta-status';

describe('humanizeMetaStatus', () => {
  it('traduce ACTIVE a "Activa" con tono ok', () => {
    expect(humanizeMetaStatus('ACTIVE')).toMatchObject({ label: 'Activa', tone: 'ok' });
  });

  it('traduce PAUSED a "Pausada en Meta"', () => {
    expect(humanizeMetaStatus('PAUSED')).toMatchObject({ label: 'Pausada en Meta', tone: 'warn' });
  });

  it('traduce IN_PROCESS a "Enviando a Meta"', () => {
    expect(humanizeMetaStatus('IN_PROCESS')).toMatchObject({ label: 'Enviando a Meta', tone: 'warn' });
  });

  it('traduce WITH_ISSUES a "Con problemas en Meta"', () => {
    expect(humanizeMetaStatus('WITH_ISSUES')).toMatchObject({ label: 'Con problemas en Meta' });
  });

  it('traduce DELETED a "Eliminada de Meta"', () => {
    expect(humanizeMetaStatus('DELETED')).toMatchObject({ label: 'Eliminada de Meta', tone: 'error' });
  });

  it('traduce ARCHIVED a "Archivada"', () => {
    expect(humanizeMetaStatus('ARCHIVED')).toMatchObject({ label: 'Archivada', tone: 'neutral' });
  });

  it('traduce PENDING_REVIEW a "Esperando revisión de Meta"', () => {
    expect(humanizeMetaStatus('PENDING_REVIEW')).toMatchObject({ label: 'Esperando revisión de Meta' });
  });

  it('usa la traducción de effectiveStatus cuando está disponible', () => {
    const view = humanizeMetaStatus('UNKNOWN', 'PAUSED');
    expect(view.label).toBe('Pausada en Meta');
  });

  it('devuelve "Estado desconocido en Meta" cuando el estado no aparece en el mapa', () => {
    const view = humanizeMetaStatus('FOOBAR');
    expect(view.label).toBe('Estado desconocido en Meta (FOOBAR)');
    expect(view.tone).toBe('neutral');
  });

  it('expone statusBadgeFromMetaStatus como alias directo', () => {
    expect(statusBadgeFromMetaStatus('ACTIVE').label).toBe('Activa');
  });
});