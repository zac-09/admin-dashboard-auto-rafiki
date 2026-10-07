import type { AdminRole } from './admin';
import type { IsoDate } from './domain';

/** A dashboard account as the listStaff callable returns it (Auth, not Firestore). */
export interface StaffMember {
  uid: string;
  email: string;
  displayName: string | null;
  /** null: an email account with no dashboard role (invited then revoked, or never granted). */
  role: AdminRole | null;
  disabled: boolean;
  createdAt: IsoDate | null;
  lastSignInAt: IsoDate | null;
}

export interface InviteStaffInput {
  email: string;
  displayName?: string;
  role: AdminRole;
  reason: string;
}

export interface InviteStaffResult {
  uid: string;
  /** False when an existing email account (no role yet) was given the role. */
  created: boolean;
  /** Single-use password-setup link for the new staff member. */
  setupLink: string;
}
