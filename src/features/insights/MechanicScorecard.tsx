import type { ReactNode } from 'react';

import { Notice, SkeletonLines } from '@/components/ui';
import { overdueAccounts } from '@/features/revenue/collections';
import { useSubscriptionInputs } from '@/features/revenue/hooks';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import type { MechanicDoc } from '@/types';

import { useInsightsInputs } from './hooks';
import { scorecard } from './scorecard';
import {
  alertsText,
  cancelText,
  lateText,
  minutesText,
  onlineText,
  oneDp,
  ratingText,
  trendText,
} from './scorecardText';
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
  // The shared insights read: offers need every job (to tell "taken by another mechanic"
  // from "ignored"), and the availability log needs no per-mechanic query.
  const record = useInsightsInputs();
  const overdue = useOverdueWeeks(mechanic);

  if (record.error) {
    return <Notice tone="error">Could not load performance: {record.error.message}</Notice>;
  }
  if (record.isPending || overdue === undefined) return <SkeletonLines lines={4} />;

  const s = scorecard(
    mechanic,
    record.data.jobs,
    record.data.ratings,
    record.data.now,
    overdue,
    record.data.presence,
  );
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
        <Stat label="Against the promised ETA">{lateText(s)}</Stat>
        <Stat label="Online, last 4 weeks">{onlineText(s)}</Stat>
        <Stat label="Job alerts">{alertsText(s)}</Stat>
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
        Lateness compares travel time with the ETA shown when setting off (older jobs: the app's
        estimate for the distance). Online hours and job alerts come from the app's logs, kept since
        14 Oct 2026.
      </p>
    </div>
  );
}
