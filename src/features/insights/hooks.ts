import { useQuery } from '@tanstack/react-query';

import { useRepositories } from '@/lib/repositories';
import { kampalaMidnight, TRACKING_START, weekStartOf } from '@/lib/subscriptions';

import { lastWeeks } from './trends';

/** Weeks of history the insights read: enough for a trend and for 30-vs-30-day ratings. */
export const INSIGHT_WEEKS = 10;

/**
 * Everything the insight views compute from, read once (not live): jobs and ratings since
 * the first week shown, every mechanic, vetting history and subscription payments.
 */
export function useInsightsInputs() {
  const repos = useRepositories();
  return useQuery({
    queryKey: ['insights', 'inputs', INSIGHT_WEEKS],
    queryFn: async () => {
      const now = new Date();
      const since = new Date(kampalaMidnight(lastWeeks(INSIGHT_WEEKS, now)[0]!)).toISOString();
      const [jobs, ratings, mechanics, entries, payments, availability, offers] = await Promise.all(
        [
          repos.revenue.listJobsSince(since),
          repos.revenue.listRatingsSince(since),
          repos.support.listMechanics(),
          repos.audit.listMechanicEntries(),
          repos.revenue.listPayments(TRACKING_START, weekStartOf(now)),
          repos.insights.listAvailabilitySince(since),
          repos.insights.listOffersSince(since),
        ],
      );
      return {
        jobs,
        ratings,
        mechanics,
        entries,
        payments,
        presence: { availability, offers },
        now,
        since,
      };
    },
    staleTime: 60_000,
  });
}
