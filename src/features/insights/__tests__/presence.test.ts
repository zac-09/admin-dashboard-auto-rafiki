import { MECHANICS } from '@/lib/mocks/contractFixtures';
import { generateHistory } from '@/lib/mocks/historyFixtures';

import {
  hoursOnline,
  offerStats,
  onlineStretches,
  type AvailabilityRecord,
  type OfferRecord,
} from '../presence';
import { scorecard } from '../scorecard';

const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;
const ev = (
  event: AvailabilityRecord['event'],
  at: string,
  mechanicId = 'm1',
): AvailabilityRecord => ({
  mechanicId,
  event,
  at,
  ...(event === 'offline' ? {} : { location: { latitude: 0.33, longitude: 32.59 } }),
});

describe('online hours', () => {
  const now = new Date('2026-10-14T20:00:00Z');

  it('pairs online with offline; pings neither open nor close; an open stretch runs to now', () => {
    const s = onlineStretches(
      [
        ev('online', '2026-10-14T06:00:00Z'),
        ev('ping', '2026-10-14T07:00:00Z'),
        ev('online', '2026-10-14T07:30:00Z'), // a repeat while online changes nothing
        ev('offline', '2026-10-14T10:00:00Z'),
        ev('offline', '2026-10-14T11:00:00Z'), // a repeat while offline changes nothing
        ev('online', '2026-10-14T18:00:00Z'),
        ev('online', '2026-10-14T12:00:00Z', 'someone-else'),
      ],
      'm1',
      now,
    );
    expect(s.map((x) => [new Date(x.from).toISOString(), new Date(x.to).toISOString()])).toEqual([
      ['2026-10-14T06:00:00.000Z', '2026-10-14T10:00:00.000Z'],
      ['2026-10-14T18:00:00.000Z', '2026-10-14T20:00:00.000Z'],
    ]);
    expect(hoursOnline(s, Date.parse('2026-10-14T08:00:00Z'), now.getTime())).toBe(4);
  });
});

describe('job alerts', () => {
  const offer = (jobId: string, extra: Partial<OfferRecord> = {}): OfferRecord => ({
    jobId,
    mechanicId: 'm1',
    distanceKm: 2,
    ring: { innerKm: 0, outerKm: 5 },
    sentAt: '2026-10-14T08:00:00Z',
    lastSentAt: '2026-10-14T08:00:00Z',
    rounds: 1,
    openedAt: null,
    declinedAt: null,
    ...extra,
  });

  it('taken, passed, taken by another first, or ignored', () => {
    const jobs = new Map([
      ['won', { mechanicId: 'm1' }],
      ['lost', { mechanicId: 'm2' }],
      ['passed', { mechanicId: 'm2' }],
      ['nobody', {}],
    ]);
    const stats = offerStats(
      [
        offer('won', { openedAt: 'x' }),
        offer('lost', { openedAt: 'x' }),
        offer('passed', { openedAt: 'x', declinedAt: 'y' }),
        offer('nobody'),
        offer('won', { mechanicId: 'm2' }),
      ],
      jobs,
      'm1',
    );
    expect(stats).toEqual({
      offers: 4,
      accepted: 1,
      declined: 1,
      takenByOthers: 1,
      ignored: 1,
      opened: 3,
      acceptanceRate: 0.25,
    });
  });
});

describe('scorecard with the app logs', () => {
  it('averages hours over the days logged and flags rarely online and ignored alerts', () => {
    const now = new Date('2026-10-24T12:00:00Z');
    // Ten days of log; Okello was online 2 hours on one day only.
    const availability = [
      ev('online', '2026-10-14T12:00:00Z', 'other'),
      ev('online', '2026-10-20T08:00:00Z', 'u_mech_okello'),
      ev('offline', '2026-10-20T10:00:00Z', 'u_mech_okello'),
    ];
    const offers = Array.from({ length: 6 }, (_, i) => ({
      jobId: `j${i}`,
      mechanicId: 'u_mech_okello',
      distanceKm: 2,
      ring: { innerKm: 0, outerKm: 5 },
      sentAt: '2026-10-20T08:00:00Z',
      lastSentAt: '2026-10-20T08:00:00Z',
      rounds: 1,
      openedAt: null,
      declinedAt: null,
    }));
    const s = scorecard(okello, [], [], now, 0, { availability, offers });
    expect(s.presenceDays).toBe(10);
    expect(s.onlineHoursPerWeek).toBeCloseTo((2 / 10) * 7);
    expect(s.alerts).toMatchObject({ offers: 6, ignored: 6, acceptanceRate: 0 });
    expect(s.signals).toEqual(['rarely-online', 'ignores-alerts']);
  });

  it('no log yet: no hours, no alert figures, no presence signals', () => {
    const s = scorecard(okello, [], [], new Date('2026-10-24T12:00:00Z'), 0, {
      availability: [],
      offers: [],
    });
    expect(s.onlineHoursPerWeek).toBeNull();
    expect(s.alerts).toBeNull();
    expect(s.signals).toEqual([]);
  });

  it('the mock history gives every active mechanic hours and offers consistent with the jobs', () => {
    const h = generateHistory(new Date('2026-10-14T09:00:00Z'));
    const jobs = new Map(h.jobs.map((j) => [j.id, j]));
    for (const o of h.offers) {
      const winner = jobs.get(o.jobId)?.mechanicId;
      if (winner === o.mechanicId) expect(o.declinedAt).toBeNull();
    }
    // Every job a mechanic won in the logged period reached them as an offer.
    const offered = new Set(h.offers.map((o) => `${o.jobId}:${o.mechanicId}`));
    const since = Date.parse('2026-09-23T09:00:00Z');
    for (const j of h.jobs) {
      if (j.mechanicId && Date.parse(j.request.createdAt) >= since) {
        expect(offered.has(`${j.id}:${j.mechanicId}`)).toBe(true);
      }
    }
    expect(h.availability.some((e) => e.mechanicId === 'u_mech_okello')).toBe(true);
  });
});
