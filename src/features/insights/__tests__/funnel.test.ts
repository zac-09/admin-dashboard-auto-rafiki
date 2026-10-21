import { FIXTURE_NOW, JOBS } from '@/lib/mocks/contractFixtures';
import type { Job } from '@/types';

import { cancelledAt, funnel, legs, requestedWithin, serviceMix, vehicleMix } from '../funnel';

const job = (id: string) => structuredClone(JOBS.find((j) => j.id === id)!);

/** Cancelled by `who` once it had reached `stage`. */
function cancelledFrom(id: string, stage: 'matched' | 'enroute', who: Job['cancelledBy']): Job {
  const j = job('job_enroute_late');
  const at = j.timeline.findIndex((t) => t.status === stage);
  return {
    ...j,
    id,
    status: 'cancelled',
    cancelledBy: who,
    timeline: [...j.timeline.slice(0, at + 1), { status: 'cancelled', at: j.timeline[at]!.at }],
  };
}

function booked(id: string): Job {
  const j = job('job_complete');
  return {
    ...j,
    id,
    fee: 120_000,
    request: {
      ...j.request,
      service: 'other',
      booking: {
        packageId: 'full-service',
        packageLabel: 'Full service',
        scheduledFor: j.request.createdAt,
        windowMinutes: 120,
      },
    },
  };
}

describe('request funnel', () => {
  it('counts how many requests reached each step', () => {
    const f = funnel(JOBS);
    expect(f.requests).toBe(6);
    expect(f.inProgress).toBe(3);
    expect(f.stages.map((s) => [s.stage, s.reached])).toEqual([
      ['requested', 6],
      ['matched', 3],
      ['enroute', 3],
      ['arrived', 2],
      ['working', 2],
      ['complete', 1],
    ]);
  });

  it('splits cancellations by the step reached and who cancelled', () => {
    const jobs = [
      ...JOBS,
      cancelledFrom('m1', 'matched', 'mechanic'),
      cancelledFrom('m2', 'enroute', 'admin'),
      cancelledFrom('m3', 'enroute', undefined),
    ];
    const f = funnel(jobs);
    expect(f.cancelled).toBe(5);
    expect(f.cancellations).toEqual({
      requested: { customer: 1, system: 1 },
      matched: { mechanic: 1 },
      enroute: { admin: 1, unknown: 1 },
    });
    expect(cancelledAt(job('job_cancelled_system'))).toBe('requested');
  });
});

describe('where the minutes go', () => {
  it('takes the median of each step over breakdowns, leaving bookings out', () => {
    const byId = Object.fromEntries(legs([...JOBS, booked('b1')]).map((l) => [l.id, l]));
    expect(byId.accept).toMatchObject({ medianMin: 1, measured: 3, beforeArrival: true });
    expect(byId.setOff).toMatchObject({ medianMin: 1, measured: 3 });
    expect(byId.travel).toMatchObject({ medianMin: 18.5, measured: 2 });
    expect(byId.onSite).toMatchObject({ medianMin: 29, measured: 1, beforeArrival: false });
  });
});

describe('service and vehicle mix', () => {
  it('per service: completion, unanswered share, fees; bookings are their own row', () => {
    const rows = serviceMix([...JOBS, booked('b1')]);
    const battery = rows.find((r) => r.key === 'battery')!;
    const fee = job('job_complete').fee;
    expect(battery).toMatchObject({
      label: 'Dead battery',
      requests: 2,
      completed: 1,
      completionShare: 1,
      unservedShare: 0,
      completedFees: fee,
      averageFee: fee,
    });
    expect(rows.find((r) => r.key === 'lockout')).toMatchObject({
      completionShare: 0,
      unservedShare: 1,
      averageFee: null,
    });
    const booking = rows.find((r) => r.key === 'booking')!;
    expect(booking).toMatchObject({ label: 'Booked servicing', completedFees: 120_000 });
    expect(booking.medianArrivalMin).toBeNull();
    expect(rows.some((r) => r.key === 'other')).toBe(false);
    // Most requested first.
    expect(rows[0]!.requests).toBeGreaterThanOrEqual(rows[rows.length - 1]!.requests);
  });

  it('per vehicle', () => {
    const rows = vehicleMix(JOBS);
    expect(rows.map((r) => [r.label, r.requests])).toEqual([
      ['Car', 4],
      ['Boda', 1],
      ['Matatu', 1],
    ]);
  });

  it('keeps only requests in the period', () => {
    const now = FIXTURE_NOW;
    expect(requestedWithin(JOBS, 1, now).map((j) => j.id)).toEqual([
      'job_req_stale',
      'job_enroute_late',
      'job_working',
    ]);
  });
});
