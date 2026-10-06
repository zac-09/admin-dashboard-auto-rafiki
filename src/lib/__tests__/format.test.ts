import { formatUgx } from '../format';

describe('formatUgx', () => {
  it('formats whole shillings with a thousands separator', () => {
    expect(formatUgx(35000)).toBe('UGX 35,000');
    expect(formatUgx(1_250_000)).toBe('UGX 1,250,000');
    expect(formatUgx(0)).toBe('UGX 0');
  });
});

describe('dates', () => {
  it('formats in Kampala time (UTC+3)', async () => {
    const { formatDateTime, formatDate } = await import('../format');
    expect(formatDateTime('2026-10-06T21:30:00.000Z')).toBe('7 Oct 2026, 00:30');
    expect(formatDate('2026-10-06T21:30:00.000Z')).toBe('7 Oct 2026');
  });

  it('counts whole days since a date', async () => {
    const { daysSince } = await import('../format');
    const now = new Date('2026-10-06T09:00:00.000Z');
    expect(daysSince('2026-10-04T10:00:00.000Z', now)).toBe(1);
    expect(daysSince('2026-10-07T10:00:00.000Z', now)).toBe(0);
  });
});
