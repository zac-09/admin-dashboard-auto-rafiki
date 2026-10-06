import type { AuditEntry } from '@/types';

/** Past-tense wording for a vetting audit entry ("Approved", "Re-verified", …). */
export function auditEntryLabel(entry: AuditEntry): string {
  switch (entry.action) {
    case 'mechanic.vetting.approve':
      if (entry.before === 'verified') return 'Re-verified';
      if (entry.before === 'suspended') return 'Reinstated';
      return 'Approved';
    case 'mechanic.vetting.reject':
      return 'Rejected';
    case 'mechanic.vetting.suspend':
      return 'Suspended';
    default:
      return entry.action;
  }
}
