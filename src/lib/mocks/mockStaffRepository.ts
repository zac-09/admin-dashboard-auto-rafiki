import type {
  AdminRole,
  InviteStaffInput,
  InviteStaffResult,
  StaffMember,
  StaffRepository,
} from '@/types';

import { MOCK_APP_USER, MOCK_STAFF } from './fixtures';
import type { MockAuthRepository } from './mockAuthRepository';

/** Mirrors listStaff / inviteStaff / setUserRole over an in-memory account list. */
export class MockStaffRepository implements StaffRepository {
  private members: StaffMember[] = [...MOCK_STAFF, MOCK_APP_USER].map((s, i) => ({
    uid: s.uid,
    email: s.email,
    displayName: s.displayName,
    role: s.role,
    disabled: false,
    createdAt: new Date(Date.now() - (30 - i) * 86_400_000).toISOString(),
    lastSignInAt: s.role ? new Date(Date.now() - i * 3_600_000).toISOString() : null,
  }));
  private readonly auth: MockAuthRepository;

  constructor(auth: MockAuthRepository) {
    this.auth = auth;
  }

  private requireAdmin() {
    if (this.auth.current()?.role !== 'admin') throw new Error('Only admins manage staff.');
  }

  async list() {
    this.requireAdmin();
    const rank = { admin: 0, ops: 1, support: 2 } as const;
    return [...this.members]
      .sort(
        (a, b) =>
          (a.role ? rank[a.role] : 3) - (b.role ? rank[b.role] : 3) ||
          a.email.localeCompare(b.email),
      )
      .map((m) => ({ ...m }));
  }

  async invite(input: InviteStaffInput): Promise<InviteStaffResult> {
    this.requireAdmin();
    const email = input.email.trim().toLowerCase();
    const existing = this.members.find((m) => m.email === email);
    if (existing?.role) {
      throw new Error(`${email} is already ${existing.role}. Change their role instead.`);
    }
    if (!input.reason.trim()) throw new Error('A reason is required.');
    const member: StaffMember = existing ?? {
      uid: `staff-${this.members.length + 1}`,
      email,
      displayName: input.displayName?.trim() || null,
      role: null,
      disabled: false,
      createdAt: new Date().toISOString(),
      lastSignInAt: null,
    };
    member.role = input.role;
    if (!existing) this.members.push(member);
    return {
      uid: member.uid,
      created: !existing,
      setupLink: `https://auto-rafiki.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=MOCK-${member.uid}`,
    };
  }

  async setRole({ uid, role, reason }: { uid: string; role: AdminRole | null; reason: string }) {
    this.requireAdmin();
    if (uid === this.auth.current()?.uid) throw new Error('You cannot change your own role.');
    if (!reason.trim()) throw new Error('A reason is required.');
    const member = this.members.find((m) => m.uid === uid);
    if (!member) throw new Error('No account with that uid or email.');
    member.role = role;
  }
}
