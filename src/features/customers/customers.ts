import { ratedBy } from '@/lib/ratings';
import { isUnserved } from '@/features/insights/jobFacts';
import type { Job, Rating } from '@/types';

const DAY_MS = 86_400_000;

/** How the segments read the numbers (also stated on the page). */
export const CUSTOMER_RULES = {
  /** No request for this many days after being served at least once. */
  lapsedAfterDays: 30,
  /** Mechanics' average rating of the customer at or below this, over at least `minRatings`. */
  flaggedRating: 2.5,
  minRatings: 2,
} as const;

export interface CustomerSummary {
  customerId: string;
  requests: number;
  completed: number;
  unanswered: number;
  /** Cancelled by the customer after a mechanic accepted. */
  cancelledAfterMatch: number;
  firstRequestAt: string;
  lastRequestAt: string;
  /** How mechanics rated this customer. */
  ratedByMechanics: { average: number | null; count: number; lowest: number | null };
}

export type Segment = 'never-served' | 'lapsed' | 'repeat' | 'flagged';

export const SEGMENT_LABELS: Record<Segment, string> = {
  'never-served': 'Never served',
  lapsed: 'Lapsed',
  repeat: 'Repeat customers',
  flagged: 'Flagged by mechanics',
};

export function summarizeCustomers(
  jobs: readonly Job[],
  ratings: readonly Rating[],
): CustomerSummary[] {
  const byCustomer = new Map<string, Job[]>();
  for (const j of jobs) {
    const id = j.request.customerId;
    byCustomer.set(id, [...(byCustomer.get(id) ?? []), j]);
  }
  return [...byCustomer].map(([customerId, js]) => {
    const times = js.map((j) => j.request.createdAt).sort();
    const stars = ratings
      .filter((r) => r.customerId === customerId && ratedBy(r) === 'mechanic')
      .map((r) => r.stars);
    return {
      customerId,
      requests: js.length,
      completed: js.filter((j) => j.status === 'complete').length,
      unanswered: js.filter(isUnserved).length,
      cancelledAfterMatch: js.filter(
        (j) =>
          j.status === 'cancelled' &&
          j.cancelledBy === 'customer' &&
          j.timeline.some((t) => t.status === 'matched'),
      ).length,
      firstRequestAt: times[0]!,
      lastRequestAt: times.at(-1)!,
      ratedByMechanics: {
        average: stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : null,
        count: stars.length,
        lowest: stars.length ? Math.min(...stars) : null,
      },
    };
  });
}

/** The segments a customer falls into (a customer can be in more than one). */
export function segmentsOf(c: CustomerSummary, now: Date): Segment[] {
  const out: Segment[] = [];
  // Asked, and every time nobody came: the clearest churn risk.
  if (c.completed === 0 && c.unanswered > 0 && c.cancelledAfterMatch === 0) {
    out.push('never-served');
  }
  if (
    c.completed > 0 &&
    now.getTime() - Date.parse(c.lastRequestAt) > CUSTOMER_RULES.lapsedAfterDays * DAY_MS
  ) {
    out.push('lapsed');
  }
  if (c.completed >= 2) out.push('repeat');
  if (
    c.ratedByMechanics.count >= CUSTOMER_RULES.minRatings &&
    c.ratedByMechanics.average !== null &&
    c.ratedByMechanics.average <= CUSTOMER_RULES.flaggedRating
  ) {
    out.push('flagged');
  }
  return out;
}

export interface CustomerOverview {
  customers: number;
  repeatShare: number | null;
  /** Customers whose first request in the data is from the last 7 days. */
  newLast7Days: number;
}

export function overview(summaries: readonly CustomerSummary[], now: Date): CustomerOverview {
  const served = summaries.filter((c) => c.completed > 0);
  return {
    customers: summaries.length,
    repeatShare: served.length
      ? served.filter((c) => c.completed >= 2).length / served.length
      : null,
    newLast7Days: summaries.filter(
      (c) => now.getTime() - Date.parse(c.firstRequestAt) <= 7 * DAY_MS,
    ).length,
  };
}
