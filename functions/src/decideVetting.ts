import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import {
  ASSESSMENT_CHECKLIST,
  isChecklistComplete,
  MAX_REASON,
  nextVetting,
  VETTING_DECISIONS,
  type DecideVettingInput,
  type DecideVettingResult,
  type VettingDecision,
  type VettingStatus,
} from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';

import type { Caller } from './setUserRole';

/** What the decision needs from mechanics/{id}, read inside the transaction. */
export interface MechanicSnapshot {
  vetting: VettingStatus;
  businessName: string;
}

export interface VettingDeps {
  /**
   * Runs `decide` against the current mechanic doc inside a transaction, then writes the new
   * `vetting` (when not null) and the audit entry atomically. Either both land or neither.
   */
  transact(
    mechanicId: string,
    decide: (current: MechanicSnapshot | null) => {
      vetting: VettingStatus | null;
      audit: Omit<AuditEntry, 'id'>;
    },
  ): Promise<void>;
  now(): Date;
}

const VALID_STATUSES: readonly string[] = ['pending', 'verified', 'suspended'];
const CHECKLIST_IDS = ASSESSMENT_CHECKLIST.map((item) => item.id);

function parse(data: unknown): DecideVettingInput {
  const input = (data ?? {}) as Record<string, unknown>;
  const mechanicId = typeof input.mechanicId === 'string' ? input.mechanicId.trim() : '';
  if (!mechanicId) throw new HttpsError('invalid-argument', 'mechanicId is required.');
  if (!VETTING_DECISIONS.includes(input.decision as VettingDecision)) {
    throw new HttpsError('invalid-argument', 'decision must be approve, reject or suspend.');
  }
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }
  const decision = input.decision as VettingDecision;
  if (decision !== 'approve') return { mechanicId, decision, reason };
  const raw = Array.isArray(input.checklist) ? input.checklist : [];
  const checklist = [
    ...new Set(raw.filter((id): id is string => CHECKLIST_IDS.includes(id as string))),
  ];
  if (!isChecklistComplete(checklist)) {
    throw new HttpsError(
      'invalid-argument',
      'Complete every assessment checklist item to approve.',
    );
  }
  return { mechanicId, decision, reason, checklist };
}

/**
 * Approve (incl. reinstate / re-verify), reject or suspend a mechanic. Needs `vetting.decide`
 * (admin, ops). Sets `mechanics/{id}.vetting` and writes the audit entry in one transaction.
 * A rejection writes only the audit entry: vetting stays as it is.
 */
export async function decideVetting(
  caller: Caller | null,
  data: unknown,
  deps: VettingDeps,
): Promise<DecideVettingResult> {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'vetting.decide')) {
    throw new HttpsError('permission-denied', 'Your role cannot make vetting decisions.');
  }
  const input = parse(data);
  let result: DecideVettingResult | undefined;
  await deps.transact(input.mechanicId, (current) => {
    if (!current) throw new HttpsError('not-found', 'No mechanic profile with that id.');
    if (!VALID_STATUSES.includes(current.vetting)) {
      throw new HttpsError('failed-precondition', `Unknown vetting status "${current.vetting}".`);
    }
    const next = nextVetting(current.vetting, input.decision);
    if (!next) {
      throw new HttpsError(
        'failed-precondition',
        `Cannot ${input.decision} a mechanic who is ${current.vetting}.`,
      );
    }
    result = { mechanicId: input.mechanicId, vetting: next, changed: next !== current.vetting };
    const audit: Omit<AuditEntry, 'id'> = {
      action: `mechanic.vetting.${input.decision}`,
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'mechanic',
      targetId: input.mechanicId,
      targetLabel: current.businessName,
      before: current.vetting,
      after: next,
      reason: input.reason,
      at: deps.now().toISOString(),
    };
    if (input.checklist) audit.checklist = input.checklist;
    return { vetting: result.changed ? next : null, audit };
  });
  if (!result) throw new HttpsError('internal', 'Decision was not applied.');
  return result;
}
