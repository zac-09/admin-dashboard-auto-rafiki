import type { PayTo } from '../../src/lib/billing';
import type { AuditEntry } from '../../src/types/audit';
import type { Caller } from '../src/setUserRole';
import {
  getMySubscription,
  updateBilling,
  type BillingDeps,
  type MySubscriptionDeps,
} from '../src/subscription';

const NOW = '2026-10-15T09:00:00.000Z';
const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };
const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const MTN: PayTo = {
  numbers: [{ network: 'MTN', number: '+256772123456', name: 'AutoRafiki Ltd' }],
  note: null,
};

describe('getMySubscription', () => {
  it('computes for the caller’s own uid only', async () => {
    const asked: string[] = [];
    const deps: MySubscriptionDeps = {
      getMechanic: async (uid) => (asked.push(uid), { userId: uid, vetting: 'verified' }),
      listDecisions: async (uid) => (asked.push(uid), []),
      listPayments: async (uid) => (asked.push(uid), []),
      getPayTo: async () => MTN,
      now: () => new Date(NOW),
    };
    const s = await getMySubscription({ uid: 'm1', email: null, role: null }, deps);
    expect(new Set(asked)).toEqual(new Set(['m1']));
    expect(s).toMatchObject({ owed: 30_000, overdueCount: 2, payTo: MTN });
    await expect(getMySubscription(null, deps)).rejects.toThrow(/Sign in/);
  });
});

describe('updateBilling', () => {
  function world(initial: PayTo | null = null) {
    const state = { payTo: initial, audit: [] as Omit<AuditEntry, 'id'>[] };
    const deps: BillingDeps = {
      async transact(run) {
        const writes: (() => void)[] = [];
        await run({
          get: async () => state.payTo,
          set: (p) => writes.push(() => (state.payTo = p)),
          audit: (e) => writes.push(() => state.audit.push(e)),
        });
        writes.forEach((w) => w());
      },
      now: () => new Date(NOW),
    };
    return { deps, state };
  }

  it('an admin sets the numbers, audited with before and after', async () => {
    const { deps, state } = world();
    await updateBilling(
      ADMIN,
      {
        payTo: { numbers: [{ network: 'MTN', number: '0772 123 456', name: 'AutoRafiki Ltd' }] },
        reason: 'Company line',
      },
      deps,
    );
    expect(state.payTo).toEqual(MTN);
    expect(state.audit[0]).toMatchObject({
      action: 'billing.update',
      targetId: 'billing',
      before: null,
      after: 'MTN +256772123456 (AutoRafiki Ltd)',
      reason: 'Company line',
    });
  });

  it('refuses ops, a missing reason, invalid numbers and no change', async () => {
    const { deps } = world(MTN);
    await expect(updateBilling(OPS, { payTo: { numbers: [] }, reason: 'x' }, deps)).rejects.toThrow(
      /Only admins/,
    );
    await expect(updateBilling(ADMIN, { payTo: MTN, reason: ' ' }, deps)).rejects.toThrow(/reason/);
    await expect(
      updateBilling(
        ADMIN,
        { payTo: { numbers: [{ network: 'MTN', number: '123', name: 'X' }] }, reason: 'r' },
        deps,
      ),
    ).rejects.toThrow(/numbers.0.number/);
    await expect(updateBilling(ADMIN, { payTo: MTN, reason: 'r' }, deps)).rejects.toThrow(
      /Nothing changed/,
    );
  });
});
