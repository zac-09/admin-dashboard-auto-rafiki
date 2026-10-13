import { JOBS, MECHANICS, PLACES } from '@/lib/mocks/contractFixtures';
import { AUDIT_ENTRIES } from '@/lib/mocks/auditFixtures';
import { generateHistory } from '@/lib/mocks/historyFixtures';
import type { Job, Rating } from '@/types';

import { coverage } from '../coverage';
import { demand, slotLabel } from '../demand';
import { appEstimateMinutes, isUnserved, kampalaSlot, lateMinutes } from '../jobFacts';
import { scorecard } from '../scorecard';
import { lastWeeks, weeklyTrends } from '../trends';

const job = (id: string) => structuredClone(JOBS.find((j) => j.id === id)!);
const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;

/** A completed job for `mechanicId` at `at`, travelling `travel` min for `km` km. */
function done(id: string, mechanicId: string, at: string, km: number, travel: number): Job {
  const t = Date.parse(at);
  const iso = (min: number) => new Date(t + min * 60_000).toISOString();
  return {
    ...job('job_complete'),
    id,
    mechanicId,
    distanceKm: km,
    request: { ...job('job_complete').request, id, createdAt: iso(0) },
    status: 'complete',
    timeline: [
      { status: 'requested', at: iso(0) },
      { status: 'matched', at: iso(1) },
      { status: 'enroute', at: iso(2) },
      { status: 'arrived', at: iso(2 + travel) },
      { status: 'working', at: iso(3 + travel) },
      { status: 'complete', at: iso(30 + travel) },
    ],
  };
}

describe('job facts', () => {
  it('unserved means cancelled without ever being matched', () => {
    expect(isUnserved(job('job_cancelled_system'))).toBe(true);
    expect(isUnserved(job('job_cancelled_customer'))).toBe(true);
    expect(isUnserved(job('job_complete'))).toBe(false);
    const afterMatch = { ...job('job_enroute_late'), status: 'cancelled' as const };
    expect(isUnserved(afterMatch)).toBe(false);
  });

  it('lateness compares travel with the app estimate for the distance driven', () => {
    expect(appEstimateMinutes(6)).toBe(20);
    expect(appEstimateMinutes(0.2)).toBe(2);
    const j = done('j', 'u_mech_okello', '2026-10-06T06:00:00Z', 6, 32);
    expect(lateMinutes(j)).toBe(12);
    // A stored ETA wins over the estimate.
    expect(lateMinutes({ ...j, etaMinutes: 30 })).toBe(2);
    expect(lateMinutes({ ...j, distanceKm: undefined })).toBeNull();
  });

  it('slots are Kampala weekday and hour', () => {
    // Monday 5 Oct 2026, 21:30 UTC = Tuesday 00:30 in Kampala.
    expect(kampalaSlot('2026-10-05T21:30:00Z')).toEqual({ day: 1, hour: 0 });
    expect(slotLabel(4, 17)).toBe('Fri 17:00–18:00');
  });
});

describe('coverage gaps', () => {
  it('groups finished requests into areas and ranks the unanswered ones first', () => {
    const unservedAt = (id: string, place: (typeof PLACES)['makerere']): Job => ({
      ...job('job_cancelled_system'),
      id,
      request: { ...job('job_cancelled_system').request, id, location: place },
    });
    const result = coverage(
      [
        unservedAt('a', PLACES.makerere),
        unservedAt('b', { ...PLACES.makerere, label: 'Makerere hill' }),
        unservedAt('c', PLACES.kabalagala),
        job('job_complete'),
        job('job_req_stale'), // still open: not counted
      ],
      MECHANICS,
    );
    expect(result.requests).toBe(4);
    expect(result.unserved).toBe(3);
    const [worst] = result.areas;
    expect(worst).toMatchObject({ requests: 2, unserved: 2, unservedShare: 1 });
    expect(['Makerere University main gate', 'Makerere hill']).toContain(worst!.label);
    // Okello's live location is in Kololo, about 3 km from Makerere.
    expect(worst!.nearestMechanicKm).toBeGreaterThan(2);
    expect(worst!.nearestMechanicKm).toBeLessThan(4);
    expect(result.areas.at(-1)).toMatchObject({ unserved: 0 });
  });
});

describe('demand by hour', () => {
  it('counts requests and unanswered requests per Kampala slot, worst slots first', () => {
    const at = (iso: string, base: Job): Job => ({
      ...base,
      request: { ...base.request, createdAt: iso },
    });
    const d = demand([
      at('2026-10-09T14:10:00Z', job('job_cancelled_system')), // Fri 17:10
      at('2026-10-09T14:40:00Z', job('job_cancelled_system')), // Fri 17:40
      at('2026-10-09T14:50:00Z', job('job_complete')), // Fri 17:50
      at('2026-10-05T05:00:00Z', job('job_cancelled_customer')), // Mon 08:00
    ]);
    expect(d.grid[4]![17]).toEqual({ requests: 3, unserved: 2 });
    expect(d.maxRequests).toBe(3);
    expect(d.worst.map((w) => slotLabel(w.day, w.hour))).toEqual([
      'Fri 17:00–18:00',
      'Mon 08:00–09:00',
    ]);
  });
});

