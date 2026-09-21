import { formatDateInTimeZone, localDateTimeToUtc } from './timezone';

describe('timezone helpers', () => {
  it('interprets an EasyAppointments value in the business timezone', () => {
    expect(localDateTimeToUtc('2026-09-12 12:00:00', 'America/Santiago').toISOString()).toBe(
      '2026-09-12T15:00:00.000Z',
    );
  });

  it('formats an instant as the Meta account civil day', () => {
    expect(formatDateInTimeZone(new Date('2026-09-12T02:00:00Z'), 'Pacific/Easter')).toBe(
      '2026-09-11',
    );
  });

  it('rejects a repeated local time during a DST transition', () => {
    expect(() => localDateTimeToUtc('2026-04-04 23:30:00', 'America/Santiago')).toThrow(
      /ambigua/,
    );
  });
});
