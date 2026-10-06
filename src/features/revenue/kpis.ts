import { ratedBy } from '@/lib/ratings';
import type { Job, MechanicDoc, Rating } from '@/types';

/** CLAUDE.md north-star: request → arrival under 30 minutes. */
export const ARRIVAL_TARGET_MIN = 30;
/** CLAUDE.md: an "active" mechanic completes at least 3 jobs a week. */
export const ACTIVE_MIN_JOBS = 3;

const DAY_MS = 86_400_000;

function at(job: Job, status: Job['status']): number | null {
  const entry = job.timeline.find((t) => t.status === status);
  return entry ? Date.parse(entry.at) : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface Kpis {
  days: number;
  jobs: number;
  jobsPerDay: number;
  /** Minutes, over jobs that reached "arrived". Null without any. */
  medianArrivalMin: number | null;
  arrivalsMeasured: number;
  /** 0–1. Of requests no longer waiting, the share a mechanic accepted. */
  acceptanceRate: number | null;
  /** 0–1. Of accepted jobs that finished, the share completed (not cancelled). */
  completionRate: number | null;
  /** Customer → mechanic stars in the window. */
  averageRating: number | null;
  ratings: number;
  /** Mechanics with ≥ 3 completed jobs in the 7 days before `now`. */
  activeMechanics: number;
  verifiedMechanics: number;
  /** Completed jobs per week, per verified mechanic: the pilot's make-or-break number. */
  jobsPerMechanicPerWeek: number | null;
}

/**
 * KPIs over jobs requested in the last `days` days (`jobs` must already be that window, plus
 * whatever came before for the 7-day active-mechanic count; both are filtered here).
 */
export function computeKpis(
  allJobs: readonly Job[],
  ratings: readonly Rating[],
  mechanics: readonly MechanicDoc[],
  days: number,
  now: Date,
): Kpis {
  const since = now.getTime() - days * DAY_MS;
  const jobs = allJobs.filter((j) => Date.parse(j.request.createdAt) >= since);

  const arrivals = jobs.flatMap((j) => {
    const arrived = at(j, 'arrived');
    return arrived === null ? [] : [(arrived - Date.parse(j.request.createdAt)) / 60_000];
  });

  const decided = jobs.filter((j) => j.status !== 'requested');
  const accepted = decided.filter((j) => at(j, 'matched') !== null);
  const acceptedFinished = accepted.filter(
    (j) => j.status === 'complete' || j.status === 'cancelled',
  );
  const completed = jobs.filter((j) => j.status === 'complete');

  const stars = ratings
    .filter((r) => ratedBy(r) === 'customer' && Date.parse(r.createdAt) >= since)
    .map((r) => r.stars);

  const weekAgo = now.getTime() - 7 * DAY_MS;
  const perMechanic = new Map<string, number>();
  for (const j of allJobs) {
    const done = at(j, 'complete');
    if (j.mechanicId && done !== null && done >= weekAgo) {
      perMechanic.set(j.mechanicId, (perMechanic.get(j.mechanicId) ?? 0) + 1);
    }
  }
  const verified = mechanics.filter((m) => m.vetting === 'verified').length;

  return {
    days,
    jobs: jobs.length,
    jobsPerDay: jobs.length / days,
    medianArrivalMin: median(arrivals),
    arrivalsMeasured: arrivals.length,
    acceptanceRate: decided.length ? accepted.length / decided.length : null,
    completionRate: acceptedFinished.length
      ? acceptedFinished.filter((j) => j.status === 'complete').length / acceptedFinished.length
      : null,
    averageRating: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    ratings: stars.length,
    activeMechanics: [...perMechanic.values()].filter((n) => n >= ACTIVE_MIN_JOBS).length,
    verifiedMechanics: verified,
    jobsPerMechanicPerWeek: verified ? completed.length / (days / 7) / verified : null,
  };
}
