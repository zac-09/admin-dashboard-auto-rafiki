import type { AuditEntry } from '../../src/types/audit';
import { setUserRole, type Caller, type RoleDeps, type TargetAccount } from '../src/setUserRole';

const ADMIN: Caller = { uid: 'admin-1', email: 'admin@autorafiki.test', role: 'admin' };

function fakeDeps(accounts: TargetAccount[]) {
  const claims = new Map(accounts.map((a) => [a.uid, a.customClaims]));
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const revoked: string[] = [];
  const deps: RoleDeps = {
    async findAccount(by) {
      const found = accounts.find((a) => ('uid' in by ? a.uid === by.uid : a.email === by.email));
      return found ? { ...found, customClaims: claims.get(found.uid) ?? {} } : null;
    },
    async setClaims(uid, c) {
      claims.set(uid, c);
    },
    async revokeTokens(uid) {
      revoked.push(uid);
    },
    async writeAudit(entry) {
      audit.push(entry);
    },
    now: () => new Date('2026-10-06T09:00:00.000Z'),
  };
  return { deps, claims, audit, revoked };
}

const staff = (uid: string, email: string, customClaims: Record<string, unknown> = {}) => ({
  uid,
  email,
  phoneNumber: null,
  customClaims,
});

describe('setUserRole', () => {
  it('grants a role by email, revokes tokens and writes an audit entry', async () => {
    const { deps, claims, audit, revoked } = fakeDeps([staff('s1', 'sarah@autorafiki.test')]);
    const result = await setUserRole(
      ADMIN,
      { email: ' Sarah@AutoRafiki.test ', role: 'support', reason: 'New support hire' },
      deps,
    );
    expect(result).toEqual({ uid: 's1', role: 'support', changed: true });
    expect(claims.get('s1')).toEqual({ role: 'support' });
    expect(revoked).toEqual(['s1']);
    expect(audit).toEqual([
      {
        action: 'staff.role.set',
        actorUid: 'admin-1',
        actorEmail: 'admin@autorafiki.test',
        actorRole: 'admin',
        targetType: 'staff',
        targetId: 's1',
        targetLabel: 'sarah@autorafiki.test',
        before: null,
        after: 'support',
        reason: 'New support hire',
        at: '2026-10-06T09:00:00.000Z',
      },
    ]);
  });

  it('changes and revokes a role by uid, keeping unrelated claims', async () => {
    const { deps, claims, audit } = fakeDeps([
      staff('s1', 'o@x.test', { role: 'ops', beta: true }),
    ]);
    await setUserRole(ADMIN, { uid: 's1', role: 'admin', reason: 'Promoted' }, deps);
    expect(claims.get('s1')).toEqual({ role: 'admin', beta: true });
    await setUserRole(ADMIN, { uid: 's1', role: null, reason: 'Left the company' }, deps);
    expect(claims.get('s1')).toEqual({ beta: true });
    expect(audit.map((a) => [a.before, a.after])).toEqual([
      ['ops', 'admin'],
      ['admin', null],
    ]);
  });

  it('is a no-op (no audit) when the role is unchanged', async () => {
    const { deps, audit } = fakeDeps([staff('s1', 'o@x.test', { role: 'ops' })]);
    const result = await setUserRole(ADMIN, { uid: 's1', role: 'ops', reason: 'x' }, deps);
    expect(result.changed).toBe(false);
    expect(audit).toHaveLength(0);
  });

  it.each([
    [null, 'unauthenticated'],
    [{ uid: 'u', email: null, role: undefined }, 'permission-denied'],
    [{ uid: 'u', email: 'o@x.test', role: 'ops' }, 'permission-denied'],
    [{ uid: 'u', email: 's@x.test', role: 'support' }, 'permission-denied'],
  ] as const)('rejects caller %j with %s', async (caller, code) => {
    const { deps } = fakeDeps([staff('s1', 'o@x.test')]);
    await expect(
      setUserRole(caller, { uid: 's1', role: 'admin', reason: 'x' }, deps),
    ).rejects.toMatchObject({ code });
  });

  it.each([
    [{ role: 'ops', reason: 'x' }, /exactly one/],
    [{ uid: 's1', email: 'o@x.test', role: 'ops', reason: 'x' }, /exactly one/],
    [{ uid: 's1', role: 'superuser', reason: 'x' }, /role must be/],
    [{ uid: 's1', role: 'customer', reason: 'x' }, /role must be/],
    [{ uid: 's1', role: 'ops' }, /reason is required/],
    [{ uid: 's1', role: 'ops', reason: '   ' }, /reason is required/],
    [{ uid: 's1', role: 'ops', reason: 'x'.repeat(501) }, /under 500/],
  ])('rejects input %j', async (data, message) => {
    const { deps } = fakeDeps([staff('s1', 'o@x.test')]);
    await expect(setUserRole(ADMIN, data, deps)).rejects.toMatchObject({
      code: 'invalid-argument',
      message: expect.stringMatching(message),
    });
  });

  it('refuses unknown accounts, self-changes, app (phone) accounts and email-less accounts', async () => {
    const { deps, audit } = fakeDeps([
      staff(ADMIN.uid, ADMIN.email as string, { role: 'admin' }),
      { uid: 'app', email: null, phoneNumber: '+256772000001', customClaims: {} },
      { uid: 'anon', email: null, phoneNumber: null, customClaims: {} },
    ]);
    const call = (uid: string) => setUserRole(ADMIN, { uid, role: 'ops', reason: 'x' }, deps);
    await expect(call('ghost')).rejects.toMatchObject({ code: 'not-found' });
    await expect(call(ADMIN.uid)).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(call('app')).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringMatching(/app \(phone\) account/),
    });
    await expect(call('anon')).rejects.toMatchObject({ code: 'failed-precondition' });
    expect(audit).toHaveLength(0);
  });
});
