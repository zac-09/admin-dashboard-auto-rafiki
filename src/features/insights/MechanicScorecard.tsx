import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { Notice, SkeletonLines } from '@/components/ui';
import { overdueAccounts } from '@/features/revenue/collections';
import { useSubscriptionInputs } from '@/features/revenue/hooks';
import { can } from '@/lib/permissions';
import { useRepositories } from '@/lib/repositories';
import { useSession } from '@/lib/session';
import type { MechanicDoc } from '@/types';

import { scorecard } from './scorecard';
import { cancelText, lateText, minutesText, oneDp, ratingText, trendText } from './scorecardText';
import { Signals } from './Signals';
import { WeeklyBars } from './WeeklyBars';

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Overdue weeks, only for roles that may see revenue; null otherwise. */
function useOverdueWeeks(mechanic: MechanicDoc): number | null | undefined {
  const session = useSession();
  const allowed = can(session?.role, 'revenue.view');
  const inputs = useSubscriptionInputs(allowed);
  if (!allowed) return null;
  if (!inputs.data) return undefined;
  const { mechanics, entries, payments } = inputs.data;
  const account = overdueAccounts(mechanics, entries, payments, new Date()).find(
    (a) => a.mechanic.userId === mechanic.userId,
  );
  return account?.weeks.length ?? 0;
}

/** How this mechanic is doing: jobs per week, timeliness, cancellations, rating, payments. */
export function MechanicScorecard({ mechanic }: { mechanic: MechanicDoc }) {
  const repos = useRepositories();
  const record = useQuery({
    queryKey: ['scorecard', mechanic.userId],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
      const [jobs, ratings] = await Promise.all([
        repos.support.listJobsForMechanic(mechanic.userId),
        repos.revenue.listRatingsSince(since),
      ]);
      return { jobs, ratings: ratings.filter((r) => r.mechanicId === mechanic.userId) };
    },
  });
  const overdue = useOverdueWeeks(mechanic);

  if (record.error) {
    return <Notice tone="error">Could not load performance: {record.error.message}</Notice>;
  }
  if (record.isPending || overdue === undefined) return <SkeletonLines lines={4} />;

  const s = scorecard(mechanic, record.data.jobs, record.data.ratings, new Date(), overdue);
  if (s.accepted === 0) {
    return <p className="text-sm text-muted">No jobs taken yet.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <Signals signals={s.signals} />
      <WeeklyBars weekly={s.weekly} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <Stat label="Jobs per week (last 4)">{oneDp(s.jobsPerWeek)}</Stat>
        <Stat label="Request to arrival (median)">{minutesText(s.medianArrivalMin)}</Stat>
        <Stat label="Against the app's estimate">{lateText(s)}</Stat>
        <Stat label="Cancelled by them">{cancelText(s)}</Stat>
        <Stat label="Rating, last 30 days">
          {ratingText(s)}
          {trendText(s) ? <span className="block text-xs text-muted">{trendText(s)}</span> : null}
        </Stat>
        {s.overdueWeeks !== null ? (
          <Stat label="Subscription">
            {s.overdueWeeks
              ? `${s.overdueWeeks} ${s.overdueWeeks === 1 ? 'week' : 'weeks'} overdue`
              : 'Up to date'}
          </Stat>
        ) : null}
      </dl>
      <p className="text-xs text-muted">
        "Against the app's estimate" compares travel time with what the app estimates for the
        distance driven. Acceptance per mechanic is not measurable: the app does not record who saw
        a broadcast.
      </p>
    </div>
  );
}