describe('weekly trends', () => {
  it('computes jobs per mechanic, arrival, unanswered share and money per week', () => {
    const now = new Date('2026-10-14T09:00:00Z'); // Wednesday of the week of 12 Oct
    expect(lastWeeks(3, now)).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    const jobs = [
      done('w1a', 'u_mech_okello', '2026-10-06T06:00:00Z', 3, 10),
      done('w1b', 'u_mech_namukasa', '2026-10-07T06:00:00Z', 3, 30),
      {
        ...job('job_cancelled_system'),
        request: { ...job('job_cancelled_system').request, createdAt: '2026-10-08T06:00:00Z' },
      },
    ];
    const payments = [
      {
        id: 'p',
        mechanicId: 'u_mech_okello',
        weekStart: '2026-10-05',
        amount: 15_000,
        method: 'cash' as const,
        reference: null,
        paidAt: '2026-10-06T06:00:00Z',
        recordedBy: 's',
        recordedByEmail: null,
      },
    ];
    const [, week] = weeklyTrends(
      ['2026-09-28', '2026-10-05'],
      jobs,
      MECHANICS,
      AUDIT_ENTRIES,
      payments,
      now,
    );
    expect(week).toMatchObject({
      weekStart: '2026-10-05',
      partial: false,
      requests: 3,
      completed: 2,
      unservedShare: 1 / 3,
      collected: 15_000,
    });
    // Okello (verified before the dashboard, no decision on record) and Namukasa (approved
    // in August). Waiswa was suspended on 30 Sep, before this week began.
    expect(week!.verified).toBe(2);
    expect(week!.jobsPerMechanic).toBe(1);
    expect(week!.medianArrivalMin).toBe(22);
  });

  it('weeks before the tracker carry no money', () => {
    const now = new Date('2026-10-14T09:00:00Z');
    const [before] = weeklyTrends(['2026-09-28'], [], MECHANICS, AUDIT_ENTRIES, [], now);
    expect(before).toMatchObject({ collected: null, expected: null, jobsPerMechanic: 0 });
  });
});

describe('mechanic scorecard', () => {
  const now = new Date('2026-10-14T09:00:00Z');
  const rating = (id: string, stars: Rating['stars'], daysAgo: number): Rating => ({
    id,
    jobId: 'x',
    mechanicId: 'u_mech_okello',
    customerId: 'u_customer_aisha',
    stars,
    createdAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
  });

  it('flags lateness, cancellations and a falling rating; shows payments when given', () => {
    const jobs: Job[] = [
      done('a', 'u_mech_okello', '2026-10-01T06:00:00Z', 3, 25),
      done('b', 'u_mech_okello', '2026-10-08T06:00:00Z', 3, 30),
      done('c', 'u_mech_okello', '2026-10-09T06:00:00Z', 3, 22),
      {
        ...job('job_enroute_late'),
        id: 'd',
        mechanicId: 'u_mech_okello',
        status: 'cancelled',
        cancelledBy: 'mechanic',
      },
    ];
    const ratings = [
      rating('r1', 5, 40),
      rating('r2', 5, 45),
      rating('r3', 4, 50),
      rating('r4', 3, 5),
      rating('r5', 3, 6),
      rating('r6', 4, 7),
      { ...rating('r7', 1, 3), ratedBy: 'mechanic' as const }, // the other direction: ignored
    ];
    const s = scorecard(okello, jobs, ratings, now, 2);
    expect(s.completed).toBe(3);
    expect(s.jobsPerWeek).toBe(0.75);
    expect(s.cancelShare).toBe(0.25);
    expect(s.medianLateMin).toBe(15);
    expect(s.rating).toMatchObject({ recentCount: 3, previousCount: 3 });
    expect(s.ratingTrend).toBe('down');
    expect(s.signals).toEqual([
      'often-late',
      'cancels-often',
      'rating-falling',
      'low-rating',
      'payment-overdue',
    ]);
    expect(s.weekly.map((w) => w.completed)).toEqual([0, 0, 0, 0, 0, 1, 2, 0]);
  });

  it('a busy, punctual, well-rated mechanic is a top performer', () => {
    const jobs = Array.from({ length: 16 }, (_, i) =>
      done(
        `t${i}`,
        'u_mech_okello',
        new Date(now.getTime() - (i + 1) * 1.5 * 86_400_000).toISOString(),
        3,
        9,
      ),
    );
    const ratings = [rating('a', 5, 2), rating('b', 5, 3), rating('c', 4, 4)];
    expect(scorecard(okello, jobs, ratings, now, 0).signals).toEqual(['top']);
  });
});

describe('mock history', () => {
  it('is deterministic, real-shaped and tells the coverage story', () => {
    const now = new Date('2026-10-13T09:00:00Z');
    const a = generateHistory(now);
    expect(generateHistory(now)).toEqual(a);
    expect(a.jobs.length).toBeGreaterThan(200);
    for (const j of a.jobs) {
      expect(j.timeline[0]!.status).toBe('requested');
      expect(j.status).toBe(j.timeline.at(-1)!.status);
      if (j.status === 'cancelled') expect(j.cancelledBy).toBeDefined();
    }
    const outer = a.jobs.filter((j) =>
      /Kira town|Mukono|Nansana|Kajjansi/.test(j.request.location.label),
    );
    const share = (js: Job[]) => js.filter(isUnserved).length / js.length;
    expect(share(outer)).toBeGreaterThan(share(a.jobs));
  });
});

describe('chart axis', () => {
  it('rounds the top up to 1, 2, 2.5 or 5 times a power of ten', async () => {
    const { niceCeil } = await import('../chartScale');
    expect([0, 0.4, 3, 12.6, 22, 26.5, 17_000].map(niceCeil)).toEqual([
      1, 0.5, 5, 20, 25, 50, 20_000,
    ]);
  });
});
