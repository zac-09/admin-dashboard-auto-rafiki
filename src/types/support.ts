import type { IsoDate } from './domain';

/**
 * Dashboard-owned support data. App users never read it: rules give staff read access and
 * nobody write access; Cloud Functions (addSupportNote, flagDispute, resolveDispute) write it.
 */

/** jobs/{jobId}/supportNotes/{noteId}: internal, immutable notes on a job. */
export const SUPPORT_NOTES = 'supportNotes';
/** disputes/{jobId}: at most one dispute per job (re-flagging a resolved one reopens it). */
export const DISPUTES = 'disputes';

export const MAX_NOTE = 1000;

export type SupportNoteKind = 'note' | 'dispute-opened' | 'dispute-resolved';

export interface SupportNote {
  id: string;
  jobId: string;
  kind: SupportNoteKind;
  text: string;
  authorUid: string;
  authorEmail: string | null;
  createdAt: IsoDate;
}

/** v1 has no refunds (payment is direct), so outcomes are a finding plus an optional sanction. */
export type DisputeOutcome =
  'no-fault' | 'customer-at-fault' | 'mechanic-warned' | 'mechanic-suspended';

export const DISPUTE_OUTCOMES: readonly DisputeOutcome[] = [
  'no-fault',
  'customer-at-fault',
  'mechanic-warned',
  'mechanic-suspended',
];

export const DISPUTE_OUTCOME_LABELS: Record<DisputeOutcome, string> = {
  'no-fault': 'No fault found',
  'customer-at-fault': 'Customer at fault',
  'mechanic-warned': 'Mechanic warned',
  'mechanic-suspended': 'Mechanic suspended',
};

export interface DisputeResolution {
  outcome: DisputeOutcome;
  note: string;
  resolvedBy: string;
  resolvedByEmail: string | null;
  resolvedAt: IsoDate;
}

export interface Dispute {
  jobId: string;
  status: 'open' | 'resolved';
  customerId: string;
  mechanicId: string | null;
  /** Short human label for lists ("Flat tyre, Bugolobi"). */
  jobLabel: string;
  reason: string;
  openedBy: string;
  openedByEmail: string | null;
  openedAt: IsoDate;
  resolution?: DisputeResolution;
}
