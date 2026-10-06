import { ratedBy } from '@/lib/ratings';
import type { Job, Rating } from '@/types';

import { LATE_ENROUTE_MS, LOW_RATING_MAX_STARS, STALE_REQUEST_MS } from './constants';
import { msInStatus } from './jobTime';

export type Alert =
  | { kind: 'stale-request'; key: string; job: Job; ms: number }
  | { kind: 'late-enroute'; key: string; job: Job; ms: number }
  | { kind: 'low-rating'; key: string; rating: Rating };

/**
 * The operator's to-do list: requests nobody has accepted for 2 min, mechanics on the way for
 * over 30 min, and ratings of 2 stars or fewer. Most urgent kind first, oldest first within.
 */
export function computeAlerts(
  activeJobs: readonly Job[],
  lowRatings: readonly Rating[],
  now: Date,
): Alert[] {
  const jobAlerts = (
    kind: 'stale-request' | 'late-enroute',
    status: Job['status'],
    limit: number,
  ) =>
    activeJobs
      .filter((job) => job.status === status && !(status === 'requested' && job.mechanicId))
      .map((job) => ({ kind, key: `${kind}:${job.id}`, job, ms: msInStatus(job, now) }))
      .filter((a) => a.ms > limit)
      .sort((a, b) => b.ms - a.ms);
  return [
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
