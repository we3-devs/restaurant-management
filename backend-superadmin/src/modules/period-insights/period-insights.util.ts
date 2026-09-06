import type { PeriodType } from './entities/period-insight.entity';
import { DEFAULT_BUSINESS_TIMEZONE, startOfBusinessDate } from '../../common/reporting/reporting-date.util';

export interface PeriodWindow {
  periodType: PeriodType;
  periodStart: Date;
  periodEnd: Date;
}

const DAY_MS = 24 * 60 * 60_000;

function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(date);
  return Object.fromEntries(values.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]));
}

function dateOnly(date: Date, timeZone: string): string {
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function monthStart(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

function previousMonthStart(value: string): string {
  return addDays(monthStart(value), -1).slice(0, 7) + '-01';
}

function dayWindow(date: string, periodType: PeriodType, timeZone: string): PeriodWindow {
  const periodStart = startOfBusinessDate(date, timeZone);
  const periodEnd = startOfBusinessDate(addDays(date, 1), timeZone);
  return { periodType, periodStart, periodEnd };
}

export function toDateOnlyString(date: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): string {
  return dateOnly(date, timeZone);
}

export function lastCompletedDay(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow {
  const today = dateOnly(now, timeZone);
  return dayWindow(addDays(today, -1), 'daily', timeZone);
}

export function lastCompletedWeek(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow {
  const today = dateOnly(now, timeZone);
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const thisMonday = addDays(today, -daysSinceMonday);
  const periodStartDate = addDays(thisMonday, -7);
  return { periodType: 'weekly', periodStart: startOfBusinessDate(periodStartDate, timeZone), periodEnd: startOfBusinessDate(thisMonday, timeZone) };
}

export function lastCompletedMonth(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow {
  const current = monthStart(dateOnly(now, timeZone));
  const previous = previousMonthStart(current);
  return { periodType: 'monthly', periodStart: startOfBusinessDate(previous, timeZone), periodEnd: startOfBusinessDate(current, timeZone) };
}

export function periodLabel(window: PeriodWindow, timeZone = DEFAULT_BUSINESS_TIMEZONE): string {
  const { periodType, periodStart, periodEnd } = window;
  const start = dateOnly(periodStart, timeZone);
  const end = dateOnly(new Date(periodEnd.getTime() - 1), timeZone);
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  if (periodType === 'monthly') return `${names[startDate.getUTCMonth()]} ${startDate.getUTCFullYear()}`;
  const short = (d: Date) => `${names[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  if (periodType === 'daily') return short(startDate);
  const startLabel = startDate.getUTCMonth() === endDate.getUTCMonth() ? `${names[startDate.getUTCMonth()].slice(0, 3)} ${startDate.getUTCDate()}` : short(startDate);
  return `${startLabel} – ${short(endDate)}`;
}

export function dayWindows(since: Date, until: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = dateOnly(until, timeZone);
  let cursor = dateOnly(since, timeZone);
  while (addDays(cursor, 1) <= limit) { windows.push(dayWindow(cursor, 'daily', timeZone)); cursor = addDays(cursor, 1); }
  return windows;
}

export function weekWindows(since: Date, until: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = startOfBusinessDate(dateOnly(until, timeZone), timeZone).getTime();
  const initial = dateOnly(since, timeZone);
  const weekday = new Date(`${initial}T12:00:00Z`).getUTCDay();
  let cursor = addDays(initial, -((weekday + 6) % 7));
  while (startOfBusinessDate(addDays(cursor, 7), timeZone).getTime() <= limit) {
    windows.push({ periodType: 'weekly', periodStart: startOfBusinessDate(cursor, timeZone), periodEnd: startOfBusinessDate(addDays(cursor, 7), timeZone) });
    cursor = addDays(cursor, 7);
  }
  return windows;
}

export function monthWindows(since: Date, until: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): PeriodWindow[] {
  const windows: PeriodWindow[] = [];
  const limit = startOfBusinessDate(dateOnly(until, timeZone), timeZone).getTime();
  let cursor = monthStart(dateOnly(since, timeZone));
  while (startOfBusinessDate(addDays(cursor, 31).slice(0, 7) + '-01', timeZone).getTime() <= limit) {
    const next = addDays(cursor, 32).slice(0, 7) + '-01';
    const periodEnd = startOfBusinessDate(next, timeZone);
    if (periodEnd.getTime() > limit) break;
    windows.push({ periodType: 'monthly', periodStart: startOfBusinessDate(cursor, timeZone), periodEnd });
    cursor = next;
  }
  return windows;
}

export function isWeekBoundary(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): boolean {
  const value = dateOnly(now, timeZone);
  return new Date(`${value}T12:00:00Z`).getUTCDay() === 1;
}

export function isMonthBoundary(now: Date, timeZone = DEFAULT_BUSINESS_TIMEZONE): boolean {
  return dateOnly(now, timeZone).endsWith('-01');
}