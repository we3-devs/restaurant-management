const DAY_MS = 24 * 60 * 60_000;

export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Kathmandu';

function normalizeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format();
    return timeZone;
  } catch {
    return DEFAULT_BUSINESS_TIMEZONE;
  }
}

function zonedParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}

/** Converts a local business date to the corresponding instant without assuming the server timezone. */
export function startOfBusinessDate(dateOnly: string, timeZone = DEFAULT_BUSINESS_TIMEZONE): Date {
  timeZone = normalizeTimeZone(timeZone);
  const [year, month, day] = dateOnly.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  const represented = zonedParts(new Date(utcGuess), timeZone);
  const representedAsUtc = Date.UTC(represented.year, represented.month - 1, represented.day,
    represented.hour, represented.minute, represented.second, 0);
  const offset = representedAsUtc - utcGuess;
  return new Date(utcGuess - offset);
}

function addBusinessDays(dateOnly: string, days: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export function businessDateRange(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  timeZone = DEFAULT_BUSINESS_TIMEZONE,
  now = new Date(),
): { from: Date; to: Date } {
  timeZone = normalizeTimeZone(timeZone);
  const todayParts = zonedParts(now, timeZone);
  const todayOnly = `${todayParts.year}-${String(todayParts.month).padStart(2, '0')}-${String(todayParts.day).padStart(2, '0')}`;
  const effectiveTo = dateTo ? startOfBusinessDate(addBusinessDays(dateTo, 1), timeZone) : now;
  const effectiveFrom = dateFrom
    ? startOfBusinessDate(dateFrom, timeZone)
    : dateTo
      ? startOfBusinessDate(addBusinessDays(dateTo, -29), timeZone)
      : startOfBusinessDate(addBusinessDays(todayOnly, -29), timeZone);
  return { from: effectiveFrom, to: effectiveTo.getTime() === now.getTime() ? now : new Date(effectiveTo.getTime() - 1) };
}
