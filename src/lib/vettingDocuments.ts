/**
 * Vetting documents on the dashboard side of the contract (see firebase/storage.rules and the
 * app's src/lib/vetting.ts). Pure, shared with the reviewDocument Cloud Function.
 */
import {
  VETTING_DOC_TYPES,
  type VehicleCategory,
  type VettingDocType,
  type VettingDocument,
} from '../types/domain';
import type { DocumentReview, VettingReviews } from '../types/vettingReviews';

export const DOC_LABELS: Record<VettingDocType, string> = {
  'national-id': 'National ID',
  certification: 'Mechanic certification',
  'riding-permit': 'Riding permit',
};

/** National ID and certification for everyone; the riding permit only for boda mechanics (as the app). */
export function requiredDocTypes(vehicles: readonly VehicleCategory[]): VettingDocType[] {
  return VETTING_DOC_TYPES.filter((t) => t !== 'riding-permit' || vehicles.includes('boda'));
}

export type DocumentState =
  /** Required but never uploaded. */
  | 'missing'
  /** Uploaded, not yet reviewed. */
  | 'uploaded'
  | 'verified'
  | 'rejected'
  /** Re-uploaded after a review: the review refers to an older file. */
  | 'reuploaded';

export const DOCUMENT_STATE_LABELS: Record<DocumentState, string> = {
  missing: 'Not uploaded',
  uploaded: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Rejected',
  reuploaded: 'Re-uploaded since review',
};

/** A review applies only to the file it looked at. */
export function reviewIsCurrent(doc: VettingDocument, review: DocumentReview | undefined): boolean {
  return !!review && review.storagePath === doc.storagePath && review.version === doc.version;
}

export function documentState(
  doc: VettingDocument | undefined,
  review: DocumentReview | undefined,
): DocumentState {
  if (!doc) return 'missing';
  if (!review) return 'uploaded';
  if (!reviewIsCurrent(doc, review)) return 'reuploaded';
  return review.decision;
}

export interface DocumentsSummary {
  required: VettingDocType[];
  verified: number;
  missing: VettingDocType[];
  rejected: VettingDocType[];
  /** Uploaded (or re-uploaded) and still waiting for a decision. */
  pending: VettingDocType[];
}

/** For the Decide panel: how the required documents stand right now. */
export function documentsSummary(
  vehicles: readonly VehicleCategory[],
  docs: Partial<Record<VettingDocType, VettingDocument>>,
  reviews: VettingReviews,
): DocumentsSummary {
  const required = requiredDocTypes(vehicles);
  const summary: DocumentsSummary = {
    required,
    verified: 0,
    missing: [],
    rejected: [],
    pending: [],
  };
  for (const t of required) {
    const state = documentState(docs[t], reviews[t]);
    if (state === 'verified') summary.verified += 1;
    else if (state === 'missing') summary.missing.push(t);
    else if (state === 'rejected') summary.rejected.push(t);
    else summary.pending.push(t);
  }
  return summary;
}

export function summaryText(s: DocumentsSummary): string {
  const parts = [`${s.verified} of ${s.required.length} verified`];
  if (s.missing.length) parts.push(`${s.missing.length} not uploaded`);
  if (s.rejected.length) parts.push(`${s.rejected.length} rejected`);
  if (s.pending.length) parts.push(`${s.pending.length} awaiting review`);
  return parts.join(' · ');
}

/** "240 KB", "1.3 MB". */
export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
