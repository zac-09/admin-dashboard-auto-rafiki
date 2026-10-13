import { MECHANICS } from '@/lib/mocks/contractFixtures';
import { WEEKLY_FEE } from '@/lib/subscriptions';
import type { SubscriptionPayment } from '@/types';

import { overdueAccounts, reminderMessage, whatsappLink } from '../collections';

const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;
const namukasa = MECHANICS.find((m) => m.userId === 'u_mech_namukasa')!;
const paid = (mechanicId: string, weekStart: string): SubscriptionPayment => ({
  id: `${mechanicId}_${weekStart}`,
  mechanicId,
  weekStart,
  amount: WEEKLY_FEE,
  method: 'cash',
  reference: null,
  paidAt: '2026-10-06T08:00:00.000Z',
  recordedBy: 'staff-ops',
  recordedByEmail: 'ops@autorafiki.test',
});

describe('overdue accounts', () => {
  it('this week is not overdue before Thursday', () => {
    const tuesday = new Date('2026-10-06T09:00:00Z');
    expect(overdueAccounts([okello, namukasa], [], [], tuesday)).toEqual([]);
  });

  it('collects every overdue week, most weeks first, paid weeks excluded', () => {
    // Thursday of the second tracked week: Okello owes both weeks, Namukasa only the first.
    const thursday = new Date('2026-10-15T09:00:00Z');
    const accounts = overdueAccounts(
      [namukasa, okello],
      [],
      [paid('u_mech_namukasa', '2026-10-12')],
      thursday,
    );
    expect(accounts.map((a) => [a.mechanic.businessName, a.weeks, a.amount])).toEqual([
      ['Okello Auto Rescue', ['2026-10-05', '2026-10-12'], 30_000],
      ['Namukasa Motors', ['2026-10-05'], 15_000],
    ]);
  });

  it('writes a reminder with the weeks and the total, and a wa.me link without the plus', () => {
    const text = reminderMessage({
      mechanic: okello,
      weeks: ['2026-10-05', '2026-10-12'],
      amount: 30_000,
    });
    expect(text).toContain('Okello Auto Rescue');
    expect(text).toContain('2 weeks (5–11 Oct 2026; 12–18 Oct 2026)');
    expect(text).toContain('Total due: UGX 30,000');
    expect(whatsappLink('+256701987654', 'Hi there')).toBe(
      'https://wa.me/256701987654?text=Hi%20there',
    );
  });
});
