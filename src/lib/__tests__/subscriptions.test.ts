import type { AuditEntry, MechanicDoc, SubscriptionPayment } from '@/types';

import {
  addWeeks,
  isBillable,
  isMonday,
  summarizeWeek,
  TRACKING_START,
  verifiedIntervals,
  weekLabel,
  weekStartOf,
  weekStatus,
  weeksBetween,
} from '../subscriptions';

const at = (iso: string) => new Date(iso);

describe('Kampala weeks', () => {
  it('finds the Monday in Kampala time, not UTC', () => {
    expect(weekStartOf(at('2026-10-06T09:00:00Z'))).toBe('2026-10-05'); // Tuesday
    expect(weekStartOf(at('2026-10-04T21:00:00Z'))).toBe('2026-10-05'); // Mon 00:00 Kampala
    expect(weekStartOf(at('2026-10-04T20:59:59Z'))).toBe('2026-09-28'); // Sun 23:59 Kampala
    expect(weekStartOf(at('2026-10-11T20:59:59Z'))).toBe('2026-10-05'); // Sun 23:59 Kampala
  });

  it('steps, lists and labels weeks', () => {
    expect(addWeeks('2026-10-05', 1)).toBe('2026-10-12');
    expect(addWeeks('2026-10-05', -1)).toBe('2026-09-28');
    expect(addWeeks('2026-12-28', 1)).toBe('2027-01-04');
    expect(weeksBetween('2026-10-05', '2026-10-19')).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect(weekLabel('2026-10-05')).toBe('5–11 Oct 2026');
    // Weeks that span two months name both (September's short form varies by ICU version).
    expect(weekLabel('2026-09-28')).toMatch(/^28 Sept? – 4 Oct 2026$/);
    expect(isMonday('2026-10-05')).toBe(true);
    expect(isMonday('2026-10-06')).toBe(false);
    expect(isMonday('nope')).toBe(false);
  });
});

const approve = (id: string, iso: string) =>
  ({ action: 'mechanic.vetting.approve', targetId: id, at: iso }) as AuditEntry;
const suspend = (id: string, iso: string) =>
  ({ action: 'mechanic.vetting.suspend', targetId: id, at: iso }) as AuditEntry;

describe('who owes a week', () => {
  it('bills a mechanic from the week they were verified', () => {
    const iv = verifiedIntervals({ userId: 'm', vetting: 'verified' }, [
      approve('m', '2026-10-15T10:00:00Z'),
    ]);
    expect(isBillable(iv, '2026-10-05')).toBe(false);
    expect(isBillable(iv, '2026-10-12')).toBe(true); // verified that Thursday
    expect(isBillable(iv, '2026-10-19')).toBe(true);
  });

  it('stops billing for weeks spent entirely suspended, and resumes on reinstatement', () => {
    const iv = verifiedIntervals({ userId: 'm', vetting: 'verified' }, [
      approve('m', '2026-10-06T08:00:00Z'),
      suspend('m', '2026-10-14T08:00:00Z'), // Wed of week 12th
      approve('m', '2026-10-28T08:00:00Z'), // Wed of week 26th
    ]);
    expect(isBillable(iv, '2026-10-05')).toBe(true);
    expect(isBillable(iv, '2026-10-12')).toBe(true); // verified Mon–Wed
    expect(isBillable(iv, '2026-10-19')).toBe(false); // suspended all week
    expect(isBillable(iv, '2026-10-26')).toBe(true);
  });

  it('re-verifying an already verified mechanic changes nothing', () => {
    const iv = verifiedIntervals({ userId: 'm', vetting: 'verified' }, [
      approve('m', '2026-10-06T08:00:00Z'),
      approve('m', '2026-10-20T08:00:00Z'),
    ]);
    expect(iv).toHaveLength(1);
  });

  it('bills mechanics verified before the dashboard from the tracker start, never earlier', () => {
    const iv = verifiedIntervals({ userId: 'm', vetting: 'verified' }, []);
    expect(isBillable(iv, addWeeks(TRACKING_START, -1))).toBe(false);
    expect(isBillable(iv, TRACKING_START)).toBe(true);
    expect(verifiedIntervals({ userId: 'm', vetting: 'pending' }, [])).toEqual([]);
  });
});

describe('week status', () => {
  const week = '2026-10-05';
  it('is due Monday to Wednesday, overdue from Thursday (Kampala), paid once recorded', () => {
    expect(weekStatus(undefined, week, at('2026-10-07T20:59:59Z'))).toBe('due'); // Wed 23:59
    expect(weekStatus(undefined, week, at('2026-10-07T21:00:00Z'))).toBe('overdue'); // Thu 00:00
    expect(weekStatus({} as SubscriptionPayment, week, at('2026-10-20T00:00:00Z'))).toBe('paid');
  });
});

describe('summarizeWeek', () => {
  const m = (userId: string, businessName: string, vetting: MechanicDoc['vetting']) =>
    ({ userId, businessName, vetting }) as MechanicDoc;
  const pay = (mechanicId: string, weekStart: string) =>
    ({
      id: `${mechanicId}_${weekStart}`,
      mechanicId,
      weekStart,
      amount: 15_000,
    }) as SubscriptionPayment;

  it('lists who owes the week, overdue first, with totals and arrears', () => {
    const now = at('2026-10-15T09:00:00Z'); // Thursday of week 12th
    const s = summarizeWeek(
      '2026-10-12',
      [m('a', 'Alpha', 'verified'), m('b', 'Bravo', 'verified'), m('p', 'Pending', 'pending')],
      [],
      [pay('a', '2026-10-12')],
      now,
    );
    expect(s.rows.map((r) => [r.mechanic.businessName, r.status, r.unpaidEarlier])).toEqual([
      ['Bravo', 'overdue', ['2026-10-05']],
      ['Alpha', 'paid', ['2026-10-05']],
    ]);
    expect(s).toMatchObject({
      expected: 30_000,
      collected: 15_000,
      counts: { paid: 1, due: 0, overdue: 1 },
    });
  });
});
