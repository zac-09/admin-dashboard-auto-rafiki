import {
  isBillable,
  TRACKING_START,
  verifiedIntervals,
  weekStartOf,
  WEEKLY_FEE,
} from '@/lib/subscriptions';
import {
  isVoided,
  paymentId,
  type Job,
  type PaymentMethod,
  type Rating,
  type RevenueRepository,
  type SubscriptionPayment,
} from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';
import type { MockOperationsStore } from './mockOperationsRepository';
import type { MockVettingStore } from './mockVettingRepositories';

/** Mirrors markSubscriptionPaid (functions/src/markPaid.ts) over the shared mock stores. */
export class MockRevenueRepository implements RevenueRepository {
  private payments: SubscriptionPayment[] = [];
  private readonly ops: MockOperationsStore;
  private readonly vetting: MockVettingStore;
  private readonly auth: MockAuthRepository;

  constructor(ops: MockOperationsStore, vetting: MockVettingStore, auth: MockAuthRepository) {
    this.ops = ops;
    this.vetting = vetting;
    this.auth = auth;
    // Demo: Namukasa paid this week by mobile money.
    const week = weekStartOf(new Date());
    if (week >= TRACKING_START) {
      this.payments.push({
        id: paymentId('u_mech_namukasa', week),
        mechanicId: 'u_mech_namukasa',
        weekStart: week,
        amount: WEEKLY_FEE,
        method: 'mobile-money',
        reference: 'MP-DEMO-0001',
        paidAt: new Date().toISOString(),
        recordedBy: 'staff-ops',
        recordedByEmail: 'ops@autorafiki.test',
      });
    }
  }

  async listPayments(fromWeek: string, toWeek: string) {
    return this.payments
      .filter((p) => p.weekStart >= fromWeek && p.weekStart <= toWeek)
      .map((p) => structuredClone(p));
  }

  async listJobsSince(sinceIso: string): Promise<Job[]> {
    return [...this.ops.jobs.values()].filter((j) => j.request.createdAt >= sinceIso);
  }

  async listRatingsSince(sinceIso: string): Promise<Rating[]> {
    return this.ops.ratings.filter((r) => r.createdAt >= sinceIso);
  }

  async voidPayment({ paymentId: id, reason }: { paymentId: string; reason: string }) {
    const actor = this.auth.current();
    if (!actor?.role || actor.role === 'support')
      throw new Error('Your role cannot void payments.');
    if (!reason.trim()) throw new Error('A reason is required.');
    const payment = this.payments.find((p) => p.id === id);
    if (!payment) throw new Error('No payment with that id.');
    if (isVoided(payment)) throw new Error('Already voided.');
    Object.assign(payment, {
      voidedAt: new Date().toISOString(),
      voidedBy: actor.uid,
      voidedByEmail: actor.email,
      voidReason: reason.trim(),
    });
    this.vetting.audit.push({
      id: `audit_mock_${this.vetting.audit.length + 1}`,
      action: 'subscription.void',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'subscription',
      targetId: id,
      targetLabel:
        this.vetting.mechanics.get(payment.mechanicId)?.businessName ?? payment.mechanicId,
      before: 'paid',
      after: 'voided',
      reason: reason.trim(),
      at: new Date().toISOString(),
    });
  }

  async markPaid(input: {
    mechanicId: string;
    weekStart: string;
    method: PaymentMethod;
    reference?: string;
  }) {
    const actor = this.auth.current();
    if (!actor?.role || actor.role === 'support') {
      throw new Error('Your role cannot record payments.');
    }
    const mechanic = this.vetting.mechanics.get(input.mechanicId);
    if (!mechanic) throw new Error('No mechanic with that id.');
    const id = paymentId(input.mechanicId, input.weekStart);
    if (this.payments.some((p) => p.id === id && !isVoided(p))) {
      throw new Error('That week is already recorded as paid.');
    }
    // A voided record is replaced by the new one (the real store keys by id too).
    this.payments = this.payments.filter((p) => p.id !== id);
    if (!isBillable(verifiedIntervals(mechanic, this.vetting.audit), input.weekStart)) {
      throw new Error(`${mechanic.businessName} did not owe that week.`);
    }
    const at = new Date().toISOString();
    this.payments.push({
      id,
      mechanicId: input.mechanicId,
      weekStart: input.weekStart,
      amount: WEEKLY_FEE,
      method: input.method,
      reference: input.reference?.trim() || null,
      paidAt: at,
      recordedBy: actor.uid,
      recordedByEmail: actor.email,
    });
    this.vetting.audit.push({
      id: `audit_mock_${this.vetting.audit.length + 1}`,
      action: 'subscription.paid',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'subscription',
      targetId: id,
      targetLabel: mechanic.businessName,
      before: null,
      after: 'paid',
      reason: input.method,
      at,
    });
  }
}
