import type { PeriodType } from './entities/period-insight.entity';

export interface PeriodWindow {
  periodType: PeriodType;
  /** Inclusive start of the period, local calendar date. */
  periodStart: Date;
  /** Exclusive end of the period (start of the next period). */
  periodEnd: Date;
}

const DAY_MS = 24 * 60 * 60_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toDateOnlyString(date: Date): string {
  return toDateOnly(date);
}

/** Yesterday's full calendar day, relative to `now`. */
export function lastCompletedDay(now: Date): PeriodWindow {
  const todayStart = startOfDay(now);
  const periodStart = new Date(todayStart.getTime() - DAY_MS);
  return { periodType: 'daily', periodStart, periodEnd: todayStart };
}

/** The most recently completed Mon-Sun week, relative to `now`. */
export function lastCompletedWeek(now: Date): PeriodWindow {
  const todayStart = startOfDay(now);
  // getDay(): 0=Sun..6=Sat. Distance back to this week's Monday.
  const dayOfWeek = todayStart.getDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const thisWeekMonday = new Date(
    todayStart.getTime() - daysSinceMonday * DAY_MS,
  );
  const periodStart = new Date(thisWeekMonday.getTime() - 7 * DAY_MS);
  const periodEnd = thisWeekMonday;
  return { periodType: 'weekly', periodStart, periodEnd };
}

/** The most recently completed calendar month, relative to `now`. */
export function lastCompletedMonth(now: Date): PeriodWindow {
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodStart = new Date(
    thisMonthStart.getFullYear(),
    thisMonthStart.getMonth() - 1,
    1,
  );
  const periodEnd = thisMonthStart;
  return { periodType: 'monthly', periodStart, periodEnd };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function shortDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Human-readable label for a period window, e.g. "Aug 21, 2026", "Aug 17 – 23, 2026", "August 2026". */
export function periodLabel(window: PeriodWindow): string {
  const { periodType, periodStart, periodEnd } = window;
  if (periodType === 'daily') return shortDate(periodStart);

  if (periodType === 'monthly') {
    return `${MONTH_NAMES[periodStart.getMonth()]} ${periodStart.getFullYear()}`;
  }

  // weekly: periodEnd is exclusive (start of next week), so the last day
  // shown is periodEnd - 1 day.
  const lastDay = new Date(periodEnd.getTime() - DAY_MS);
  const sameMonth = periodStart.getMonth() === lastDay.getMonth();
  const sameYear = periodStart.getFullYear() === lastDay.getFullYear();
  const startLabel = sameMonth
    ? `${MONTH_NAMES[periodStart.getMonth()].slice(0, 3)} ${periodStart.getDate()}`
    : shortDate(periodStart);
  const endLabel = sameYear
    ? `${MONTH_NAMES[lastDay.getMonth()].slice(0, 3)} ${lastDay.getDate()}, ${lastDay.getFullYear()}`
    : shortDate(lastDay);
  return `${startLabel} – ${endLabel}`;
}

/** Every completed daily window from `since` (inclusive) up to `until` (exclusive), oldest first. */
export function dayWindows(since: Date, until: Date): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = startOfDay(until);
  let cursor = startOfDay(since);
  while (cursor.getTime() + DAY_MS <= limit.getTime()) {
    const periodEnd = new Date(cursor.getTime() + DAY_MS);
    windows.push({ periodType: 'daily', periodStart: cursor, periodEnd });
    cursor = periodEnd;
  }
  return windows;
}

/** Every completed Mon-Sun weekly window from `since` up to `until`, oldest first. */
export function weekWindows(since: Date, until: Date): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = startOfDay(until);
  const start = startOfDay(since);
  const daysSinceMonday = (start.getDay() + 6) % 7;
  let cursor = new Date(start.getTime() - daysSinceMonday * DAY_MS);
  while (cursor.getTime() + 7 * DAY_MS <= limit.getTime()) {
    const periodEnd = new Date(cursor.getTime() + 7 * DAY_MS);
    windows.push({ periodType: 'weekly', periodStart: cursor, periodEnd });
    cursor = periodEnd;
  }
  return windows;
}

/** Every completed calendar-month window from `since` up to `until`, oldest first. */
export function monthWindows(since: Date, until: Date): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = startOfDay(until);
  let cursor = new Date(since.getFullYear(), since.getMonth(), 1);
  while (true) {
    const periodEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    if (periodEnd.getTime() > limit.getTime()) break;
    windows.push({ periodType: 'monthly', periodStart: cursor, periodEnd });
    cursor = periodEnd;
  }
  return windows;
}

/** True on the first calendar day of an ISO week (Monday). */
export function isWeekBoundary(now: Date): boolean {
  return now.getDay() === 1;
}

/** True on the first calendar day of a month. */
export function isMonthBoundary(now: Date): boolean {
  return now.getDate() === 1;
}
