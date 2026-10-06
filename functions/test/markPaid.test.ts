import type { AuditEntry } from '../../src/types/audit';
import type { SubscriptionPayment } from '../../src/types/subscriptions';
import { markSubscriptionPaid, type MarkPaidDeps } from '../src/markPaid';
import type { Caller } from '../src/setUserRole';

const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };

function world(now = '2026-10-15T09:00:00Z') {
  const mechanics = {
    m1: { userId: 'm1', vetting: 'verified' as const, businessName: 'Okello Auto Rescue' },
    m2: { userId: 'm2', vetting: 'pending' as const, businessName: 'Kato Battery' },
  };
  const history: Record<string, Pick<AuditEntry, 'action' | 'targetId' | 'at'>[]> = {
    m1: [],
    m2: [],
  };
  const payments: Record<string, SubscriptionPayment> = {};
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: MarkPaidDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      await run({
        getMechanic: async (id) => mechanics[id as keyof typeof mechanics] ?? null,
        getVettingHistory: async (id) => history[id] ?? [],
        getPayment: async (id) => payments[id] ?? null,
        createPayment: (p) => writes.push(() => (payments[p.id] = p)),
        audit: (e) => writes.push(() => audit.push(e)),
      });
      writes.forEach((w) => w());
    },
    now: () => new Date(now),
  };
  return { deps, payments, audit, history };
}

const input = {
  mechanicId: 'm1',
  weekStart: '2026-10-12',
  method: 'mobile-money',
  reference: ' MP2610151234 ',
};

describe('markSubscriptionPaid', () => {
  it('records UGX 15,000 for the week, with method and reference, audited', async () => {
    const w = world();
    expect(await markSubscriptionPaid(OPS, input, w.deps)).toEqual({
      id: 'm1_2026-10-12',
      amount: 15_000,
    });
    expect(w.payments['m1_2026-10-12']).toMatchObject({
      mechanicId: 'm1',
      weekStart: '2026-10-12',
      amount: 15_000,
      method: 'mobile-money',
      reference: 'MP2610151234',
      recordedByEmail: 'ops@autorafiki.test',
    });
    expect(w.audit).toEqual([
      expect.objectContaining({
        action: 'subscription.paid',
        targetType: 'subscription',
        targetId: 'm1_2026-10-12',
        targetLabel: 'Okello Auto Rescue, week of 12–18 Oct 2026',
        after: 'paid',
        reason: 'mobile-money: MP2610151234',
      }),
    ]);
  });

  it('refuses a second payment for the same week', async () => {
    const w = world();
    await markSubscriptionPaid(OPS, input, w.deps);
    await expect(markSubscriptionPaid(OPS, input, w.deps)).rejects.toMatchObject({
      code: 'already-exists',
    });
    expect(w.audit).toHaveLength(1);
  });

  it('refuses mechanics who did not owe that week', async () => {
    const w = world();
    await expect(
      markSubscriptionPaid(OPS, { ...input, mechanicId: 'm2' }, w.deps),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: 'Kato Battery did not owe that week.',
    });
    w.history.m1 = [
      { action: 'mechanic.vetting.approve', targetId: 'm1', at: '2026-10-13T09:00:00Z' },
    ];
    await expect(
      markSubscriptionPaid(OPS, { ...input, weekStart: '2026-10-05' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it.each([
    [{ ...input, weekStart: '2026-10-13' }, /must be a Monday/],
    [{ ...input, weekStart: '2026-10-19' }, /not started yet/],
    [{ ...input, weekStart: '2026-09-28' }, /before subscriptions started/],
    [{ ...input, method: 'card' }, /how it was paid/],
    [{ ...input, mechanicId: '' }, /mechanicId is required/],
  ])('rejects %j', async (data, message) => {
    const w = world();
    await expect(markSubscriptionPaid(OPS, data, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringMatching(message),
    });
    expect(w.payments).toEqual({});
  });

  it('support and app users cannot record payments', async () => {
    const w = world();
    for (const caller of [
      { uid: 's', email: null, role: 'support' },
      { uid: 'u', email: null, role: undefined },
    ]) {
      await expect(markSubscriptionPaid(caller, input, w.deps)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    }
    await expect(markSubscriptionPaid(null, input, w.deps)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });

  it('accepts the current week from its Monday', async () => {
    const w = world('2026-10-11T21:00:00Z'); // Mon 12 Oct 00:00 Kampala
    await expect(markSubscriptionPaid(OPS, input, w.deps)).resolves.toMatchObject({
      amount: 15_000,
    });
  });
});
