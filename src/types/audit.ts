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
  /** inviteStaff: a new staff account was created (or an email account given a role). */
  | 'staff.invite'
  /** decideVetting: approve (incl. reinstate / re-verify), reject, suspend. */
  | 'mechanic.vetting.approve'
  | 'mechanic.vetting.reject'
  | 'mechanic.vetting.suspend'
  /** flagDispute / resolveDispute (customer support). */
  | 'job.dispute.open'
  | 'job.dispute.resolve'
  /** cancelJob / rebroadcastJob: control-room interventions on a job. */
  | 'job.cancel'
  | 'job.rebroadcast'
  /** markSubscriptionPaid: a weekly subscription payment was recorded. */
  | 'subscription.paid'
  /** updateSettings: prices / broadcast values the app reads were published. */
  | 'settings.update';

export type AuditTargetType = 'staff' | 'mechanic' | 'job' | 'subscription' | 'settings';

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
