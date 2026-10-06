import { FIXTURE_NOW, JOBS, RATINGS } from '@/lib/mocks/contractFixtures';
import type { Job } from '@/types';

import { computeAlerts, ratingDirection } from '../alerts';
import { groupByStatus } from '../board';
import { enteredStatusAt, formatDuration, msInStatus, timelineSteps } from '../jobTime';

const job = (id: string) => JOBS.find((j) => j.id === id)!;
const active = JOBS.filter((j) => !['complete', 'cancelled'].includes(j.status));

describe('job time', () => {
  it('measures time in the current status from the timeline', () => {
    expect(enteredStatusAt(job('job_enroute_late'))).toBe(job('job_enroute_late').timeline[2]!.at);
    expect(msInStatus(job('job_req_stale'), FIXTURE_NOW)).toBe(4 * 60_000);
  });

  it('formats durations for operators', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(4 * 60_000)).toBe('4 min');
    expect(formatDuration(65 * 60_000)).toBe('1 h 05 min');
    expect(formatDuration(27 * 60 * 60_000)).toBe('1 d 3 h');
  });

  it('lists each step with how long it lasted', () => {
    const steps = timelineSteps(job('job_complete'));
    expect(steps.map((s) => s.status)).toEqual([
      'requested',
      'matched',
      'enroute',
      'arrived',
      'working',
      'complete',
    ]);
    expect(steps[2]!.durationMs).toBe(19 * 60_000);
    expect(steps.at(-1)!.durationMs).toBeNull();
  });
});

describe('alert rail', () => {
  it('fires on a stale request, a late mechanic and a low rating, most urgent first', () => {
    const alerts = computeAlerts(active, RATINGS, FIXTURE_NOW);
    expect(alerts.map((a) => a.key)).toEqual([
      'stale-request:job_req_stale',
      'late-enroute:job_enroute_late',
      'low-rating:rating_m2c',
    ]);
  });

  it('does not fire before the thresholds', () => {
    const fresh: Job = {
      ...job('job_req_stale'),
      id: 'fresh',
      timeline: [
        { status: 'requested', at: new Date(FIXTURE_NOW.getTime() - 90_000).toISOString() },
      ],
    };
    const onTime: Job = {
      ...job('job_enroute_late'),
      id: 'ontime',
      timeline: [
        ...job('job_enroute_late').timeline.slice(0, 2),
        { status: 'enroute', at: new Date(FIXTURE_NOW.getTime() - 29 * 60_000).toISOString() },
      ],
    };
    expect(computeAlerts([fresh, onTime], [], FIXTURE_NOW)).toEqual([]);
  });

  it('says which way a rating went', () => {
    expect(ratingDirection(RATINGS.find((r) => r.id === 'rating_m2c')!)).toBe(
      'Mechanic rated the customer',
    );
    expect(ratingDirection(RATINGS.find((r) => r.id === 'rating_c2m')!)).toBe(
      'Customer rated the mechanic',
    );
  });
});

describe('board', () => {
  it('groups jobs into lifecycle columns', () => {
    const columns = groupByStatus(JOBS);
    expect(columns.requested.map((j) => j.id)).toEqual(['job_req_stale']);
    expect(columns.cancelled.map((j) => j.id)).toEqual([
      'job_cancelled_system',
      'job_cancelled_customer',
    ]);
    expect(columns.arrived).toEqual([]);
  });
});
