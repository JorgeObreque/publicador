const dateTimeParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]),
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
};

export function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = dateTimeParts(date, timeZone);
  return [parts.year, parts.month, parts.day]
    .map((value, index) => String(value).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');
}

export function localDateTimeToUtc(value: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Fecha local inválida: ${value}`);
  const target = match.slice(1).map(Number);
  const targetAsUtc = Date.UTC(
    target[0],
    target[1] - 1,
    target[2],
    target[3],
    target[4],
    target[5],
  );
  let instant = targetAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const shown = dateTimeParts(new Date(instant), timeZone);
    const shownAsUtc = Date.UTC(
      shown.year,
      shown.month - 1,
      shown.day,
      shown.hour,
      shown.minute,
      shown.second,
    );
    instant += targetAsUtc - shownAsUtc;
  }
  const result = new Date(instant);
  const shown = dateTimeParts(result, timeZone);
  const resolved = [shown.year, shown.month, shown.day, shown.hour, shown.minute, shown.second];
  if (!resolved.every((part, index) => part === target[index])) {
    throw new Error(`La fecha ${value} no existe en la zona ${timeZone}`);
  }
  for (let minutes = -180; minutes <= 180; minutes += 30) {
    if (minutes === 0) continue;
    const alternative = dateTimeParts(new Date(instant + minutes * 60_000), timeZone);
    const alternativeParts = [
      alternative.year,
      alternative.month,
      alternative.day,
      alternative.hour,
      alternative.minute,
      alternative.second,
    ];
    if (alternativeParts.every((part, index) => part === target[index])) {
      throw new Error(`La fecha ${value} es ambigua en la zona ${timeZone}`);
    }
  }
  return result;
}
