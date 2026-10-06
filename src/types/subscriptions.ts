import type { IsoDate, Ugx } from './domain';

/**
 * subscriptions/{mechanicId}_{weekStart}: one recorded weekly payment (Phase 1, UGX 15,000).
 * Only payments are stored; what is owed is computed from the billing rules in
 * src/lib/subscriptions.ts and each mechanic's vetting history. Written by the
 * `markSubscriptionPaid` callable only (audited); staff read; app users never see it.
 */
export const SUBSCRIPTIONS = 'subscriptions';

export type PaymentMethod = 'mobile-money' | 'cash' | 'bank' | 'other';

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['mobile-money', 'cash', 'bank', 'other'];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'mobile-money': 'Mobile money',
  cash: 'Cash',
  bank: 'Bank transfer',
  other: 'Other',
};

export interface SubscriptionPayment {
  /** `${mechanicId}_${weekStart}` */
  id: string;
  mechanicId: string;
  /** Monday of the week paid for, Kampala date (YYYY-MM-DD). */
  weekStart: string;
  amount: Ugx;
  method: PaymentMethod;
  /** Mobile-money transaction id, receipt number… optional. */
  reference: string | null;
  paidAt: IsoDate;
  recordedBy: string;
  recordedByEmail: string | null;
}

export function paymentId(mechanicId: string, weekStart: string): string {
  return `${mechanicId}_${weekStart}`;
}
