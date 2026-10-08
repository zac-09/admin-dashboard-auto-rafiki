import { HttpsError } from 'firebase-functions/v2/https';

import { can } from '../../src/lib/permissions';
import { DOC_LABELS } from '../../src/lib/vettingDocuments';
import { MAX_REASON } from '../../src/lib/vetting';
import { isAdminRole } from '../../src/types/admin';
import type { AuditEntry } from '../../src/types/audit';
import {
  VETTING_DOC_TYPES,
  type VettingDocType,
  type VettingDocument,
} from '../../src/types/domain';
import type { DocumentReview, VettingReviews } from '../../src/types/vettingReviews';

import type { Caller } from './setUserRole';

export interface ReviewTx {
  getBusinessName(mechanicId: string): Promise<string | null>;
  getDocument(mechanicId: string, docType: VettingDocType): Promise<VettingDocument | null>;
  getReviews(mechanicId: string): Promise<VettingReviews>;
  setReview(mechanicId: string, docType: VettingDocType, review: DocumentReview): void;
  audit(entry: Omit<AuditEntry, 'id'>): void;
}

export interface ReviewDeps {
  transact(run: (tx: ReviewTx) => Promise<void>): Promise<void>;
  now(): Date;
}

/**
 * Verifies or rejects one of a mechanic's uploaded documents. The review names the exact file
 * (path + version) it looked at, so a later re-upload reads as "re-uploaded since review"
 * rather than inheriting the decision. Needs `vetting.decide` (admin, ops). Audited. The app
 * still sees only the single mechanics.vetting flag; this feeds the approve decision.
 */
export async function reviewDocument(caller: Caller | null, data: unknown, deps: ReviewDeps) {
  if (!caller) throw new HttpsError('unauthenticated', 'Sign in first.');
  const role = isAdminRole(caller.role) ? caller.role : null;
  if (!role || !can(role, 'vetting.decide')) {
    throw new HttpsError('permission-denied', 'Your role cannot review documents.');
  }
  const input = (data ?? {}) as Record<string, unknown>;
  const mechanicId = typeof input.mechanicId === 'string' ? input.mechanicId.trim() : '';
  if (!mechanicId || mechanicId.includes('/')) {
    throw new HttpsError('invalid-argument', 'mechanicId is required.');
  }
  if (!VETTING_DOC_TYPES.includes(input.docType as VettingDocType)) {
    throw new HttpsError(
      'invalid-argument',
      'docType must be national-id, certification or riding-permit.',
    );
  }
  const docType = input.docType as VettingDocType;
  if (input.decision !== 'verified' && input.decision !== 'rejected') {
    throw new HttpsError('invalid-argument', 'decision must be verified or rejected.');
  }
  const decision = input.decision;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
  if (reason.length > MAX_REASON) {
    throw new HttpsError('invalid-argument', `Keep the reason under ${MAX_REASON} characters.`);
  }

  await deps.transact(async (tx) => {
    const businessName = await tx.getBusinessName(mechanicId);
    if (businessName === null) throw new HttpsError('not-found', 'No mechanic with that id.');
    const doc = await tx.getDocument(mechanicId, docType);
    if (!doc) {
      throw new HttpsError('failed-precondition', `${DOC_LABELS[docType]} has not been uploaded.`);
    }
    const previous = (await tx.getReviews(mechanicId))[docType];
    const at = deps.now().toISOString();
    tx.setReview(mechanicId, docType, {
      decision,
      storagePath: doc.storagePath,
      version: doc.version,
      reason,
      reviewedBy: caller.uid,
      reviewedByEmail: caller.email,
      reviewedByRole: role,
      reviewedAt: at,
    });
    tx.audit({
      action: 'mechanic.document.review',
      actorUid: caller.uid,
      actorEmail: caller.email,
      actorRole: role,
      targetType: 'mechanic',
      targetId: mechanicId,
      targetLabel: `${businessName}: ${DOC_LABELS[docType]} v${doc.version}`,
      before: previous && previous.version === doc.version ? previous.decision : null,
      after: decision,
      reason,
      at,
    });
  });
  return { mechanicId, docType, decision };
}
