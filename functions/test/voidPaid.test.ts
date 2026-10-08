import type { AuditEntry } from '../../src/types/audit';
import type { SubscriptionPayment } from '../../src/types/subscriptions';
import type { Caller } from '../src/setUserRole';
import { voidSubscriptionPayment, type VoidDeps } from '../src/voidPaid';

const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };

function world() {
  const payments: Record<string, SubscriptionPayment> = {
    'm1_2026-10-05': {
      id: 'm1_2026-10-05',
      mechanicId: 'm1',
      weekStart: '2026-10-05',
      amount: 15_000,
      method: 'cash',
      reference: null,
      paidAt: '2026-10-06T09:00:00.000Z',
      recordedBy: 'o1',
      recordedByEmail: 'ops@autorafiki.test',
    },
  };
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: VoidDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      await run({
        getPayment: async (id) => (payments[id] ? structuredClone(payments[id]) : null),
        getBusinessName: async () => 'Okello Auto Rescue',
        updatePayment: (id, f) => writes.push(() => Object.assign(payments[id]!, f)),
        audit: (e) => writes.push(() => audit.push(e)),
      });
      writes.forEach((w) => w());
    },
    now: () => new Date('2026-10-08T10:00:00.000Z'),
  };
  return { deps, payments, audit };
}

describe('voidSubscriptionPayment', () => {
  it('keeps the record, marks it void with who and why, and audits it', async () => {
    const w = world();
    await voidSubscriptionPayment(
      OPS,
      { paymentId: 'm1_2026-10-05', reason: 'Recorded against the wrong mechanic' },
      w.deps,
    );
    expect(w.payments['m1_2026-10-05']).toMatchObject({
      amount: 15_000, // untouched
      voidedAt: '2026-10-08T10:00:00.000Z',
      voidedBy: 'o1',
      voidReason: 'Recorded against the wrong mechanic',
    });
    expect(w.audit).toEqual([
      expect.objectContaining({
        action: 'subscription.void',
        targetId: 'm1_2026-10-05',
        targetLabel: 'Okello Auto Rescue, week of 5–11 Oct 2026',
        before: 'paid',
        after: 'voided',
      }),
    ]);
  });

  it('cannot void twice, void a missing payment, or skip the reason', async () => {
    const w = world();
    await voidSubscriptionPayment(OPS, { paymentId: 'm1_2026-10-05', reason: 'x' }, w.deps);
    await expect(
      voidSubscriptionPayment(OPS, { paymentId: 'm1_2026-10-05', reason: 'y' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      voidSubscriptionPayment(OPS, { paymentId: 'nope', reason: 'y' }, w.deps),
    ).rejects.toMatchObject({ code: 'not-found' });
    await expect(
      voidSubscriptionPayment(OPS, { paymentId: 'm1_2026-10-05' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(w.audit).toHaveLength(1);
  });

  it('support cannot void', async () => {
    const w = world();
    await expect(
      voidSubscriptionPayment(
        { ...OPS, role: 'support' },
        { paymentId: 'm1_2026-10-05', reason: 'x' },
        w.deps,
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
