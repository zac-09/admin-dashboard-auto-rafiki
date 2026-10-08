import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import {
  isBillable,
  isMonday,
  TRACKING_START,
  verifiedIntervals,
  weekLabel,
  weekStartOf,
  WEEKLY_FEE,
} from '../../src/lib/subscriptions';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import type { MechanicDoc } from '../../src/types/firestore';
import {
  isVoided,
  PAYMENT_METHODS,
  paymentId,
  type PaymentMethod,
  type SubscriptionPayment,
} from '../../src/types/subscriptions';

import type { Caller } from './setUserRole';

export interface MarkPaidTx {
  getMechanic(id: string): Promise<Pick<MechanicDoc, 'userId' | 'vetting' | 'businessName'> | null>;
  /** The mechanic's approve / suspend history (to check they owed that week). */
  getVettingHistory(id: string): Promise<Pick<AuditEntry, 'action' | 'targetId' | 'at'>[]>;
  getPayment(id: string): Promise<SubscriptionPayment | null>;
  createPayment(payment: SubscriptionPayment): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface MarkPaidDeps {
  transact(run: (tx: MarkPaidTx) => Promise<void>): Promise<void>;
  now(): Date;
}

/**
 * Records one mechanic's weekly UGX 15,000 as paid (v1 has no payment rails, so ops records it
 * by hand). Needs `revenue.markPaid` (admin, ops). Audited. One payment per mechanic per week.
 */
export async function markSubscriptionPaid(
  caller: Caller | null,
  data: unknown,
  deps: MarkPaidDeps,
) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'revenue.markPaid')) {
    throw new HttpsError('permission-denied', 'Your role cannot record payments.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const mechanicId = typeof input.mechanicId === 'string' ? input.mechanicId.trim() : '';
  const weekStart = typeof input.weekStart === 'string' ? input.weekStart : '';
  if (!mechanicId) throw new HttpsError('invalid-argument', 'mechanicId is required.');
  if (!isMonday(weekStart)) {
    throw new HttpsError('invalid-argument', 'weekStart must be a Monday (YYYY-MM-DD).');
  }
  const now = deps.now();
  if (weekStart > weekStartOf(now)) {
    throw new HttpsError('invalid-argument', 'That week has not started yet.');
  }
  if (weekStart < TRACKING_START) {
    throw new HttpsError('invalid-argument', 'That week is before subscriptions started.');
  }
  if (!PAYMENT_METHODS.includes(input.method as PaymentMethod)) {
    throw new HttpsError('invalid-argument', 'Choose how it was paid.');
  }
  const method = input.method as PaymentMethod;
  const reference =
    typeof input.reference === 'string' && input.reference.trim()
      ? input.reference.trim().slice(0, 120)
      : null;

  await deps.transact(async (tx) => {
    const mechanic = await tx.getMechanic(mechanicId);
    if (!mechanic) throw new HttpsError('not-found', 'No mechanic with that id.');
    const history = await tx.getVettingHistory(mechanicId);
    const id = paymentId(mechanicId, weekStart);
    const existing = await tx.getPayment(id);
    // A voided record may be replaced by a correct one; a live one may not.
    if (existing && !isVoided(existing)) {
      throw new HttpsError('already-exists', 'That week is already recorded as paid.');
    }
    if (!isBillable(verifiedIntervals(mechanic, history), weekStart)) {
      throw new HttpsError(
        'failed-precondition',
        `${mechanic.businessName} did not owe that week.`,
      );
    }
    const at = now.toISOString();
    tx.createPayment({
      id,
      mechanicId,
      weekStart,
      amount: WEEKLY_FEE,
      method,
      reference,
      paidAt: at,
      recordedBy: caller.uid,
      recordedByEmail: caller.email,
    });
    tx.audit({
      action: 'subscription.paid',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'subscription',
      targetId: id,
      targetLabel: `${mechanic.businessName}, week of ${weekLabel(weekStart)}`,
      before: null,
      after: 'paid',
      reason: reference ? `${method}: ${reference}` : method,
      at,
    });
  });
  return { id: paymentId(mechanicId, weekStart), amount: WEEKLY_FEE };
}
