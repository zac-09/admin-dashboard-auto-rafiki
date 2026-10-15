import { haversineKm } from '@/lib/geo';
import { ratedBy } from '@/lib/ratings';
import type { Job, MechanicDoc, Rating } from '@/types';

import { LATE_ENROUTE_MS, LOW_RATING_MAX_STARS, STALE_REQUEST_MS } from './constants';
import { msInStatus } from './jobTime';

export type Alert =
  /** An open request with no verified mechanic online within the broadcast radius. */
  | { kind: 'out-of-reach'; key: string; job: Job; radiusKm: number; nearestKm: number | null }
  | { kind: 'stale-request'; key: string; job: Job; ms: number }
  | { kind: 'late-enroute'; key: string; job: Job; ms: number }
  | { kind: 'low-rating'; key: string; rating: Rating };

/**
 * The operator's to-do list: requests nobody has accepted for 2 min, mechanics on the way for
 * over 30 min, and ratings of 2 stars or fewer. Most urgent kind first, oldest first within.
 */
export interface LiveCoverage {
  /** Mechanics online now (any vetting; only verified ones receive alerts). */
  online: readonly MechanicDoc[];
  /** The first broadcast radius (settings/app, or the app's compiled default). */
  radiusKm: number;
}

/** Km from the request to the closest verified mechanic online, or null if nobody is. */
export function nearestOnlineKm(job: Job, online: readonly MechanicDoc[]): number | null {
  const spots = online.flatMap((m) =>
    m.isOnline && m.vetting === 'verified' && m.lastKnownLocation ? [m.lastKnownLocation] : [],
  );
  return spots.length ? Math.min(...spots.map((s) => haversineKm(s, job.request.location))) : null;
}

export function computeAlerts(
  activeJobs: readonly Job[],
  lowRatings: readonly Rating[],
  now: Date,
  coverage?: LiveCoverage,
): Alert[] {
  // Open requests nobody online can reach: flagged at once (not after 2 minutes), and in
  // place of the stale-request alert for the same job, which would only repeat it.
  const outOfReach: Alert[] = coverage
    ? activeJobs
        .filter((job) => job.status === 'requested' && !job.mechanicId)
        .map((job) => ({ job, nearestKm: nearestOnlineKm(job, coverage.online) }))
        .filter((x) => x.nearestKm === null || x.nearestKm > coverage.radiusKm)
        .sort((a, b) => a.job.request.createdAt.localeCompare(b.job.request.createdAt))
        .map(({ job, nearestKm }) => ({
          kind: 'out-of-reach' as const,
          key: `out-of-reach:${job.id}`,
          job,
          radiusKm: coverage.radiusKm,
          nearestKm,
        }))
    : [];
  const unreachable = new Set(outOfReach.map((a) => (a.kind === 'low-rating' ? '' : a.job.id)));
  const jobAlerts = (
    kind: 'stale-request' | 'late-enroute',
    status: Job['status'],
    limit: number,
  ) =>
    activeJobs
      .filter((job) => job.status === status && !(status === 'requested' && job.mechanicId))
      .filter((job) => !unreachable.has(job.id))
      .map((job) => ({ kind, key: `${kind}:${job.id}`, job, ms: msInStatus(job, now) }))
      .filter((a) => a.ms > limit)
      .sort((a, b) => b.ms - a.ms);
  return [
    ...outOfReach,
    ...jobAlerts('stale-request', 'requested', STALE_REQUEST_MS),
    ...jobAlerts('late-enroute', 'enroute', LATE_ENROUTE_MS),
    ...lowRatings
      .filter((r) => r.stars <= LOW_RATING_MAX_STARS)
      .map((rating) => ({ kind: 'low-rating' as const, key: `low-rating:${rating.id}`, rating })),
  ];
}

/** "Customer rated the mechanic" / "Mechanic rated the customer". */
export function ratingDirection(rating: Rating): string {
  return ratedBy(rating) === 'mechanic'
    ? 'Mechanic rated the customer'
    : 'Customer rated the mechanic';
}
