/**
 * Phase-1 subscription billing rules (decided with Isaac, 2026-10-06). Pure functions, shared
 * by the dashboard and the markSubscriptionPaid Cloud Function.
 *
 * - UGX 15,000 per mechanic per week.
 * - Weeks run Monday 00:00 → Sunday, Kampala time (UTC+3, no daylight saving).
 * - A week is due on its Monday and overdue from OVERDUE_AFTER_DAYS later if still unpaid.
 * - Every mechanic who was verified at any moment during a week owes that week; weeks spent
 *   entirely pending or suspended are not billed.
 * - Nothing is billed before TRACKING_START (the tracker's first week). Mechanics verified
 *   before the dashboard existed (no approval in the audit log) are billed from then.
 */
import type { AuditEntry } from '../types/audit';
import type { MySubscription, SubscriptionWeek, Ugx } from '../types/domain';
import type { MechanicDoc } from '../types/firestore';
import { isVoided, type SubscriptionPayment } from '../types/subscriptions';

export const WEEKLY_FEE: Ugx = 15_000;
export const OVERDUE_AFTER_DAYS = 3;
/**
 * Isaac's rule (2026-10-15): at this many overdue weeks the dashboard SUGGESTS suspension.
 * It never suspends on its own; ops confirm through the normal audited decision.
 */
export const SUGGEST_SUSPENSION_AFTER_WEEKS = 2;
/** The Monday the tracker went live. */
export const TRACKING_START = '2026-10-05';

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const KAMPALA_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Start of a Kampala calendar date ("2026-10-05") as an instant. */
export function kampalaMidnight(date: string): number {
  return Date.parse(`${date}T00:00:00+03:00`);
}

/** The Monday (Kampala date) of the week containing `at`. */
export function weekStartOf(at: Date | number): string {
  const local = new Date((typeof at === 'number' ? at : at.getTime()) + KAMPALA_OFFSET_MS);
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCDate(local.getUTCDate() - sinceMonday);
  return local.toISOString().slice(0, 10);
}

export function addWeeks(weekStart: string, weeks: number): string {
  return weekStartOf(kampalaMidnight(weekStart) + weeks * WEEK_MS + DAY_MS);
}

export function isMonday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && weekStartOf(kampalaMidnight(date)) === date;
}

/** Weeks from `from` to `to` inclusive, oldest first. */
export function weeksBetween(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let w = from; w <= to; w = addWeeks(w, 1)) weeks.push(w);
  return weeks;
}

