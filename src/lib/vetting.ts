/**
 * Mechanic vetting decisions. Shared by the dashboard UI and the `decideVetting` Cloud
 * Function, which is the only writer of `mechanics/{uid}.vetting` (the app's rules forbid the
 * mechanic from ever changing it).
 *
 * A rejection never changes `vetting` (decided with Isaac 2026-10-06): the applicant stays
 * pending (or suspended) and the rejection lives in the audit log.
 */
import type { MechanicProfile } from '../types/domain';

export type VettingStatus = MechanicProfile['vetting'];
export type VettingDecision = 'approve' | 'reject' | 'suspend';

export const VETTING_DECISIONS: readonly VettingDecision[] = ['approve', 'reject', 'suspend'];

const NEXT: Record<VettingDecision, Partial<Record<VettingStatus, VettingStatus>>> = {
  // verified → verified is the annual re-verification: a fresh approval resets the clock.
  approve: { pending: 'verified', suspended: 'verified', verified: 'verified' },
  reject: { pending: 'pending', suspended: 'suspended' },
  suspend: { pending: 'suspended', verified: 'suspended' },
};

/** The status after `decision`, or null when the decision does not apply to `current`. */
export function nextVetting(
  current: VettingStatus,
  decision: VettingDecision,
): VettingStatus | null {
  return NEXT[decision][current] ?? null;
}

export function allowedDecisions(current: VettingStatus): VettingDecision[] {
  return VETTING_DECISIONS.filter((d) => nextVetting(current, d) !== null);
}

/** Wording for the decision on a mechanic in `current` state (approve means different things). */
export function decisionLabel(decision: VettingDecision, current: VettingStatus): string {
  if (decision === 'approve') {
    if (current === 'verified') return 'Re-verify';
    if (current === 'suspended') return 'Reinstate';
    return 'Approve';
  }
  return decision === 'reject' ? 'Reject' : 'Suspend';
}

/**
 * Practical-assessment checklist, every item required to approve or re-verify.
 * PLACEHOLDER WORDING drafted by the dashboard team: Isaac to confirm the real assessment.
 * Item ids are stored in the audit log, so reword labels freely but never reuse an id.
 */
export const ASSESSMENT_CHECKLIST: readonly { id: string; label: string }[] = [
  { id: 'identity', label: 'Identity confirmed in person against a national ID' },
  { id: 'skills', label: 'Demonstrated each listed service in a practical test' },
  { id: 'tools', label: 'Has working tools and transport for call-outs' },
  { id: 'phone', label: 'Answered a test call on the listed phone number' },
  { id: 'conduct', label: 'Agreed to the code of conduct and upfront pricing' },
];

export function isChecklistComplete(ticked: readonly string[]): boolean {
  return ASSESSMENT_CHECKLIST.every((item) => ticked.includes(item.id));
}

/** How long a verification lasts before the mechanic is due for re-verification. */
export const REVERIFY_AFTER_MS = 365 * 24 * 60 * 60 * 1000;

export const MAX_REASON = 500;

/** Payload of the `decideVetting` callable. */
export interface DecideVettingInput {
  mechanicId: string;
  decision: VettingDecision;
  reason: string;
  /** Approvals only: ticked ASSESSMENT_CHECKLIST ids; all are required. */
  checklist?: string[];
}

export interface DecideVettingResult {
  mechanicId: string;
  vetting: VettingStatus;
  /** False for a rejection or a re-verification (vetting stays the same). */
  changed: boolean;
}
