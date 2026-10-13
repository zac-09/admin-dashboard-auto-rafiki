import type { AuditAction, AuditEntry, AuditTargetType } from '../types/audit';

/** Every audited action in operator words, for the log page and its filter. */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  'staff.role.set': 'Staff role changed',
  'staff.bootstrap': 'First admin created',
  'staff.invite': 'Staff invited',
  'mechanic.vetting.approve': 'Mechanic approved',
  'mechanic.vetting.reject': 'Mechanic rejected',
  'mechanic.vetting.suspend': 'Mechanic suspended',
  'mechanic.document.review': 'Document reviewed',
  'job.dispute.open': 'Dispute opened',
  'job.dispute.resolve': 'Dispute resolved',
  'job.cancel': 'Job cancelled',
  'job.rebroadcast': 'Job re-broadcast',
  'subscription.paid': 'Payment recorded',
  'subscription.void': 'Payment voided',
  'settings.update': 'Settings published',
};

/** Groups for the filter, in the order the sidebar lists the modules. */
export const AUDIT_ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
  {
    label: 'Vetting',
    actions: [
      'mechanic.vetting.approve',
      'mechanic.vetting.reject',
      'mechanic.vetting.suspend',
      'mechanic.document.review',
    ],
  },
  { label: 'Operations', actions: ['job.cancel', 'job.rebroadcast'] },
  { label: 'Support', actions: ['job.dispute.open', 'job.dispute.resolve'] },
  { label: 'Revenue', actions: ['subscription.paid', 'subscription.void'] },
  {
    label: 'Admin',
    actions: ['settings.update', 'staff.invite', 'staff.role.set', 'staff.bootstrap'],
  },
];

const TARGET_LABELS: Record<AuditTargetType, string> = {
  staff: 'Staff',
  mechanic: 'Mechanic',
  job: 'Job',
  subscription: 'Subscription',
  settings: 'Settings',
};

export function auditTargetType(type: AuditTargetType): string {
  return TARGET_LABELS[type];
}

/** Where the entry's subject lives in the dashboard; null when there is no page for it. */
export function auditTargetPath(entry: Pick<AuditEntry, 'targetType' | 'targetId'>): string | null {
  switch (entry.targetType) {
    case 'mechanic':
      return `/vetting/${entry.targetId}`;
    case 'job':
      return `/jobs/${entry.targetId}`;
    case 'subscription':
      return '/revenue';
    case 'settings':
      return '/settings';
    case 'staff':
      return '/staff';
  }
}

export interface AuditFilter {
  /** An action, or null for all. */
  action: AuditAction | null;
  /** An actor uid, or null for anyone. */
  actor: string | null;
  /** Free text over who, the subject, the reason and the values. */
  text: string;
}

export function filterAudit(entries: readonly AuditEntry[], filter: AuditFilter): AuditEntry[] {
  const needle = filter.text.trim().toLowerCase();
  return entries.filter(
    (e) =>
      (filter.action === null || e.action === filter.action) &&
      (filter.actor === null || e.actorUid === filter.actor) &&
      (!needle ||
        [e.targetLabel, e.targetId, e.reason, e.actorEmail ?? '', e.before ?? '', e.after ?? '']
          .join('\n')
          .toLowerCase()
          .includes(needle)),
  );
}

/** Distinct actors in the entries, for the "who" filter, by email (system last). */
export function auditActors(entries: readonly AuditEntry[]): { uid: string; label: string }[] {
  const seen = new Map<string, string>();
  for (const e of entries) {
    if (!seen.has(e.actorUid)) {
      seen.set(
        e.actorUid,
        e.actorEmail ?? (e.actorRole === 'system' ? 'System (script)' : e.actorUid),
      );
    }
  }
  return [...seen]
    .map(([uid, label]) => ({ uid, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
