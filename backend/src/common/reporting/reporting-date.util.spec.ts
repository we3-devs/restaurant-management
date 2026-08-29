import { businessDateRange, startOfBusinessDate } from './reporting-date.util';

describe('reporting date boundaries', () => {
  it('converts a Kathmandu calendar day without using the server timezone', () => {
    expect(startOfBusinessDate('2026-08-29', 'Asia/Kathmandu').toISOString()).toBe('2026-08-28T18:15:00.000Z');
  });

  it('returns an inclusive local-day range', () => {
    const range = businessDateRange('2026-08-29', '2026-08-29', 'Asia/Kathmandu');
    expect(range.from.toISOString()).toBe('2026-08-28T18:15:00.000Z');
    expect(range.to.toISOString()).toBe('2026-08-29T18:14:59.999Z');
  });


  it('falls back safely for an invalid timezone', () => {
    expect(startOfBusinessDate('2026-08-29', 'Not/AZone').toISOString()).toBe('2026-08-28T18:15:00.000Z');
  });

  it('handles DST transition boundaries', () => {
    expect(startOfBusinessDate('2026-03-08', 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(startOfBusinessDate('2026-11-01', 'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z');
  });
});
