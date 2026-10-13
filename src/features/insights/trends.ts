import { median } from '@/features/revenue/kpis';
import {
  addWeeks,
  kampalaMidnight,
  summarizeWeek,
  TRACKING_START,
  verifiedIntervals,
  weekStartOf,
} from '@/lib/subscriptions';
import {
  isVoided,
  type AuditEntry,
  type Job,
  type MechanicDoc,
  type SubscriptionPayment,
} from '@/types';

import { arrivalMinutes, enteredAt, isUnserved } from './jobFacts';

const WEEK_MS = 7 * 86_400_000;

export interface WeekPoint {
  weekStart: string;
  /** This week is still running: its numbers are so far, not final. */
  partial: boolean;
  requests: number;
  completed: number;
  /** Mechanics verified at any moment of the week. */
  verified: number;
  /** Completed jobs ÷ verified mechanics: the pilot's make-or-break number. */
  jobsPerMechanic: number | null;
  /** Median minutes from request to arrival for that week's requests. */
  medianArrivalMin: number | null;
  /** 0–1 of that week's finished requests nobody took. */
  unservedShare: number | null;
  /** UGX collected for the week (null before the tracker started). */
  collected: number | null;
  expected: number | null;
}

/** The last `count` weeks ending with the current one, oldest first (Kampala Mondays). */
export function lastWeeks(count: number, now: Date): string[] {
  const current = weekStartOf(now);
  return Array.from({ length: count }, (_, i) => addWeeks(current, i - count + 1));
}

/**
 * Verified at any moment of the week. Unlike billing, which starts at TRACKING_START, a
 * mechanic verified before the dashboard existed (no decision on record) counts in every
 * week: they were taking jobs.
 */
function verifiedDuring(
  mechanic: MechanicDoc,
  entries: readonly AuditEntry[],
  weekStart: string,
): boolean {
  const decided = entries.some(
    (e) =>
      e.targetId === mechanic.userId &&
      (e.action === 'mechanic.vetting.approve' || e.action === 'mechanic.vetting.suspend'),
  );
  if (!decided) return mechanic.vetting === 'verified';
  const from = kampalaMidnight(weekStart);
  return verifiedIntervals(mechanic, entries).some((i) => i.from < from + WEEK_MS && i.to > from);
}

export function weeklyTrends(
  weeks: readonly string[],
  jobs: readonly Job[],
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  payments: readonly SubscriptionPayment[],
  now: Date,
): WeekPoint[] {
  const current = weekStartOf(now);
  return weeks.map((weekStart) => {
    const requested = jobs.filter(
      (j) => weekStartOf(Date.parse(j.request.createdAt)) === weekStart,
    );
    const completed = jobs.filter((j) => {
      const done = enteredAt(j, 'complete');
      return done !== null && weekStartOf(done) === weekStart;
    }).length;
    const verified = mechanics.filter((m) => verifiedDuring(m, entries, weekStart)).length;
    const finished = requested.filter((j) => j.status === 'complete' || j.status === 'cancelled');
    const arrivals = requested.flatMap((j) => {
      const m = arrivalMinutes(j);
      return m === null ? [] : [m];
    });
    const tracked = weekStart >= TRACKING_START;
    return {
      weekStart,
      partial: weekStart === current,
      requests: requested.length,
      completed,
      verified,
      jobsPerMechanic: verified ? completed / verified : null,
      medianArrivalMin: median(arrivals),
      unservedShare: finished.length ? finished.filter(isUnserved).length / finished.length : null,
      collected: tracked
        ? payments
            .filter((p) => p.weekStart === weekStart && !isVoided(p))
            .reduce((s, p) => s + p.amount, 0)
        : null,
      expected: tracked
        ? summarizeWeek(weekStart, mechanics, entries, payments, now).expected
        : null,
    };
  });
}
