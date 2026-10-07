import type { AuditEntry } from '../../src/types/audit';
import type { Caller } from '../src/setUserRole';
import { inviteStaff, listStaff, type AuthAccount, type StaffDeps } from '../src/staff';

const ADMIN: Caller = { uid: 'a1', email: 'admin@autorafiki.test', role: 'admin' };

const account = (over: Partial<AuthAccount> & { uid: string }): AuthAccount => ({
  email: null,
  phoneNumber: null,
  displayName: null,
  customClaims: {},
  disabled: false,
  createdAt: '2026-10-01T00:00:00.000Z',
  lastSignInAt: null,
  ...over,
});

function world(accounts: AuthAccount[]) {
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: StaffDeps = {
    async listPage(token) {
      // Two pages of 2 to exercise pagination.
      const start = token ? Number(token) : 0;
      const next = start + 2 < accounts.length ? String(start + 2) : undefined;
      return { accounts: accounts.slice(start, start + 2), next };
    },
    findByEmail: async (email) => accounts.find((a) => a.email === email) ?? null,
    async createUser({ email, displayName }) {
      const a = account({ uid: `new_${accounts.length}`, email, displayName: displayName ?? null });
      accounts.push(a);
      return a;
    },
    async setClaims(uid, claims) {
      accounts.find((a) => a.uid === uid)!.customClaims = claims;
    },
    passwordSetupLink: async (email) => `https://auth.example/setup?for=${email}`,
    writeAudit: async (e) => void audit.push(e),
    now: () => new Date('2026-10-07T09:00:00.000Z'),
  };
  return { deps, accounts, audit };
}

describe('listStaff', () => {
  it('lists email accounts across pages, staff by role first, never phone accounts', async () => {
    const w = world([
      account({ uid: 'p', phoneNumber: '+256772000001' }),
      account({ uid: 's', email: 'sarah@x.test', customClaims: { role: 'support' } }),
      account({ uid: 'n', email: 'norole@x.test' }),
      account({ uid: 'a', email: 'zed@x.test', customClaims: { role: 'admin' } }),
      account({ uid: 'o', email: 'ops@x.test', customClaims: { role: 'ops' }, disabled: true }),
    ]);
    const list = await listStaff(ADMIN, w.deps);
    expect(list.map((m) => [m.email, m.role, m.disabled])).toEqual([
      ['zed@x.test', 'admin', false],
      ['ops@x.test', 'ops', true],
      ['sarah@x.test', 'support', false],
      ['norole@x.test', null, false],
    ]);
  });

  it('is admin only', async () => {
    const w = world([]);
    await expect(listStaff({ ...ADMIN, role: 'ops' }, w.deps)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(listStaff(null, w.deps)).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});

describe('inviteStaff', () => {
  const base = {
    email: ' New.Hire@AutoRafiki.test ',
    displayName: 'New Hire',
    role: 'support',
    reason: 'Joined support',
  };

  it('creates the account with the role, returns a setup link, audits it', async () => {
    const w = world([]);
    const result = await inviteStaff(ADMIN, base, w.deps);
    expect(result).toEqual({
      uid: 'new_0',
      created: true,
      setupLink: 'https://auth.example/setup?for=new.hire@autorafiki.test',
    });
    expect(w.accounts[0]).toMatchObject({
      email: 'new.hire@autorafiki.test',
      displayName: 'New Hire',
      customClaims: { role: 'support' },
    });
    expect(w.audit).toEqual([
      expect.objectContaining({
        action: 'staff.invite',
        targetId: 'new_0',
        targetLabel: 'new.hire@autorafiki.test',
        after: 'support',
        reason: 'Joined support',
      }),
    ]);
  });

  it('gives an existing role-less email account the role instead of creating one', async () => {
    const w = world([
      account({ uid: 'old', email: 'new.hire@autorafiki.test', customClaims: { beta: true } }),
    ]);
    const result = await inviteStaff(ADMIN, base, w.deps);
    expect(result.created).toBe(false);
    expect(w.accounts[0]?.customClaims).toEqual({ beta: true, role: 'support' });
  });

  it('refuses existing staff, app accounts and bad input; nothing is written', async () => {
    const w = world([
      account({ uid: 's', email: 'sarah@x.test', customClaims: { role: 'ops' } }),
      account({ uid: 'p', email: 'app@x.test', phoneNumber: '+256772000001' }),
    ]);
    await expect(
      inviteStaff(ADMIN, { ...base, email: 'sarah@x.test' }, w.deps),
    ).rejects.toMatchObject({
      code: 'already-exists',
      message: expect.stringMatching(/already ops/),
    });
    await expect(
      inviteStaff(ADMIN, { ...base, email: 'app@x.test' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      inviteStaff(ADMIN, { ...base, email: 'not-an-email' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(inviteStaff(ADMIN, { ...base, role: 'customer' }, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(inviteStaff(ADMIN, { ...base, reason: ' ' }, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    expect(w.accounts).toHaveLength(2);
    expect(w.audit).toHaveLength(0);
  });

  it('is admin only', async () => {
    const w = world([]);
    for (const role of ['ops', 'support', undefined]) {
      await expect(inviteStaff({ ...ADMIN, role }, base, w.deps)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    }
    expect(w.accounts).toHaveLength(0);
  });
});
