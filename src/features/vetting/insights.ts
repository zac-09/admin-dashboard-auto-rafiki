import { REVERIFY_AFTER_MS } from '@/lib/vetting';
import type { AuditEntry, MechanicDoc } from '@/types';

/** Newest entry per mechanic. `entries` must be newest first (as the repository returns). */
export function latestEntryByMechanic(entries: readonly AuditEntry[]): Map<string, AuditEntry> {
  const latest = new Map<string, AuditEntry>();
  for (const entry of entries) if (!latest.has(entry.targetId)) latest.set(entry.targetId, entry);
  return latest;
}

/** When the mechanic was last approved (verified, reinstated or re-verified), if ever. */
export function lastVerifiedAt(entries: readonly AuditEntry[], mechanicId: string): string | null {
  return (
    entries.find((e) => e.targetId === mechanicId && e.action === 'mechanic.vetting.approve')?.at ??
    null
  );
}

export interface ReverificationItem {
  mechanic: MechanicDoc;
  /** Null: verified outside the dashboard (Console / seed script), so no record exists. */
  lastVerifiedAt: string | null;
}

/**
 * Verified mechanics whose last approval is older than REVERIFY_AFTER_MS, or who have no
 * approval on record at all. Unrecorded ones first, then the most overdue.
 */
export function reverificationDue(
  verified: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  now: Date,
): ReverificationItem[] {
  return verified
    .map((mechanic) => ({ mechanic, lastVerifiedAt: lastVerifiedAt(entries, mechanic.userId) }))
    .filter(
      ({ lastVerifiedAt: at }) =>
        at === null || now.getTime() - new Date(at).getTime() > REVERIFY_AFTER_MS,
    )
    .sort((a, b) => (a.lastVerifiedAt ?? '').localeCompare(b.lastVerifiedAt ?? ''));
}

export function byBusinessName(a: MechanicDoc, b: MechanicDoc): number {
  return a.businessName.localeCompare(b.businessName);
}
