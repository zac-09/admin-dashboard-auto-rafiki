import {
  isBillable,
  TRACKING_START,
  verifiedIntervals,
  weekStartOf,
  WEEKLY_FEE,
} from '@/lib/subscriptions';
import {
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
    if (this.payments.some((p) => p.id === id)) {
      throw new Error('That week is already recorded as paid.');
    }
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
