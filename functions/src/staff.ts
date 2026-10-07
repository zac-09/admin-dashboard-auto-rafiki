import { HttpsError } from 'firebase-functions/v2/https';

import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import type { InviteStaffResult, StaffMember } from '../../src/types/staff';

import { MAX_REASON, type Caller } from './setUserRole';

export interface AuthAccount {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  customClaims: Record<string, unknown>;
  disabled: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
}

export interface StaffDeps {
  /** One page of Auth accounts (1000 max) and the token for the next. */
  listPage(pageToken?: string): Promise<{ accounts: AuthAccount[]; next?: string }>;
  findByEmail(email: string): Promise<AuthAccount | null>;
  createUser(input: { email: string; displayName?: string }): Promise<AuthAccount>;
  setClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  passwordSetupLink(email: string): Promise<string>;
  writeAudit(entry: Omit<AuditEntry, 'id'>): Promise<void>;
  now(): Date;
}

function requireAdmin(caller: Caller | null): Caller {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (caller.role !== 'admin')
    throw new HttpsError('permission-denied', 'Only admins manage staff.');
  return caller;
}

/** An email account that is not an app (phone) account. */
function isStaffShaped(a: AuthAccount): a is AuthAccount & { email: string } {
  return !!a.email && !a.phoneNumber;
}

function toMember(a: AuthAccount & { email: string }): StaffMember {
  const role = a.customClaims.role;
  return {
    uid: a.uid,
    email: a.email,
    displayName: a.displayName,
    role: isAdminRole(role) ? role : null,
    disabled: a.disabled,
    createdAt: a.createdAt,
    lastSignInAt: a.lastSignInAt,
  };
}

/** Every dashboard-shaped account (email, no phone), staff with a role first. Admin only. */
export async function listStaff(caller: Caller | null, deps: StaffDeps): Promise<StaffMember[]> {
  requireAdmin(caller);
  const members: StaffMember[] = [];
  let next: string | undefined;
  do {
    const page = await deps.listPage(next);
    members.push(...page.accounts.filter(isStaffShaped).map(toMember));
    next = page.next;
  } while (next);
  const rank = { admin: 0, ops: 1, support: 2 } as const;
  return members.sort(
    (a, b) =>
      (a.role ? rank[a.role] : 3) - (b.role ? rank[b.role] : 3) || a.email.localeCompare(b.email),
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a staff account with a role and returns a single-use password-setup link. An existing
 * email account with no role is given the role instead; app (phone) accounts and accounts that
 * already have a role are refused (use setUserRole to change a role). Admin only; audited.
 */
export async function inviteStaff(
  caller: Caller | null,
  data: unknown,
  deps: StaffDeps,
): Promise<InviteStaffResult> {
  const who = requireAdmin(caller);
  const input = (data ?? {}) as Record<string, unknown>;
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!EMAIL.test(email)) throw new HttpsError('invalid-argument', 'Enter a valid email address.');
  if (!isAdminRole(input.role)) {
    throw new HttpsError('invalid-argument', 'role must be admin, ops or support.');
  }
  const role = input.role;
  const displayName =
    typeof input.displayName === 'string' && input.displayName.trim()
      ? input.displayName.trim().slice(0, 80)
      : undefined;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }

  let account = await deps.findByEmail(email);
  if (account?.phoneNumber) {
    throw new HttpsError('failed-precondition', 'That email belongs to an app (phone) account.');
  }
  if (account && isAdminRole(account.customClaims.role)) {
    throw new HttpsError(
      'already-exists',
      `${email} is already ${account.customClaims.role}. Change their role instead.`,
    );
  }
  const created = !account;
  if (!account) account = await deps.createUser({ email, displayName });
  await deps.setClaims(account.uid, { ...account.customClaims, role });
  const setupLink = await deps.passwordSetupLink(email);
  await deps.writeAudit({
    action: 'staff.invite',
    actorUid: who.uid,
    actorEmail: who.email,
    actorRole: 'admin',
    targetType: 'staff',
    targetId: account.uid,
    targetLabel: email,
    before: null,
    after: role,
    reason,
    at: deps.now().toISOString(),
  });
  return { uid: account.uid, created, setupLink };
}
