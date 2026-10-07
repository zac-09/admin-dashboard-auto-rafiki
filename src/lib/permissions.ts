import type { AdminRole } from '../types/admin';

/**
 * What each dashboard role may do. The UI uses this to hide and gate; Cloud Functions import
 * the same table to enforce it server-side (the UI check alone is never the protection).
 */
export type Permission =
  | 'vetting.view'
  /** Approve / reject / suspend mechanics. */
  | 'vetting.decide'
  | 'operations.view'
  /** Cancel or re-broadcast a job, suspend a mechanic from the control room. */
  | 'operations.intervene'
  | 'support.view'
  /** Notes, dispute flags and resolutions. */
  | 'support.annotate'
  | 'revenue.view'
  /** Mark a subscription week paid. */
  | 'revenue.markPaid'
  | 'settings.view'
  | 'settings.edit'
  /** List staff, invite, change roles. */
  | 'staff.manage';

const MATRIX: Record<AdminRole, readonly Permission[]> = {
  admin: [
    'vetting.view',
    'vetting.decide',
    'operations.view',
    'operations.intervene',
    'support.view',
    'support.annotate',
    'revenue.view',
    'revenue.markPaid',
    'settings.view',
    'settings.edit',
    'staff.manage',
  ],
  ops: [
    'vetting.view',
    'vetting.decide',
    'operations.view',
    'operations.intervene',
    'support.view',
    'support.annotate',
    'revenue.view',
    'revenue.markPaid',
    'settings.view',
  ],
  support: ['vetting.view', 'operations.view', 'support.view', 'support.annotate', 'settings.view'],
};

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  return role ? MATRIX[role].includes(permission) : false;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  ops: 'Operations',
  support: 'Support',
};

/** What each role can do, in words, for invites and role changes. */
export const ROLE_SUMMARIES: Record<AdminRole, string> = {
  admin: 'Everything, including staff, roles and settings.',
  ops: 'Runs the marketplace: vetting decisions, interventions, disputes, payments.',
  support: 'Helps callers: search, job records, notes and disputes. Cannot suspend or see revenue.',
};
