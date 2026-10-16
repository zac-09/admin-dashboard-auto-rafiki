import { payToLine, type PayTo } from '@/lib/billing';
import { formatUgx } from '@/lib/format';
import {
  SUGGEST_SUSPENSION_AFTER_WEEKS,
  summarizeWeek,
  weekLabel,
  weekStartOf,
  WEEKLY_FEE,
} from '@/lib/subscriptions';
import type { AuditEntry, MechanicDoc, SubscriptionPayment } from '@/types';

/** Isaac's rule lives with the billing rules; re-exported for the revenue screens. */
export { SUGGEST_SUSPENSION_AFTER_WEEKS };

/** A mechanic with at least one overdue week: who to chase, for what and how much. */
export interface OverdueAccount {
  mechanic: MechanicDoc;
  /** Overdue weeks (Monday dates), oldest first. */
  weeks: string[];
  amount: number;
}

/**
 * Everyone carrying overdue weeks right now, most weeks first. This week counts only once it
 * is overdue (from Thursday); earlier unpaid weeks are always overdue.
 */
export function overdueAccounts(
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  payments: readonly SubscriptionPayment[],
  now: Date,
): OverdueAccount[] {
  const current = weekStartOf(now);
  return summarizeWeek(current, mechanics, entries, payments, now)
    .rows.map((r) => {
      const weeks = [...r.unpaidEarlier, ...(r.status === 'overdue' ? [current] : [])];
      return { mechanic: r.mechanic, weeks, amount: weeks.length * WEEKLY_FEE };
    })
    .filter((a) => a.weeks.length > 0)
    .sort(
      (a, b) =>
        b.weeks.length - a.weeks.length ||
        a.mechanic.businessName.localeCompare(b.mechanic.businessName),
    );
}

/** A polite reminder ops can send as is, by SMS or WhatsApp; names where to pay once set. */
export function reminderMessage(account: OverdueAccount, payTo: PayTo | null = null): string {
  const weeks = account.weeks.map(weekLabel);
  const which =
    weeks.length === 1 ? `the week of ${weeks[0]}` : `${weeks.length} weeks (${weeks.join('; ')})`;
  return (
    `Hello ${account.mechanic.businessName}, this is AutoRafiki. ` +
    `Your weekly subscription of ${formatUgx(WEEKLY_FEE)} is overdue for ${which}. ` +
    `Total due: ${formatUgx(account.amount)}. ` +
    (payTo
      ? `Please pay by mobile money to ${payTo.numbers.map(payToLine).join(' or ')}` +
        `${payTo.note ? ` (${payTo.note.replace(/\.$/, '')})` : ''} and reply with your payment reference. Thank you.`
      : 'Please pay as soon as you can and reply with your payment reference. Thank you.')
  );
}

/** wa.me wants the number in international form without the plus. */
export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`;
}

export function suspensionSuggested(account: Pick<OverdueAccount, 'weeks'>): boolean {
  return account.weeks.length >= SUGGEST_SUSPENSION_AFTER_WEEKS;
}

/** The reason prefilled into the suspend decision (ops can edit it before saving). */
export function suspensionReason(account: OverdueAccount): string {
  return (
    `Subscription unpaid for ${account.weeks.length} weeks (${account.weeks.map(weekLabel).join('; ')}), ` +
    `${formatUgx(account.amount)} outstanding. Reinstate once paid.`
  );
}