/** "5–11 Oct 2026". */
export function weekLabel(weekStart: string): string {
  const start = new Date(kampalaMidnight(weekStart) + KAMPALA_OFFSET_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  const day = (d: Date) => d.getUTCDate();
  const month = (d: Date) => d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  const year = end.getUTCFullYear();
  return start.getUTCMonth() === end.getUTCMonth()
    ? `${day(start)}–${day(end)} ${month(end)} ${year}`
    : `${day(start)} ${month(start)} – ${day(end)} ${month(end)} ${year}`;
}

interface Interval {
  from: number;
  to: number;
}

/**
 * When the mechanic was verified, from their vetting decisions (any order). An approval opens a
 * verified stretch; a suspension closes it; a re-verification of an already-verified mechanic
 * changes nothing. Verified now with no approval on record = verified since TRACKING_START.
 */
export function verifiedIntervals(
  mechanic: Pick<MechanicDoc, 'userId' | 'vetting'>,
  entries: readonly Pick<AuditEntry, 'action' | 'targetId' | 'at'>[],
): Interval[] {
  const decisions = entries
    .filter(
      (e) =>
        e.targetId === mechanic.userId &&
        (e.action === 'mechanic.vetting.approve' || e.action === 'mechanic.vetting.suspend'),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const intervals: Interval[] = [];
  let openedAt: number | null = null;
  for (const d of decisions) {
    const at = Date.parse(d.at);
    if (d.action === 'mechanic.vetting.approve' && openedAt === null) openedAt = at;
    if (d.action === 'mechanic.vetting.suspend' && openedAt !== null) {
      intervals.push({ from: openedAt, to: at });
      openedAt = null;
    }
  }
  if (openedAt !== null) intervals.push({ from: openedAt, to: Infinity });
  if (mechanic.vetting === 'verified' && decisions.length === 0) {
    intervals.push({ from: kampalaMidnight(TRACKING_START), to: Infinity });
  }
  return intervals;
}

/** Owes `weekStart`: verified at any moment that week, and not before the tracker started. */
export function isBillable(intervals: readonly Interval[], weekStart: string): boolean {
  if (weekStart < TRACKING_START) return false;
  const from = kampalaMidnight(weekStart);
  const to = from + WEEK_MS;
  return intervals.some((i) => i.from < to && i.to > from);
}

export type WeekStatus = 'paid' | 'due' | 'overdue';

export function weekStatus(
  payment: SubscriptionPayment | undefined,
  weekStart: string,
  now: Date,
): WeekStatus {
  if (payment) return 'paid';
  const overdueFrom = kampalaMidnight(weekStart) + OVERDUE_AFTER_DAYS * DAY_MS;
  return now.getTime() >= overdueFrom ? 'overdue' : 'due';
}

export interface MechanicWeek {
  mechanic: MechanicDoc;
  status: WeekStatus;
  payment?: SubscriptionPayment;
  /** Earlier billable weeks still unpaid (the arrears this mechanic carries). */
  unpaidEarlier: string[];
}

export interface WeekSummary {
  weekStart: string;
  rows: MechanicWeek[];
  expected: Ugx;
  collected: Ugx;
  counts: Record<WeekStatus, number>;
}

/** Everyone who owes `weekStart`, their status, and the week's totals. */
export function summarizeWeek(
  weekStart: string,
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  payments: readonly SubscriptionPayment[],
  now: Date,
): WeekSummary {
  // Voided records stay in the collection but no longer count as payment.
  const paid = new Map(
    payments.filter((p) => !isVoided(p)).map((p) => [`${p.mechanicId}_${p.weekStart}`, p]),
  );
  const current = weekStartOf(now);
  const rows: MechanicWeek[] = [];
  for (const mechanic of mechanics) {
    const intervals = verifiedIntervals(mechanic, entries);
    if (!isBillable(intervals, weekStart)) continue;
    const payment = paid.get(`${mechanic.userId}_${weekStart}`);
    const unpaidEarlier = weeksBetween(TRACKING_START, addWeeks(weekStart, -1)).filter(
      (w) => w <= current && isBillable(intervals, w) && !paid.has(`${mechanic.userId}_${w}`),
    );
    rows.push({ mechanic, status: weekStatus(payment, weekStart, now), payment, unpaidEarlier });
  }
  const order: Record<WeekStatus, number> = { overdue: 0, due: 1, paid: 2 };
  rows.sort(
    (a, b) =>
      order[a.status] - order[b.status] ||
      a.mechanic.businessName.localeCompare(b.mechanic.businessName),
  );
  const counts = { paid: 0, due: 0, overdue: 0 };
  for (const r of rows) counts[r.status] += 1;
  return {
    weekStart,
    rows,
    expected: rows.length * WEEKLY_FEE,
    collected: rows.reduce((sum, r) => sum + (r.payment?.amount ?? 0), 0),
    counts,
  };
}

/** How many billable weeks the mechanic's own view lists (newest first). */
export const MY_WEEKS_SHOWN = 12;

/**
 * The signed-in mechanic's own subscription (getMySubscription, app contract 2026-10-16):
 * the same rules as the tracker, for one mechanic. Never carries who recorded a payment, a
 * reference or a void reason. A mechanic never verified (or no mechanic at all) owes nothing.
 */
export function mySubscription(
  mechanic: Pick<MechanicDoc, 'userId' | 'vetting'> | null,
  entries: readonly AuditEntry[],
  payments: readonly SubscriptionPayment[],
  payTo: MySubscription['payTo'],
  now: Date,
): MySubscription {
  const base = {
    weeklyFee: WEEKLY_FEE,
    overdueAfterDays: OVERDUE_AFTER_DAYS,
    suspensionAfterOverdueWeeks: SUGGEST_SUSPENSION_AFTER_WEEKS,
    payTo,
    computedAt: now.toISOString(),
  };
  if (!mechanic) return { ...base, weeks: [], owed: 0, overdueCount: 0 };
  const intervals = verifiedIntervals(mechanic, entries);
  const paid = new Map(
    payments
      .filter((p) => p.mechanicId === mechanic.userId && !isVoided(p))
      .map((p) => [p.weekStart, p]),
  );
  const all: SubscriptionWeek[] = weeksBetween(TRACKING_START, weekStartOf(now))
    .filter((w) => isBillable(intervals, w))
    .reverse()
    .map((weekStart) => {
      const payment = paid.get(weekStart);
      return {
        weekStart,
        status: weekStatus(payment, weekStart, now),
        amount: payment?.amount ?? WEEKLY_FEE,
        paidAt: payment?.paidAt ?? null,
        method: payment?.method ?? null,
      };
    });
  const unpaid = all.filter((w) => w.status !== 'paid');
  return {
    ...base,
    weeks: all.slice(0, MY_WEEKS_SHOWN),
    owed: unpaid.reduce((sum, w) => sum + w.amount, 0),
    overdueCount: all.filter((w) => w.status === 'overdue').length,
  };
}
