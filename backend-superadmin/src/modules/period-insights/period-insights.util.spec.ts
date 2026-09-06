import { lastCompletedDay, lastCompletedMonth, lastCompletedWeek } from './period-insights.util';

describe('Period Insights business-timezone windows', () => {
  const now = new Date('2026-08-29T18:00:00.000Z');
  it('uses Kathmandu midnight boundaries', () => {
    const day = lastCompletedDay(now, 'Asia/Kathmandu');
    expect(day.periodStart.toISOString()).toBe('2026-08-27T18:15:00.000Z');
    expect(day.periodEnd.toISOString()).toBe('2026-08-28T18:15:00.000Z');
    expect(lastCompletedWeek(now, 'Asia/Kathmandu').periodEnd.toISOString()).toBe('2026-08-23T18:15:00.000Z');
    expect(lastCompletedMonth(now, 'Asia/Kathmandu').periodEnd.toISOString()).toBe('2026-07-31T18:15:00.000Z');
  });
  it('uses the correct offset on a DST transition day', () => {
    const day = lastCompletedDay(new Date('2026-03-09T16:00:00.000Z'), 'America/New_York');
    expect(day.periodStart.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(day.periodEnd.toISOString()).toBe('2026-03-09T04:00:00.000Z');
  });
});