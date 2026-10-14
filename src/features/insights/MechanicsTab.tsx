import { useState } from 'react';
import { Link } from 'react-router';

import { overdueAccounts } from '@/features/revenue/collections';
import { VettingStatusBadge } from '@/features/vetting/VettingStatusBadge';

import type { InsightsData } from './InsightsPage';
import { scorecard, scoredMechanics, SIGNALS, type Scorecard } from './scorecard';
import {
  alertsText,
  cancelText,
  lateText,
  onlineText,
  oneDp,
  ratingText,
  trendText,
} from './scorecardText';
import { Signals } from './Signals';

type SortKey = 'jobs' | 'online' | 'rating' | 'late' | 'cancels' | 'concerns';

const SORTS: { id: SortKey; label: string }[] = [
  { id: 'jobs', label: 'Jobs per week' },
  { id: 'online', label: 'Hours online' },
  { id: 'rating', label: 'Rating' },
  { id: 'late', label: 'Lateness' },
  { id: 'cancels', label: 'Cancellations' },
  { id: 'concerns', label: 'Most concerns' },
];

const nullLast = (v: number | null, dir: 1 | -1) => (v === null ? Infinity : dir * v);

function compare(key: SortKey) {
  return (a: Scorecard, b: Scorecard): number => {
    switch (key) {
      case 'jobs':
        return b.jobsPerWeek - a.jobsPerWeek;
      case 'online':
        return nullLast(a.onlineHoursPerWeek, -1) - nullLast(b.onlineHoursPerWeek, -1);
      case 'rating':
        return nullLast(a.rating.recent, -1) - nullLast(b.rating.recent, -1);
      case 'late':
        return nullLast(a.medianLateMin, -1) - nullLast(b.medianLateMin, -1);
      case 'cancels':
        return nullLast(a.cancelShare, -1) - nullLast(b.cancelShare, -1);
      case 'concerns':
        return (
          b.signals.filter((s) => s !== 'top').length - a.signals.filter((s) => s !== 'top').length
        );
    }
  };
}

const TH = 'px-3 py-2 text-left text-xs font-normal text-muted';
const TD = 'px-3 py-2 align-top';

export function MechanicsTab({ data }: { data: InsightsData }) {
  const [sort, setSort] = useState<SortKey>('jobs');
  const { jobs, ratings, mechanics, entries, payments, now } = data;
  const overdue = new Map(
    overdueAccounts(mechanics, entries, payments, now).map((a) => [
      a.mechanic.userId,
      a.weeks.length,
    ]),
  );
  const cards = scoredMechanics(mechanics, jobs)
    .map((m) => scorecard(m, jobs, ratings, now, overdue.get(m.userId) ?? 0, data.presence))
    .sort(
      (a, b) =>
        compare(sort)(a, b) || a.mechanic.businessName.localeCompare(b.mechanic.businessName),
    );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Every verified or suspended mechanic, from their jobs, customer ratings and the app's
        availability and job-alert logs (recorded since 14 Oct 2026; hours are averaged over the
        days logged). Lateness compares travel time (set off to arrival) with the ETA the mechanic
        was shown when setting off, or for older jobs the app's estimate for the distance driven.
        Job alerts: taken, passed, taken first by another mechanic, or left unanswered. Signals:
        late by {SIGNALS.lateMin}+ min (median), cancelling {Math.round(SIGNALS.cancelShare * 100)}
        %+ of accepted jobs, a rating {SIGNALS.lowRating} or lower or falling by{' '}
        {SIGNALS.trendStars}+ stars month on month, an overdue subscription, under{' '}
        {SIGNALS.minOnlineHours} hours online a week, or leaving{' '}
        {Math.round(SIGNALS.ignoredShare * 100)}%+ of job alerts unanswered.
      </p>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort by">
        <span className="micro-label">Sort by</span>
        {SORTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={sort === s.id}
            onClick={() => setSort(s.id)}
            className="min-h-10 rounded-control border border-hairline px-3 text-sm aria-pressed:border-primary aria-pressed:font-semibold"
          >
            {s.label}
          </button>
        ))}
      </div>
      {cards.length === 0 ? (
        <p className="panel p-6 text-sm text-muted">No verified mechanics yet.</p>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm" aria-label="Mechanic scorecards">
            <thead>
              <tr className="border-b border-hairline">
                <th scope="col" className={TH}>
                  Mechanic
                </th>
                <th scope="col" className={TH}>
                  Jobs / week (4 wk)
                </th>
                <th scope="col" className={TH}>
                  Online (4 wk)
                </th>
                <th scope="col" className={TH}>
                  Job alerts
                </th>
                <th scope="col" className={TH}>
                  Arrival (median)
                </th>
                <th scope="col" className={TH}>
                  Cancelled by them
                </th>
                <th scope="col" className={TH}>
                  Rating (30 days)
                </th>
                <th scope="col" className={TH}>
                  Subscription
                </th>
                <th scope="col" className={TH}>
                  Signals
                </th>
              </tr>
            </thead>
            <tbody>
              {cards.map((s) => (
                <tr key={s.mechanic.userId} className="border-b border-hairline last:border-0">
                  <th scope="row" className={`${TD} text-left font-normal`}>
                    <span className="flex flex-col items-start gap-1">
                      <Link
                        to={`/vetting/${s.mechanic.userId}`}
                        className="font-semibold underline"
                      >
                        {s.mechanic.businessName}
                      </Link>
                      <VettingStatusBadge status={s.mechanic.vetting} />
                    </span>
                  </th>
                  <td className={TD}>
                    {oneDp(s.jobsPerWeek)}
                    <span className="block text-xs text-muted">{s.completed} completed</span>
                  </td>
                  <td className={TD}>{onlineText(s)}</td>
                  <td className={TD}>
                    {s.alerts?.acceptanceRate != null
                      ? `${Math.round(s.alerts.acceptanceRate * 100)}% taken`
                      : '–'}
                    <span className="block text-xs text-muted">{alertsText(s)}</span>
                  </td>
                  <td className={TD}>
                    {s.medianArrivalMin === null ? '–' : `${Math.round(s.medianArrivalMin)} min`}
                    <span className="block text-xs text-muted">{lateText(s)}</span>
                  </td>
                  <td className={TD}>{cancelText(s)}</td>
                  <td className={TD}>
                    {ratingText(s)}
                    {trendText(s) ? (
                      <span className="block text-xs text-muted">{trendText(s)}</span>
                    ) : null}
                  </td>
                  <td className={TD}>
                    {s.overdueWeeks
                      ? `${s.overdueWeeks} ${s.overdueWeeks === 1 ? 'week' : 'weeks'} overdue`
                      : 'Up to date'}
                  </td>
                  <td className={TD}>
                    <Signals signals={s.signals} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
