import { FIXTURE_NOW, JOBS, MECHANICS, RATINGS } from '@/lib/mocks/contractFixtures';
import type { Job } from '@/types';

import { computeKpis, median } from '../kpis';

describe('median', () => {
  it('handles odd, even and empty', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('computeKpis over the contract fixtures', () => {
  const k = computeKpis(JOBS, RATINGS, MECHANICS, 7, FIXTURE_NOW);

  it('counts jobs requested in the window', () => {
    expect(k.jobs).toBe(6);
    expect(k.jobsPerDay).toBeCloseTo(6 / 7);
  });

  it('measures request → arrival on jobs that arrived (working: 20 min, complete: 21 min)', () => {
    expect(k.arrivalsMeasured).toBe(2);
    expect(k.medianArrivalMin).toBe(20.5);
  });

  it('acceptance: of the 5 decided requests, 3 were accepted', () => {
    expect(k.acceptanceRate).toBeCloseTo(3 / 5);
  });

  it('completion: of accepted jobs that finished, the share completed', () => {
    expect(k.completionRate).toBe(1);
  });

  it('averages only customer → mechanic stars', () => {
    expect(k.averageRating).toBe(5);
    expect(k.ratings).toBe(1);
  });

  it('jobs per mechanic per week and active mechanics', () => {
    expect(k.verifiedMechanics).toBe(2);
    expect(k.jobsPerMechanicPerWeek).toBeCloseTo(1 / 2);
    expect(k.activeMechanics).toBe(0);
  });

  it('counts a mechanic as active at 3 completed jobs in 7 days', () => {
    const base = JOBS.find((j) => j.id === 'job_complete')!;
    const copies: Job[] = [1, 2].map((n) => ({ ...base, id: `extra_${n}` }));
    expect(computeKpis([...JOBS, ...copies], [], MECHANICS, 7, FIXTURE_NOW).activeMechanics).toBe(
      1,
    );
  });

  it('is empty-safe', () => {
    const empty = computeKpis([], [], [], 30, FIXTURE_NOW);
    expect(empty).toMatchObject({
      jobs: 0,
      medianArrivalMin: null,
      acceptanceRate: null,
      completionRate: null,
      averageRating: null,
      jobsPerMechanicPerWeek: null,
    });
  });
});
