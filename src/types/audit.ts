import type { AdminRole } from './admin';
import type { IsoDate } from './domain';

/**
 * auditLog/{id}: dashboard-owned, append-only. Written by Cloud Functions (Admin SDK) and the
 * bootstrap script only; rules allow staff to read and nobody to create, update or delete.
 */
export const AUDIT_COLLECTION = 'auditLog';

export type AuditAction =
  /** setUserRole: a staff member's role claim was granted, changed or revoked. */
  | 'staff.role.set'
  /** bootstrap-admin script: the first admin was created outside the dashboard. */
  | 'staff.bootstrap'
  /** decideVetting: approve (incl. reinstate / re-verify), reject, suspend. */
  | 'mechanic.vetting.approve'
  | 'mechanic.vetting.reject'
  | 'mechanic.vetting.suspend'
  /** flagDispute / resolveDispute (customer support). */
  | 'job.dispute.open'
  | 'job.dispute.resolve';

export type AuditTargetType = 'staff' | 'mechanic' | 'job';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  /** Who did it. `system` for scripts run with Admin SDK credentials. */
  actorUid: string;
  actorEmail: string | null;
  actorRole: AdminRole | 'system';
  targetType: AuditTargetType;
  targetId: string;
  /** Human label at the time (email, business name) so the log reads without joins. */
  targetLabel: string;
  /** The value before and after (role, vetting status, …); null = absent. */
  before: string | null;
  after: string | null;
  /** Mandatory, free text from the operator. */
  reason: string;
  /** Approvals: the practical-assessment checklist item ids that were ticked. */
  checklist?: string[];
  at: IsoDate;
}
