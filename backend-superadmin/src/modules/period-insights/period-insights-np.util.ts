import NepaliDate from 'nepali-date-converter';
import type { PeriodType } from './entities/period-insight-np.entity';

/**
 * `nepali-date-converter`'s AD<->BS conversion is backed by a lookup table
 * of real BS month lengths (`dateConfigMap` in the package) that only
 * covers BS years 2000-2090 (~AD 1943-2033). Outside that range, AD<->BS
 * conversion throws / falls back incorrectly. Not a practical concern
 * today (BS 2090 is AD ~2033), but if this system is still running the
 * rollups near then, the package will need an update or a replacement
 * with a wider table.
 */

export interface PeriodWindowNp {
  periodType: PeriodType;
  /** Inclusive AD instant the period starts at — used to query orders (AD timestamps). */
  periodStartAd: Date;
  /** Exclusive AD instant the period ends at. */
  periodEndAd: Date;
  /** Inclusive BS calendar date the period starts on, 'YYYY-MM-DD'. */
  periodStartBs: string;
  /** Exclusive BS calendar date the period ends on, 'YYYY-MM-DD'. */
  periodEndBs: string;
}

const DAY_MS = 24 * 60 * 60_000;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bsDateOnly(d: NepaliDate): string {
  return `${d.getYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Yesterday's full calendar day — same instant as the AD table's `lastCompletedDay`, just BS-labeled. */
export function lastCompletedDayNp(now: Date): PeriodWindowNp {
  const todayStart = startOfDay(now);
  const periodStartAd = new Date(todayStart.getTime() - DAY_MS);
  const periodEndAd = todayStart;
  return {
    periodType: 'daily',
    periodStartAd,
    periodEndAd,
    periodStartBs: bsDateOnly(NepaliDate.fromAD(periodStartAd)),
    periodEndBs: bsDateOnly(NepaliDate.fromAD(periodEndAd)),
  };
}

/** The most recently completed Sun-Sat week (Nepali convention), relative to `now`. */
export function lastCompletedWeekNp(now: Date): PeriodWindowNp {
  const todayStart = startOfDay(now);
  // getDay(): 0=Sun..6=Sat, so this is already the distance back to this week's Sunday.
  const daysSinceSunday = todayStart.getDay();
  const thisWeekSunday = new Date(
    todayStart.getTime() - daysSinceSunday * DAY_MS,
  );
  const periodStartAd = new Date(thisWeekSunday.getTime() - 7 * DAY_MS);
  const periodEndAd = thisWeekSunday;
  return {
    periodType: 'weekly',
    periodStartAd,
    periodEndAd,
    periodStartBs: bsDateOnly(NepaliDate.fromAD(periodStartAd)),
    periodEndBs: bsDateOnly(NepaliDate.fromAD(periodEndAd)),
  };
}

/** The most recently completed BS calendar month, relative to `now` — a true Baisakh-Chaitra boundary, not an AD one. */
export function lastCompletedMonthNp(now: Date): PeriodWindowNp {
  const todayBs = NepaliDate.fromAD(startOfDay(now));
  const currentMonthStart = new NepaliDate(
    todayBs.getYear(),
    todayBs.getMonth(),
    1,
  );
  const prevMonthStart = new NepaliDate(
    todayBs.getYear(),
    todayBs.getMonth(),
    1,
  );
  prevMonthStart.setMonth(todayBs.getMonth() - 1);
  return {
    periodType: 'monthly',
    periodStartAd: prevMonthStart.toJsDate(),
    periodEndAd: currentMonthStart.toJsDate(),
    periodStartBs: bsDateOnly(prevMonthStart),
    periodEndBs: bsDateOnly(currentMonthStart),
  };
}

/** Every completed daily window from `since` (inclusive) up to `until` (exclusive), oldest first. */
export function dayWindowsNp(since: Date, until: Date): PeriodWindowNp[] {
  const windows: PeriodWindowNp[] = [];
  const limit = startOfDay(until);
  let cursor = startOfDay(since);
  while (cursor.getTime() + DAY_MS <= limit.getTime()) {
    const periodEndAd = new Date(cursor.getTime() + DAY_MS);
    windows.push({
      periodType: 'daily',
      periodStartAd: cursor,
      periodEndAd,
      periodStartBs: bsDateOnly(NepaliDate.fromAD(cursor)),
      periodEndBs: bsDateOnly(NepaliDate.fromAD(periodEndAd)),
    });
    cursor = periodEndAd;
  }
  return windows;
}

/** Every completed Sun-Sat weekly window from `since` up to `until`, oldest first. */
export function weekWindowsNp(since: Date, until: Date): PeriodWindowNp[] {
  const windows: PeriodWindowNp[] = [];
  const limit = startOfDay(until);
  const start = startOfDay(since);
  const daysSinceSunday = start.getDay();
  let cursor = new Date(start.getTime() - daysSinceSunday * DAY_MS);
  while (cursor.getTime() + 7 * DAY_MS <= limit.getTime()) {
    const periodEndAd = new Date(cursor.getTime() + 7 * DAY_MS);
    windows.push({
      periodType: 'weekly',
      periodStartAd: cursor,
      periodEndAd,
      periodStartBs: bsDateOnly(NepaliDate.fromAD(cursor)),
      periodEndBs: bsDateOnly(NepaliDate.fromAD(periodEndAd)),
    });
    cursor = periodEndAd;
  }
  return windows;
}

/** Every completed Baisakh-Chaitra monthly window from `since` up to `until`, oldest first. */
export function monthWindowsNp(since: Date, until: Date): PeriodWindowNp[] {
  const windows: PeriodWindowNp[] = [];
  const limit = startOfDay(until);
  const sinceBs = NepaliDate.fromAD(startOfDay(since));
  let cursor = new NepaliDate(sinceBs.getYear(), sinceBs.getMonth(), 1);
  while (true) {
    const next = new NepaliDate(cursor.getYear(), cursor.getMonth(), 1);
    next.setMonth(cursor.getMonth() + 1);
    const periodEndAd = next.toJsDate();
    if (periodEndAd.getTime() > limit.getTime()) break;
    windows.push({
      periodType: 'monthly',
      periodStartAd: cursor.toJsDate(),
      periodEndAd,
      periodStartBs: bsDateOnly(cursor),
      periodEndBs: bsDateOnly(next),
    });
    cursor = next;
  }
  return windows;
}

function shortBs(d: NepaliDate): string {
  return d.format('MMMM D, YYYY');
}

/** Human-readable BS label for a period window, e.g. "Bhadra 5, 2083", "Ashad 30 – Shrawan 6, 2083", "Bhadra 2083". */
export function periodLabelNp(window: PeriodWindowNp): string {
  const { periodType, periodStartAd, periodEndAd } = window;
  const startBs = NepaliDate.fromAD(periodStartAd);

  if (periodType === 'daily') return shortBs(startBs);

  if (periodType === 'monthly') {
    return `${startBs.format('MMMM')} ${startBs.getYear()}`;
  }

  // weekly: periodEndAd is exclusive (start of next week), so the last day
  // shown is periodEndAd - 1 day.
  const lastDayBs = NepaliDate.fromAD(new Date(periodEndAd.getTime() - DAY_MS));
  const sameMonth =
    startBs.getMonth() === lastDayBs.getMonth() &&
    startBs.getYear() === lastDayBs.getYear();
  const startLabel = sameMonth
    ? `${startBs.format('MMMM')} ${startBs.getDate()}`
    : shortBs(startBs);
  return `${startLabel} – ${shortBs(lastDayBs)}`;
}
