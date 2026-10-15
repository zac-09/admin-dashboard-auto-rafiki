import { JOBS, MECHANICS } from '@/lib/mocks/contractFixtures';
import type { AvailabilityRecord, Job } from '@/types';

import { supply } from '../supply';

const okello = 'u_mech_okello';
const ev = (
  event: AvailabilityRecord['event'],
  at: string,
  mechanicId = okello,
): AvailabilityRecord => ({
  mechanicId,
  event,
  at,
  ...(event === 'offline' ? {} : { location: { latitude: 0.33, longitude: 32.59 } }),
});
const request = (id: string, at: string, base = 'job_cancelled_system'): Job => {
  const j = structuredClone(JOBS.find((x) => x.id === base)!);
  return { ...j, id, request: { ...j.request, id, createdAt: at } };
};

describe('supply against demand', () => {
  // Two full weeks of log: Monday 5 Oct 00:00 Kampala to Monday 19 Oct 00:00 Kampala.
  const from = '2026-10-04T21:00:00Z';
  const now = new Date('2026-10-18T21:00:00Z');

  it('averages mechanics online per weekday-hour over the weeks logged', () => {
    const s = supply(
      [
        ev('offline', from, 'u_mech_namukasa'), // starts the log
        // Okello: Monday 08:00–10:30 in week one only.
        ev('online', '2026-10-05T05:00:00Z'),
        ev('offline', '2026-10-05T07:30:00Z'),
      ],
      MECHANICS,
      [],
      now,
    );
    // Monday 08:00: online the whole hour in one of two weeks.
    expect(s.grid![0]![8]!.online).toBeCloseTo(0.5);
    expect(s.grid![0]![10]!.online).toBeCloseTo(0.25);
    expect(s.grid![1]![8]!.online).toBe(0);
  });

  it('a pending applicant online never counts as supply', () => {
    const s = supply(
      [
        ev('online', '2026-10-05T05:00:00Z', 'u_mech_kato'),
        ev('offline', '2026-10-05T06:00:00Z', 'u_mech_kato'),
      ],
      MECHANICS,
      [],
      now,
    );
    expect(s.grid!.flat().every((c) => c.online === 0)).toBe(true);
  });

  it('lists hours with requests but nobody online, busiest first, over the same span', () => {
    const s = supply(
      [ev('offline', from, 'u_mech_namukasa')],
      MECHANICS,
      [
        request('a', '2026-10-09T15:10:00Z'), // Fri 18:10
        request('b', '2026-10-16T15:20:00Z'), // Fri 18:20 the next week
        request('c', '2026-10-06T05:00:00Z'), // Tue 08:00
        request('before', '2026-09-28T15:00:00Z'), // before the log: not compared
      ],
      now,
    );
    expect(s.uncovered.map((c) => [c.day, c.hour, c.requestsPerWeek])).toEqual([
      [4, 18, 1],
      [1, 8, 0.5],
    ]);
  });

  it('no log yet: nothing to compare', () => {
    expect(supply([], MECHANICS, [], now)).toMatchObject({ grid: null, from: null, uncovered: [] });
  });
});
