import { ASSESSMENT_CHECKLIST } from '../../src/lib/vetting';
import type { AuditEntry } from '../../src/types/audit';
import { decideVetting, type MechanicSnapshot, type VettingDeps } from '../src/decideVetting';
import type { Caller } from '../src/setUserRole';

const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };
const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const ALL = ASSESSMENT_CHECKLIST.map((i) => i.id);

function fakeDeps(mechanics: Record<string, MechanicSnapshot>) {
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: VettingDeps = {
    async transact(id, decide) {
      // Like a transaction: nothing is written if decide throws.
      const { vetting, audit: entry } = decide(mechanics[id] ? { ...mechanics[id] } : null);
      if (vetting) mechanics[id] = { ...mechanics[id]!, vetting };
      audit.push(entry);
    },
    now: () => new Date('2026-10-06T09:00:00.000Z'),
  };
  return { deps, mechanics, audit };
}

const world = () => ({
  p: { vetting: 'pending' as const, businessName: 'Pending Motors' },
  v: { vetting: 'verified' as const, businessName: 'Verified Motors' },
  s: { vetting: 'suspended' as const, businessName: 'Suspended Motors' },
});

describe('decideVetting', () => {
  it('approves a pending applicant with the full checklist, atomically audited', async () => {
    const { deps, mechanics, audit } = fakeDeps(world());
    const result = await decideVetting(
      ADMIN,
      {
        mechanicId: 'p',
        decision: 'approve',
        reason: ' Passed assessment ',
        checklist: [...ALL, 'bogus', ALL[0]],
      },
      deps,
    );
    expect(result).toEqual({ mechanicId: 'p', vetting: 'verified', changed: true });
    expect(mechanics.p?.vetting).toBe('verified');
    expect(audit).toEqual([
      {
        action: 'mechanic.vetting.approve',
        actorUid: 'a1',
        actorEmail: 'admin@autorafiki.test',
        actorRole: 'admin',
        targetType: 'mechanic',
        targetId: 'p',
        targetLabel: 'Pending Motors',
        before: 'pending',
        after: 'verified',
        reason: 'Passed assessment',
        checklist: ALL,
        at: '2026-10-06T09:00:00.000Z',
      },
    ]);
  });

  it('a rejection keeps the applicant pending and records only the audit entry', async () => {
    const { deps, mechanics, audit } = fakeDeps(world());
    const result = await decideVetting(
      OPS,
      { mechanicId: 'p', decision: 'reject', reason: 'No tools' },
      deps,
    );
    expect(result).toEqual({ mechanicId: 'p', vetting: 'pending', changed: false });
    expect(mechanics.p?.vetting).toBe('pending');
    expect(audit[0]).toMatchObject({
      action: 'mechanic.vetting.reject',
      before: 'pending',
      after: 'pending',
      actorRole: 'ops',
    });
    expect(audit[0]).not.toHaveProperty('checklist');
  });

  it('suspends a verified mechanic and reinstates a suspended one', async () => {
    const { deps, mechanics } = fakeDeps(world());
    await decideVetting(
      ADMIN,
      { mechanicId: 'v', decision: 'suspend', reason: 'Complaints' },
      deps,
    );
    expect(mechanics.v?.vetting).toBe('suspended');
    await decideVetting(
      ADMIN,
      { mechanicId: 's', decision: 'approve', reason: 'Retrained', checklist: ALL },
      deps,
    );
    expect(mechanics.s?.vetting).toBe('verified');
  });

  it('re-verifies a verified mechanic: audited, status unchanged', async () => {
    const { deps, audit } = fakeDeps(world());
    const result = await decideVetting(
      ADMIN,
      { mechanicId: 'v', decision: 'approve', reason: 'Annual', checklist: ALL },
      deps,
    );
    expect(result.changed).toBe(false);
    expect(audit[0]).toMatchObject({
      action: 'mechanic.vetting.approve',
      before: 'verified',
      after: 'verified',
    });
  });

  it.each([
    [null, 'unauthenticated'],
    [{ uid: 's1', email: 's@x.test', role: 'support' }, 'permission-denied'],
    [{ uid: 'u1', email: null, role: undefined }, 'permission-denied'],
  ] as const)('rejects caller %j', async (caller, code) => {
    const { deps, audit } = fakeDeps(world());
    await expect(
      decideVetting(caller, { mechanicId: 'p', decision: 'suspend', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code });
    expect(audit).toHaveLength(0);
  });

  it.each([
    [{ decision: 'approve', reason: 'x', checklist: ALL }, /mechanicId is required/],
    [{ mechanicId: 'p', decision: 'delete', reason: 'x' }, /decision must be/],
    [{ mechanicId: 'p', decision: 'suspend' }, /reason is required/],
    [{ mechanicId: 'p', decision: 'suspend', reason: 'x'.repeat(501) }, /under 500/],
    [{ mechanicId: 'p', decision: 'approve', reason: 'x' }, /checklist/],
    [{ mechanicId: 'p', decision: 'approve', reason: 'x', checklist: ALL.slice(1) }, /checklist/],
  ])('rejects input %j', async (data, message) => {
    const { deps, audit } = fakeDeps(world());
    await expect(decideVetting(ADMIN, data, deps)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringMatching(message),
    });
    expect(audit).toHaveLength(0);
  });

  it('refuses decisions that do not apply, and unknown mechanics, without auditing', async () => {
    const { deps, audit } = fakeDeps({
      ...world(),
      odd: { vetting: 'banned' as never, businessName: 'Odd' },
    });
    await expect(
      decideVetting(ADMIN, { mechanicId: 'v', decision: 'reject', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      decideVetting(ADMIN, { mechanicId: 's', decision: 'suspend', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      decideVetting(ADMIN, { mechanicId: 'odd', decision: 'suspend', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      decideVetting(ADMIN, { mechanicId: 'ghost', decision: 'suspend', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code: 'not-found' });
    expect(audit).toHaveLength(0);
  });
});
