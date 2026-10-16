import { HttpsError } from 'firebase-functions/v2/https';

import { checkPayTo, payToLine, type PayTo } from '../../src/lib/billing';
import { can } from '../../src/lib/permissions';
import { mySubscription } from '../../src/lib/subscriptions';
import { MAX_REASON } from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import type { MechanicDoc } from '../../src/types/firestore';
import type { SubscriptionPayment } from '../../src/types/subscriptions';

import type { Caller } from './setUserRole';

export interface MySubscriptionDeps {
  getMechanic(uid: string): Promise<Pick<MechanicDoc, 'userId' | 'vetting'> | null>;
  /** Vetting decisions about this mechanic (approve / suspend matter). */
  listDecisions(uid: string): Promise<AuditEntry[]>;
  listPayments(uid: string): Promise<SubscriptionPayment[]>;
  getPayTo(): Promise<PayTo | null>;
  now(): Date;
}

/**
 * The signed-in mechanic's own Phase-1 subscription (app contract 2026-10-16). Computed for
 * request.auth.uid only, never another uid, with the tracker's rules; the response carries
 * no staff fields, references or void reasons (see mySubscription).
 */
export async function getMySubscription(caller: Caller | null, deps: MySubscriptionDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const [mechanic, decisions, payments, payTo] = await Promise.all([
    deps.getMechanic(caller.uid),
    deps.listDecisions(caller.uid),
    deps.listPayments(caller.uid),
    deps.getPayTo(),
  ]);
  return mySubscription(mechanic, decisions, payments, payTo, deps.now());
}

export interface BillingDeps {
  transact(
    run: (tx: {
      get(): Promise<PayTo | null>;
      set(payTo: PayTo | null, at: string, by: string): void;
      audit(entry: Omit<AuditEntry, 'id'>): void;
    }) => Promise<void>,
  ): Promise<void>;
  now(): Date;
}

const describe = (p: PayTo | null) =>
  p ? `${p.numbers.map(payToLine).join('; ')}${p.note ? ` · ${p.note}` : ''}` : null;

/** Where mechanics pay (settings/billing). Admin only (`settings.edit`), audited. */
export async function updateBilling(caller: Caller | null, data: unknown, deps: BillingDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'settings.edit')) {
    throw new HttpsError('permission-denied', 'Only admins change payment numbers.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }
  const check = checkPayTo(input.payTo);
  if (!check.ok) {
    const [field, message] = Object.entries(check.errors)[0]!;
    throw new HttpsError('invalid-argument', `${field}: ${message}`);
  }
  await deps.transact(async (tx) => {
    const before = await tx.get();
    if (describe(before) === describe(check.payTo)) {
      throw new HttpsError('failed-precondition', 'Nothing changed.');
    }
    const at = deps.now().toISOString();
    tx.set(check.payTo, at, caller.uid);
    tx.audit({
      action: 'billing.update',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'settings',
      targetId: 'billing',
      targetLabel: check.payTo ? 'Payment numbers for subscriptions' : 'Payment numbers cleared',
      before: describe(before),
      after: describe(check.payTo),
      reason,
      at,
    });
  });
  return { payTo: check.payTo };
}
