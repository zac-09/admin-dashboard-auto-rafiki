import { median } from '@/features/revenue/kpis';
import { ratedBy } from '@/lib/ratings';
import type { Job, MechanicDoc, Rating } from '@/types';

import { SUGGEST_SUSPENSION_AFTER_WEEKS } from '@/features/revenue/collections';

import { arrivalMinutes, enteredAt, lateMinutes } from './jobFacts';
import {
  hoursOnline,
  offerStats,
  onlineStretches,
  type AvailabilityRecord,
  type OfferRecord,
  type OfferStats,
} from './presence';
import { lastWeeks } from './trends';
import { weekStartOf } from '@/lib/subscriptions';

const DAY_MS = 86_400_000;

/** How the scorecard reads the numbers. Stated in the UI so nobody has to guess. */
export const SIGNALS = {
  /** Median minutes later than expected for the distance. */
  lateMin: 10,
  /** Share of accepted jobs the mechanic cancelled, with at least `minAccepted` accepted. */
  cancelShare: 0.2,
  minAccepted: 3,
  /** A rating needs at least this many ratings in both 30-day windows to show a trend. */
  minRatings: 3,
  /** Stars of change between the two windows that count as a trend. */
  trendStars: 0.3,
  lowRating: 3.5,
  /** Top performer: busy, well rated, on time. */
  topJobsPerWeek: 3,
  topRating: 4.5,
  /** Fewer hours online a week than this, measured over at least a week of the log. */
  minOnlineHours: 10,
  /** Share of job alerts left unanswered (not opened-and-passed, not taken by anyone). */
  ignoredShare: 0.5,
  minOffers: 5,
} as const;

export type Signal =
  | 'top'
  | 'often-late'
  | 'cancels-often'
  | 'rating-falling'
  | 'low-rating'
  | 'payment-overdue'
  | 'suspension-suggested'
  | 'rarely-online'
  | 'ignores-alerts';

export const SIGNAL_LABELS: Record<Signal, string> = {
  top: 'Top performer',
  'often-late': 'Often late',
  'cancels-often': 'Cancels often',
  'rating-falling': 'Rating falling',
  'low-rating': 'Low rating',
  'payment-overdue': 'Payment overdue',
  'suspension-suggested': 'Suspension suggested',
  'rarely-online': 'Rarely online',
  'ignores-alerts': 'Ignores job alerts',
};

/** Signals that ask ops to act (coach, warn, chase), as opposed to praise. */
export const CONCERNS: readonly Signal[] = [
  'often-late',
  'cancels-often',
  'rating-falling',
  'low-rating',
  'payment-overdue',
  'suspension-suggested',
  'rarely-online',
  'ignores-alerts',
];

export interface Scorecard {
  mechanic: MechanicDoc;
  /** Completed jobs per week, last 8 weeks, oldest first. */
  weekly: { weekStart: string; completed: number }[];
  /** Completed in the last 28 days ÷ 4. */
  jobsPerWeek: number;
  accepted: number;
  completed: number;
  mechanicCancels: number;
  cancelShare: number | null;
  medianArrivalMin: number | null;
  medianLateMin: number | null;
  rating: {
    recent: number | null;
    recentCount: number;
    previous: number | null;
    previousCount: number;
  };
  ratingTrend: 'up' | 'down' | 'steady' | null;
  /** Overdue subscription weeks; null when not shown (no revenue access). */
  overdueWeeks: number | null;
  /** Average hours online a week over the last 4 weeks of the log; null without a log. */
  onlineHoursPerWeek: number | null;
  /** Days of availability log the average covers (the app began logging 2026-10-14). */
  presenceDays: number;
  /** How they answered job alerts; null before offers were recorded. */
  alerts: OfferStats | null;
  signals: Signal[];
}

