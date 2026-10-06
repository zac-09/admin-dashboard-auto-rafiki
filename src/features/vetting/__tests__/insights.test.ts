import { AUDIT_ENTRIES } from '@/lib/mocks/auditFixtures';
import { FIXTURE_NOW, MECHANICS } from '@/lib/mocks/contractFixtures';
import type { AuditEntry } from '@/types';

import { lastVerifiedAt, latestEntryByMechanic, reverificationDue } from '../insights';

const entries = [...AUDIT_ENTRIES].sort((a, b) => b.at.localeCompare(a.at));
const verified = MECHANICS.filter((m) => m.vetting === 'verified');

describe('vetting insights', () => {
  it('finds the newest entry per mechanic', () => {
    const latest = latestEntryByMechanic(entries);
    expect(latest.get('u_mech_waiswa')?.action).toBe('mechanic.vetting.suspend');
    expect(latest.get('u_mech_kato')?.action).toBe('mechanic.vetting.reject');
    expect(latest.has('u_mech_okello')).toBe(false);
  });

  it('reads the last approval date', () => {
    expect(lastVerifiedAt(entries, 'u_mech_namukasa')).toBe(
      AUDIT_ENTRIES.find((e) => e.id === 'audit_namukasa_approve')?.at,
    );
    expect(lastVerifiedAt(entries, 'u_mech_okello')).toBeNull();
  });

  it('flags mechanics verified over 12 months ago or with no record', () => {
    expect(reverificationDue(verified, entries, FIXTURE_NOW).map((i) => i.mechanic.userId)).toEqual(
      ['u_mech_okello'],
    );
    const old: AuditEntry = {
      ...AUDIT_ENTRIES.find((e) => e.id === 'audit_namukasa_approve')!,
      id: 'old',
      at: '2025-09-01T00:00:00.000Z',
    };
    const due = reverificationDue(verified, [old], FIXTURE_NOW);
    expect(due.map((i) => [i.mechanic.userId, i.lastVerifiedAt])).toEqual([
      ['u_mech_okello', null],
      ['u_mech_namukasa', '2025-09-01T00:00:00.000Z'],
    ]);
  });
});
