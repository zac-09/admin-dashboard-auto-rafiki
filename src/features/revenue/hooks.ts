import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useRepositories } from '@/lib/repositories';
import { TRACKING_START, weekStartOf } from '@/lib/subscriptions';
import type { PaymentMethod } from '@/types';

export const revenueKeys = {
  payments: ['revenue', 'payments'] as const,
  kpiInputs: (days: number) => ['revenue', 'kpi-inputs', days] as const,
};

/** Everything the tracker needs: mechanics, their vetting history, every payment so far. */
export function useSubscriptionInputs() {
  const repos = useRepositories();
  return useQuery({
    queryKey: revenueKeys.payments,
    queryFn: async () => {
      const current = weekStartOf(new Date());
      const [mechanics, entries, payments] = await Promise.all([
        repos.support.listMechanics(),
        repos.audit.listMechanicEntries(),
        repos.revenue.listPayments(TRACKING_START, current),
      ]);
      return { mechanics, entries, payments };
    },
  });
}

/** Jobs and ratings for the KPI window (at least 7 days, for the active-mechanic count). */
export function useKpiInputs(days: number) {
  const repos = useRepositories();
  return useQuery({
    queryKey: revenueKeys.kpiInputs(days),
    queryFn: async () => {
      const since = new Date(Date.now() - Math.max(days, 7) * 86_400_000).toISOString();
      const [jobs, ratings, mechanics] = await Promise.all([
        repos.revenue.listJobsSince(since),
        repos.revenue.listRatingsSince(since),
        repos.support.listMechanics(),
      ]);
      return { jobs, ratings, mechanics };
    },
  });
}

export function useMarkPaid() {
  const repos = useRepositories();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      mechanicId: string;
      weekStart: string;
      method: PaymentMethod;
      reference?: string;
    }) => repos.revenue.markPaid(input),
    onSettled: () => client.invalidateQueries({ queryKey: revenueKeys.payments }),
  });
}
