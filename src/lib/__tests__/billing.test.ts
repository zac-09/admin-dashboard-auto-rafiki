import { MECHANICS } from '@/lib/mocks/contractFixtures';
import type { AuditEntry, SubscriptionPayment } from '@/types';

import { checkPayTo } from '../billing';
import { mySubscription } from '../subscriptions';

const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;
const kato = MECHANICS.find((m) => m.userId === 'u_mech_kato')!;
const payment = (
  weekStart: string,
  extra: Partial<SubscriptionPayment> = {},
): SubscriptionPayment => ({
  id: `u_mech_okello_${weekStart}`,
  mechanicId: 'u_mech_okello',
  weekStart,
  amount: 15_000,
  method: 'mobile-money',
  reference: 'MP-SECRET-REF',
  paidAt: '2026-10-06T08:00:00.000Z',
  recordedBy: 'staff-ops',
  recordedByEmail: 'ops@autorafiki.test',
  ...extra,
});

describe('the mechanic’s own subscription (getMySubscription)', () => {
  // Thursday 22 Oct 2026: weeks of 5, 12 and 19 Oct are billable; 19 Oct is overdue today.
  const now = new Date('2026-10-22T09:00:00Z');

  it('lists billable weeks newest first, paid / due / overdue, with what is owed', () => {
    const s = mySubscription(okello, [], [payment('2026-10-05')], null, now);
    expect(s.weeks).toEqual([
      { weekStart: '2026-10-19', status: 'overdue', amount: 15_000, paidAt: null, method: null },
      { weekStart: '2026-10-12', status: 'overdue', amount: 15_000, paidAt: null, method: null },
      {
        weekStart: '2026-10-05',
        status: 'paid',
        amount: 15_000,
        paidAt: '2026-10-06T08:00:00.000Z',
        method: 'mobile-money',
      },
    ]);
    expect(s).toMatchObject({
      weeklyFee: 15_000,
      overdueAfterDays: 3,
      suspensionAfterOverdueWeeks: 2,
      owed: 30_000,
      overdueCount: 2,
      payTo: null,
      computedAt: now.toISOString(),
    });
  });

  it('this week is due, not overdue, before Thursday', () => {
    const monday = new Date('2026-10-19T09:00:00Z');
    expect(mySubscription(okello, [], [], null, monday).weeks[0]).toMatchObject({
      weekStart: '2026-10-19',
      status: 'due',
    });
  });

  it('a voided payment counts as unpaid, and nothing staff-only leaks', () => {
    const voided = payment('2026-10-05', {
      voidedAt: '2026-10-07T08:00:00Z',
      voidedBy: 'staff-admin',
      voidReason: 'Wrong mechanic',
    } as Partial<SubscriptionPayment>);
    const s = mySubscription(okello, [], [voided], null, new Date('2026-10-08T09:00:00Z'));
    expect(s.weeks[0]!.status).toBe('overdue');
    const text = JSON.stringify(s);
    for (const secret of ['MP-SECRET-REF', 'staff-ops', 'ops@autorafiki.test', 'Wrong mechanic']) {
      expect(text).not.toContain(secret);
    }
  });

  it('never verified, or no mechanic at all: nothing owed', () => {
    expect(mySubscription(kato, [], [], null, now)).toMatchObject({
      weeks: [],
      owed: 0,
      overdueCount: 0,
    });
    expect(mySubscription(null, [], [], null, now)).toMatchObject({ weeks: [], owed: 0 });
  });

  it('a suspension stops billing; owed counts every unpaid week, the list shows at most 12', () => {
    const suspended: AuditEntry = {
      id: 's',
      action: 'mechanic.vetting.suspend',
      actorUid: 'a',
      actorEmail: null,
      actorRole: 'admin',
      targetType: 'mechanic',
      targetId: 'u_mech_okello',
      targetLabel: 'Okello',
      before: 'verified',
      after: 'suspended',
      reason: 'r',
      at: '2026-10-10T09:00:00Z',
    };
    const approved = {
      ...suspended,
      id: 'a',
      action: 'mechanic.vetting.approve' as const,
      at: '2026-10-01T09:00:00Z',
    };
    const s = mySubscription(
      { ...okello, vetting: 'suspended' },
      [approved, suspended],
      [],
      null,
      now,
    );
    expect(s.weeks.map((w) => w.weekStart)).toEqual(['2026-10-05']);
    const later = new Date('2027-02-01T09:00:00Z');
    const long = mySubscription(okello, [], [], null, later);
    expect(long.weeks).toHaveLength(12);
    expect(long.owed).toBeGreaterThan(12 * 15_000);
  });
});

describe('payment numbers', () => {
  it('normalises numbers and needs a network and the registered name', () => {
    expect(
      checkPayTo({
        numbers: [{ network: 'MTN', number: '0772 123 456', name: ' AutoRafiki Ltd ' }],
        note: ' Use your phone number as the reference. ',
      }),
    ).toEqual({
      ok: true,
      payTo: {
        numbers: [{ network: 'MTN', number: '+256772123456', name: 'AutoRafiki Ltd' }],
        note: 'Use your phone number as the reference.',
      },
    });
    const bad = checkPayTo({
      numbers: [
        { network: 'Vodafone', number: '12345', name: '' },
        { network: 'Airtel', number: '+256700000001', name: 'A' },
        { network: 'Airtel', number: '0700 000 001', name: 'B' },
      ],
    });
    expect(bad.ok ? {} : Object.keys(bad.errors).sort()).toEqual([
      'numbers.0.name',
      'numbers.0.network',
      'numbers.0.number',
      'numbers.2.number',
    ]);
  });

  it('no numbers clears it', () => {
    expect(checkPayTo({ numbers: [], note: 'x' })).toEqual({ ok: true, payTo: null });
  });
});
