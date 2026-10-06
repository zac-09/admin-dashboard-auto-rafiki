import { HttpsError } from 'firebase-functions/v2/https';

import { isAdminRole, type AdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';

export interface SetUserRoleInput {
  /** Exactly one of uid / email identifies the target account. */
  uid?: string;
  email?: string;
  /** The new role, or null to revoke dashboard access. */
  role: AdminRole | null;
  reason: string;
}

export interface SetUserRoleResult {
  uid: string;
  role: AdminRole | null;
  changed: boolean;
}

export interface Caller {
  uid: string;
  email: string | null;
  role: unknown;
}

export interface TargetAccount {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  customClaims: Record<string, unknown>;
}

/** Side effects, injected so the rules of the callable are testable without Firebase. */
export interface RoleDeps {
  findAccount(by: { uid: string } | { email: string }): Promise<TargetAccount | null>;
  setClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  /** Kills refresh tokens so the old role cannot outlive the next token refresh. */
  revokeTokens(uid: string): Promise<void>;
  writeAudit(entry: Omit<AuditEntry, 'id'>): Promise<void>;
  now(): Date;
}

export const MAX_REASON = 500;

function parse(data: unknown): SetUserRoleInput {
  const input = (data ?? {}) as Record<string, unknown>;
  const uid = typeof input.uid === 'string' ? input.uid.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (!uid === !email) {
    throw new HttpsError('invalid-argument', 'Pass exactly one of uid or email.');
  }
  if (input.role !== null && !isAdminRole(input.role)) {
    throw new HttpsError('invalid-argument', 'role must be admin, ops, support or null.');
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }
  return { ...(uid ? { uid } : { email }), role: input.role, reason };
}

/**
 * Grants, changes or revokes a staff member's `role` claim. Admin only; audited.
 * App accounts (phone sign-in) can never be given a dashboard role: rules tell the two
 * populations apart by the claim's presence, so mixing them would blur that line.
 */
export async function setUserRole(
  caller: Caller | null,
  data: unknown,
  deps: RoleDeps,
): Promise<SetUserRoleResult> {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (caller.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can change roles.');
  }
  const input = parse(data);
  const target = await deps.findAccount(
    input.uid ? { uid: input.uid } : { email: input.email as string },
  );
  if (!target) throw new HttpsError('not-found', 'No account with that uid or email.');
  if (target.uid === caller.uid) {
    throw new HttpsError('failed-precondition', 'You cannot change your own role.');
  }
  if (target.phoneNumber) {
    throw new HttpsError(
      'failed-precondition',
      'That is an app (phone) account. Staff need their own email account.',
    );
  }
  if (!target.email) {
    throw new HttpsError('failed-precondition', 'Staff accounts must have an email address.');
  }

  const before = isAdminRole(target.customClaims.role) ? target.customClaims.role : null;
  if (before === input.role) return { uid: target.uid, role: before, changed: false };

  const { role: _old, ...otherClaims } = target.customClaims;
  await deps.setClaims(target.uid, input.role ? { ...otherClaims, role: input.role } : otherClaims);
  await deps.revokeTokens(target.uid);
  await deps.writeAudit({
    action: 'staff.role.set',
    actorUid: caller.uid,
    actorEmail: caller.email,
    actorRole: 'admin',
    targetType: 'staff',
    targetId: target.uid,
    targetLabel: target.email,
    before,
    after: input.role,
    reason: input.reason,
    at: deps.now().toISOString(),
  });
  return { uid: target.uid, role: input.role, changed: true };
}
