import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import { weekLabel } from '../../src/lib/subscriptions';
import { MAX_REASON } from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import { isVoided, type SubscriptionPayment } from '../../src/types/subscriptions';

import type { Caller } from './setUserRole';

export interface VoidTx {
  getPayment(id: string): Promise<SubscriptionPayment | null>;
  getBusinessName(mechanicId: string): Promise<string>;
  updatePayment(id: string, fields: Partial<SubscriptionPayment>): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface VoidDeps {
  transact(run: (tx: VoidTx) => Promise<void>): Promise<void>;
  now(): Date;
}

/**
 * Marks a recorded weekly payment as a mistake. The document is kept with the void details
 * (never deleted: the audit trail must stay complete); the week reads as unpaid again and a
 * correct payment can be recorded. Needs `revenue.markPaid` (admin, ops). Audited.
 */
export async function voidSubscriptionPayment(
  caller: Caller | null,
  data: unknown,
  deps: VoidDeps,
) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'revenue.markPaid')) {
    throw new HttpsError('permission-denied', 'Your role cannot void payments.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const paymentId = typeof input.paymentId === 'string' ? input.paymentId.trim() : '';
  if (!paymentId || paymentId.includes('/')) {
    throw new HttpsError('invalid-argument', 'paymentId is required.');
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }

  await deps.transact(async (tx) => {
    const payment = await tx.getPayment(paymentId);
    if (!payment) throw new HttpsError('not-found', 'No payment with that id.');
    if (isVoided(payment)) throw new HttpsError('failed-precondition', 'Already voided.');
    const businessName = await tx.getBusinessName(payment.mechanicId);
    const at = deps.now().toISOString();
    tx.updatePayment(paymentId, {
      voidedAt: at,
      voidedBy: caller.uid,
      voidedByEmail: caller.email,
      voidReason: reason,
    });
    tx.audit({
      action: 'subscription.void',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'subscription',
      targetId: paymentId,
      targetLabel: `${businessName}, week of ${weekLabel(payment.weekStart)}`,
      before: 'paid',
      after: 'voided',
      reason,
      at,
    });
  });
  return { paymentId };
}
