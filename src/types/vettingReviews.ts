import type { AdminRole } from './admin';
import type { IsoDate, VettingDocType } from './domain';

/**
 * vettingReviews/{mechanicId}: per-document decisions, dashboard-owned. Written only by the
 * reviewDocument callable; app users never read it (the app sees the single mechanics.vetting
 * flag). Keyed by document type; each review names the exact file it looked at, so a re-upload
 * makes the review stale rather than silently approving a new file.
 */
export const VETTING_REVIEWS = 'vettingReviews';

export type DocumentDecision = 'verified' | 'rejected';

export interface DocumentReview {
  decision: DocumentDecision;
  /** The file reviewed: a later re-upload (higher version) makes this review stale. */
  storagePath: string;
  version: number;
  reason: string;
  reviewedBy: string;
  reviewedByEmail: string | null;
  reviewedByRole: AdminRole;
  reviewedAt: IsoDate;
}

export type VettingReviews = Partial<Record<VettingDocType, DocumentReview>>;

export interface ReviewDocumentInput {
  mechanicId: string;
  docType: VettingDocType;
  decision: DocumentDecision;
  reason: string;
}
