import { ratedBy } from '@/lib/ratings';
import { addWeeks, kampalaMidnight, weekStartOf } from '@/lib/subscriptions';
import type { AuditEntry, Job, MechanicDoc, Rating, SubscriptionPayment } from '@/types';

import { coverage, type CoverageArea } from './coverage';
import { enteredAt } from './jobFacts';
import { CONCERNS, scorecard, scoredMechanics, type Scorecard } from './scorecard';
import { weeklyTrends, type WeekPoint } from './trends';

const WEEK_MS = 7 * 86_400_000;

export interface ReportWeek extends WeekPoint {
  /** 0–1: of requests no longer waiting, the share a mechanic accepted. */
  acceptanceRate: number | null;
  /** 0–1: of accepted jobs that finished, the share completed. */
  completionRate: number | null;
  averageRating: number | null;
  ratings: number;
  newApplicants: number;
  approvals: number;
  suspensions: number;
}

export interface WeeklyReport {
  week: ReportWeek;
  previous: ReportWeek;
  /** The six weeks ending with the report's week, oldest first. */
  trend: WeekPoint[];
  /** Worst areas over the four weeks ending with the report's week. */
  gaps: CoverageArea[];
  /** Most completed jobs that week (at most 3). */
  top: Scorecard[];
  /** Mechanics with a concern signal at the end of the week. */
  concerns: Scorecard[];
}

export interface ReportInputs {
  jobs: readonly Job[];
  ratings: readonly Rating[];
  mechanics: readonly MechanicDoc[];
  entries: readonly AuditEntry[];
  payments: readonly SubscriptionPayment[];
  now: Date;
}

function inWeek(iso: string, weekStart: string): boolean {
  return weekStartOf(Date.parse(iso)) === weekStart;
}

function reportWeek(weekStart: string, d: ReportInputs): ReportWeek {
  const [point] = weeklyTrends([weekStart], d.jobs, d.mechanics, d.entries, d.payments, d.now);
  const requested = d.jobs.filter((j) => inWeek(j.request.createdAt, weekStart));
  const decided = requested.filter((j) => j.status !== 'requested');
  const accepted = decided.filter((j) => enteredAt(j, 'matched') !== null);
  const acceptedFinished = accepted.filter(
    (j) => j.status === 'complete' || j.status === 'cancelled',
  );
  const stars = d.ratings
    .filter((r) => ratedBy(r) === 'customer' && inWeek(r.createdAt, weekStart))
    .map((r) => r.stars);
  const decisions = d.entries.filter((e) => inWeek(e.at, weekStart));
  return {
    ...point!,
    acceptanceRate: decided.length ? accepted.length / decided.length : null,
    completionRate: acceptedFinished.length
      ? acceptedFinished.filter((j) => j.status === 'complete').length / acceptedFinished.length
      : null,
    averageRating: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
    ratings: stars.length,
    newApplicants: d.mechanics.filter((m) => m.createdAt && inWeek(m.createdAt, weekStart)).length,
    approvals: decisions.filter(
      (e) => e.action === 'mechanic.vetting.approve' && e.before === 'pending',
    ).length,
    suspensions: decisions.filter((e) => e.action === 'mechanic.vetting.suspend').length,
  };
}

/** Everything on the one-page weekly pilot report, as of the end of `weekStart`. */
export function weeklyReport(weekStart: string, d: ReportInputs): WeeklyReport {
  const weekEnd = new Date(Math.min(kampalaMidnight(weekStart) + WEEK_MS - 1, d.now.getTime()));
  const trendWeeks = Array.from({ length: 6 }, (_, i) => addWeeks(weekStart, i - 5));
  const fourWeeksFrom = kampalaMidnight(addWeeks(weekStart, -3));
  const gapJobs = d.jobs.filter((j) => {
    const at = Date.parse(j.request.createdAt);
    return at >= fourWeeksFrom && at <= weekEnd.getTime();
  });
  // Scorecards as they stood at the end of the week: nothing later counts.
  const asOf = d.jobs.filter((j) => Date.parse(j.request.createdAt) <= weekEnd.getTime());
  const ratingsAsOf = d.ratings.filter((r) => Date.parse(r.createdAt) <= weekEnd.getTime());
  const cards = scoredMechanics(d.mechanics, asOf).map((m) =>
    scorecard(m, asOf, ratingsAsOf, weekEnd),
  );
  const completedInWeek = (s: Scorecard) =>
    s.weekly.find((w) => w.weekStart === weekStart)?.completed ?? 0;
  return {
    week: reportWeek(weekStart, d),
    previous: reportWeek(addWeeks(weekStart, -1), d),
    trend: weeklyTrends(trendWeeks, d.jobs, d.mechanics, d.entries, d.payments, d.now),
    gaps: coverage(gapJobs, d.mechanics)
      .areas.filter((a) => a.unserved > 0)
      .slice(0, 5),
    top: cards
      .filter((s) => completedInWeek(s) > 0)
      .sort((a, b) => completedInWeek(b) - completedInWeek(a))
      .slice(0, 3),
    concerns: cards.filter((s) => s.signals.some((sig) => CONCERNS.includes(sig))),
  };
}

/** "up 3 from 9", "down 4 pts from 22%", "same as last week" — never colour alone. */
export function change(
  now: number | null,
  before: number | null,
  format: (v: number) => string,
): string {
  if (now === null || before === null) return 'no comparison';
  if (format(now) === format(before)) return 'same as the week before';
  return `${now > before ? 'up' : 'down'} from ${format(before)}`;
}