/** The app's logs, when loaded (contract 2026-10-14). */
export interface PresenceInputs {
  availability: readonly AvailabilityRecord[];
  offers: readonly OfferRecord[];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * One mechanic's record from their jobs and customer ratings. `jobs` and `ratings` may hold
 * other mechanics' too; both are filtered here. Per-mechanic acceptance rate is not possible:
 * the app does not record who saw a broadcast.
 */
export function scorecard(
  mechanic: MechanicDoc,
  jobs: readonly Job[],
  ratings: readonly Rating[],
  now: Date,
  overdueWeeks: number | null = null,
  presence: PresenceInputs | null = null,
): Scorecard {
  const mine = jobs.filter((j) => j.mechanicId === mechanic.userId);
  const completedAt = mine.flatMap((j) => {
    const at = enteredAt(j, 'complete');
    return at === null ? [] : [at];
  });
  const weekly = lastWeeks(8, now).map((weekStart) => ({
    weekStart,
    completed: completedAt.filter((at) => weekStartOf(at) === weekStart).length,
  }));
  const fourWeeksAgo = now.getTime() - 28 * DAY_MS;
  const jobsPerWeek = completedAt.filter((at) => at >= fourWeeksAgo).length / 4;
  const mechanicCancels = mine.filter((j) => j.cancelledBy === 'mechanic').length;
  const values = (f: (j: Job) => number | null) =>
    mine.flatMap((j) => {
      const v = f(j);
      return v === null ? [] : [v];
    });

  const stars = (from: number, to: number) =>
    ratings
      .filter(
        (r) =>
          r.mechanicId === mechanic.userId &&
          ratedBy(r) === 'customer' &&
          Date.parse(r.createdAt) >= from &&
          Date.parse(r.createdAt) < to,
      )
      .map((r) => r.stars);
  const t = now.getTime();
  const recent = stars(t - 30 * DAY_MS, t + 1);
  const previous = stars(t - 60 * DAY_MS, t - 30 * DAY_MS);
  const rating = {
    recent: avg(recent),
    recentCount: recent.length,
    previous: avg(previous),
    previousCount: previous.length,
  };
  const ratingTrend =
    rating.recent === null ||
    rating.previous === null ||
    recent.length < SIGNALS.minRatings ||
    previous.length < SIGNALS.minRatings
      ? null
      : rating.recent - rating.previous >= SIGNALS.trendStars
        ? 'up'
        : rating.previous - rating.recent >= SIGNALS.trendStars
          ? 'down'
          : 'steady';

  const accepted = mine.length;
  const cancelShare = accepted ? mechanicCancels / accepted : null;
  const medianLateMin = median(values(lateMinutes));
  const signals: Signal[] = [];
  const onTime = medianLateMin === null || medianLateMin < SIGNALS.lateMin;
  if (!onTime) signals.push('often-late');
  if (
    accepted >= SIGNALS.minAccepted &&
    cancelShare !== null &&
    cancelShare >= SIGNALS.cancelShare
  ) {
    signals.push('cancels-often');
  }
  if (ratingTrend === 'down') signals.push('rating-falling');
  if (
    rating.recent !== null &&
    recent.length >= SIGNALS.minRatings &&
    rating.recent < SIGNALS.lowRating
  ) {
    signals.push('low-rating');
  }
  if (overdueWeeks) signals.push('payment-overdue');
  if (
    overdueWeeks &&
    overdueWeeks >= SUGGEST_SUSPENSION_AFTER_WEEKS &&
    mechanic.vetting === 'verified'
  ) {
    signals.push('suspension-suggested');
  }

  // Presence: averaged over the days the log actually covers, never over days before it.
  const t0 = now.getTime() - 28 * DAY_MS;
  const firstLogged = presence?.availability.length
    ? Math.min(...presence.availability.map((e) => Date.parse(e.at)))
    : null;
  const from = firstLogged === null ? null : Math.max(t0, firstLogged);
  const presenceDays = from === null ? 0 : Math.max(0, (now.getTime() - from) / DAY_MS);
  const onlineHoursPerWeek =
    from === null || presenceDays < 1
      ? null
      : (hoursOnline(
          onlineStretches(presence!.availability, mechanic.userId, now),
          from,
          now.getTime(),
        ) /
          presenceDays) *
        7;
  if (
    onlineHoursPerWeek !== null &&
    presenceDays >= 7 &&
    onlineHoursPerWeek < SIGNALS.minOnlineHours
  ) {
    signals.push('rarely-online');
  }
  const alerts =
    presence && presence.offers.length
      ? offerStats(presence.offers, new Map(jobs.map((j) => [j.id, j])), mechanic.userId)
      : null;
  if (
    alerts &&
    alerts.offers >= SIGNALS.minOffers &&
    alerts.ignored / alerts.offers >= SIGNALS.ignoredShare
  ) {
    signals.push('ignores-alerts');
  }
  if (
    signals.length === 0 &&
    jobsPerWeek >= SIGNALS.topJobsPerWeek &&
    rating.recent !== null &&
    rating.recent >= SIGNALS.topRating &&
    onTime
  ) {
    signals.unshift('top');
  }

  return {
    mechanic,
    weekly,
    jobsPerWeek,
    accepted,
    completed: completedAt.length,
    mechanicCancels,
    cancelShare,
    medianArrivalMin: median(values(arrivalMinutes)),
    medianLateMin,
    rating,
    ratingTrend,
    overdueWeeks,
    onlineHoursPerWeek,
    presenceDays: Math.round(presenceDays),
    alerts,
    signals,
  };
}

/** Who belongs in the ranked table: anyone verified or suspended, or with jobs in the data. */
export function scoredMechanics(
  mechanics: readonly MechanicDoc[],
  jobs: readonly Job[],
): MechanicDoc[] {
  const withJobs = new Set(jobs.flatMap((j) => (j.mechanicId ? [j.mechanicId] : [])));
  return mechanics.filter((m) => m.vetting !== 'pending' || withJobs.has(m.userId));
}
