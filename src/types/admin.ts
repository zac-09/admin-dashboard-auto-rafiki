/**
 * Dashboard-owned types (not part of the app's data contract; see domain.ts for that).
 */

/** Custom-claim `role` on dashboard staff. App users have no `role` claim at all. */
export type AdminRole = 'admin' | 'ops' | 'support';

export const ADMIN_ROLES: readonly AdminRole[] = ['admin', 'ops', 'support'];

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ADMIN_ROLES as readonly string[]).includes(value);
}

/** The signed-in staff member. `role: null` means signed in but not dashboard staff. */
export interface AdminSession {
  uid: string;
  email: string;
  displayName: string | null;
  role: AdminRole | null;
}
