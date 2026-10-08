import { VETTING_DOC_TYPES } from '@/types';
import type {
  DocumentReview,
  LoadedFile,
  ReviewDocumentInput,
  Unsubscribe,
  VettingDocType,
  VettingDocument,
  VettingDocumentsRepository,
  VettingReviews,
} from '@/types';

import type { MockAuthRepository } from './mockAuthRepository';
import type { MockVettingStore } from './mockVettingRepositories';
import { TINY_PDF_DATA_URL, TINY_PNG_DATA_URL, VETTING_DOCUMENTS } from './vettingDocumentFixtures';

/** Mirrors reviewDocument (functions/src/reviewDocument.ts) over in-memory documents. */
export class MockVettingDocumentsRepository implements VettingDocumentsRepository {
  private docs = structuredClone(VETTING_DOCUMENTS);
  private reviews = new Map<string, VettingReviews>();
  private listeners = new Set<() => void>();
  private readonly vetting: MockVettingStore;
  private readonly auth: MockAuthRepository;

  constructor(vetting: MockVettingStore, auth: MockAuthRepository) {
    this.vetting = vetting;
    this.auth = auth;
  }

  private watch(emit: () => void): Unsubscribe {
    this.listeners.add(emit);
    emit();
    return () => this.listeners.delete(emit);
  }

  subscribeDocuments(
    mechanicId: string,
    onChange: (docs: Partial<Record<VettingDocType, VettingDocument>>) => void,
  ): Unsubscribe {
    return this.watch(() => onChange(structuredClone(this.docs[mechanicId] ?? {})));
  }

  subscribeReviews(mechanicId: string, onChange: (reviews: VettingReviews) => void): Unsubscribe {
    return this.watch(() => onChange(structuredClone(this.reviews.get(mechanicId) ?? {})));
  }

  async loadFile(_storagePath: string, contentType: string): Promise<LoadedFile> {
    // Data URLs need no object URL (and jsdom has none): nothing to revoke.
    const url = contentType === 'application/pdf' ? TINY_PDF_DATA_URL : TINY_PNG_DATA_URL;
    return { url, contentType, revoke: () => undefined };
  }

  async review(input: ReviewDocumentInput): Promise<void> {
    const actor = this.auth.current();
    if (!actor?.role || actor.role === 'support')
      throw new Error('Your role cannot review documents.');
    if (!VETTING_DOC_TYPES.includes(input.docType)) throw new Error('Unknown document type.');
    if (!input.reason.trim()) throw new Error('A reason is required.');
    const mechanic = this.vetting.mechanics.get(input.mechanicId);
    if (!mechanic) throw new Error('No mechanic with that id.');
    const doc = this.docs[input.mechanicId]?.[input.docType];
    if (!doc) throw new Error('That document has not been uploaded.');
    const review: DocumentReview = {
      decision: input.decision,
      storagePath: doc.storagePath,
      version: doc.version,
      reason: input.reason.trim(),
      reviewedBy: actor.uid,
      reviewedByEmail: actor.email,
      reviewedByRole: actor.role,
      reviewedAt: new Date().toISOString(),
    };
    this.reviews.set(input.mechanicId, {
      ...this.reviews.get(input.mechanicId),
      [input.docType]: review,
    });
    this.vetting.audit.push({
      id: `audit_mock_${this.vetting.audit.length + 1}`,
      action: 'mechanic.document.review',
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      targetType: 'mechanic',
      targetId: input.mechanicId,
      targetLabel: `${mechanic.businessName}: ${input.docType} v${doc.version}`,
      before: null,
      after: input.decision,
      reason: review.reason,
      at: review.reviewedAt,
    });
    this.listeners.forEach((l) => l());
  }
}
