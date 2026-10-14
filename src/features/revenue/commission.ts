import { verifiedDuring } from '@/features/insights/trends';
import { enteredAt } from '@/features/insights/jobFacts';
import { addWeeks, weekStartOf, WEEKLY_FEE } from '@/lib/subscriptions';
import type { AuditEntry, Job, MechanicDoc } from '@/types';

/** The rates the simulator offers in one click; any whole percent 1–30 can be typed. */
export const PRESET_RATES = [0.05, 0.1, 0.15, 0.2] as const;
export const MIN_RATE = 0.01;
export const MAX_RATE = 0.3;

/** The last `count` full weeks (this week excluded: it is not over), oldest first. */
export function fullWeeks(count: number, now: Date): string[] {
  const current = weekStartOf(now);
  return Array.from({ length: count }, (_, i) => addWeeks(current, i - count));
}

export interface CommissionWeek {
  weekStart: string;
  completed: number;
  /** Call-out fees of jobs completed that week (UGX). */
  fees: number;
  commission: number;
  /** What the flat subscription asks for that week: verified mechanics × UGX 15,000. */
  subscriptions: number;
}

export interface MechanicComparison {
  mechanic: MechanicDoc;
  completed: number;
  fees: number;
  commission: number;
  /** Flat fee for the weeks they were verified in the window. */
  subscriptions: number;
  /** Commission minus subscription: positive means they would pay more under commission. */
  difference: number;
}

export interface CommissionModel {
  rate: number;
  weeks: CommissionWeek[];
  totals: { completed: number; fees: number; commission: number; subscriptions: number };
  /** The commission rate that would have matched the flat subscription (null without fees). */
  breakEvenRate: number | null;
  mechanics: MechanicComparison[];
}

/**
 * Phase 2 what-if: the same completed jobs under a commission on the fee instead of the
 * Phase 1 weekly subscription. The fee is the call-out fee fixed at request; whatever is
 * agreed on site for parts and labour is not recorded, so commission here is a floor.
 */
export function commissionModel(
  weeks: readonly string[],
  jobs: readonly Job[],
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  rate: number,
): CommissionModel {
  const completedIn = (weekStart: string, mechanicId?: string) =>
    jobs.filter((j) => {
      const done = enteredAt(j, 'complete');
      return (
        done !== null &&
        weekStartOf(done) === weekStart &&
        (mechanicId === undefined || j.mechanicId === mechanicId)
      );
    });
  const feesOf = (js: readonly Job[]) => js.reduce((s, j) => s + j.fee, 0);

  const weekRows = weeks.map((weekStart): CommissionWeek => {
    const done = completedIn(weekStart);
    const fees = feesOf(done);
    return {
      weekStart,
      completed: done.length,
      fees,
      commission: fees * rate,
      subscriptions:
        mechanics.filter((m) => verifiedDuring(m, entries, weekStart)).length * WEEKLY_FEE,
    };
  });
  const totals = weekRows.reduce(
    (t, w) => ({
      completed: t.completed + w.completed,
      fees: t.fees + w.fees,
      commission: t.commission + w.commission,
      subscriptions: t.subscriptions + w.subscriptions,
    }),
    { completed: 0, fees: 0, commission: 0, subscriptions: 0 },
  );

  const comparisons = mechanics
    .map((mechanic): MechanicComparison => {
      const done = weeks.flatMap((w) => completedIn(w, mechanic.userId));
      const fees = feesOf(done);
      const subscriptions =
        weeks.filter((w) => verifiedDuring(mechanic, entries, w)).length * WEEKLY_FEE;
      return {
        mechanic,
        completed: done.length,
        fees,
        commission: fees * rate,
        subscriptions,
        difference: fees * rate - subscriptions,
      };
    })
    .filter((c) => c.completed > 0 || c.subscriptions > 0)
    .sort(
      (a, b) => b.fees - a.fees || a.mechanic.businessName.localeCompare(b.mechanic.businessName),
    );

  return {
    rate,
    weeks: weekRows,
    totals,
    breakEvenRate: totals.fees ? totals.subscriptions / totals.fees : null,
    mechanics: comparisons,
  };
}

/** Jobs a week at the average fee for commission to match UGX 15,000 (null without fees). */
export function breakEvenJobsPerWeek(averageFee: number, rate: number): number | null {
  return averageFee > 0 && rate > 0 ? WEEKLY_FEE / (averageFee * rate) : null;
}
