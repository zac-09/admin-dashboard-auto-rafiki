import type { DocumentReview, VettingDocument } from '@/types';

import {
  documentState,
  documentsSummary,
  requiredDocTypes,
  summaryText,
} from '../vettingDocuments';

const doc = (version = 1): VettingDocument => ({
  docType: 'national-id',
  storagePath: `vetting/m/national-id/f${version}`,
  contentType: 'image/jpeg',
  sizeBytes: 1000,
  uploadedAt: '2026-10-08T09:00:00.000Z',
  version,
});
const review = (decision: DocumentReview['decision'], version = 1): DocumentReview => ({
  decision,
  storagePath: `vetting/m/national-id/f${version}`,
  version,
  reason: 'x',
  reviewedBy: 'o',
  reviewedByEmail: null,
  reviewedByRole: 'ops',
  reviewedAt: '2026-10-08T10:00:00.000Z',
});

describe('vetting documents', () => {
  it('requires the riding permit only for boda mechanics (as the app)', () => {
    expect(requiredDocTypes(['car', 'matatu'])).toEqual(['national-id', 'certification']);
    expect(requiredDocTypes(['boda'])).toEqual(['national-id', 'certification', 'riding-permit']);
  });

  it('derives the state from the document and the review of that exact file', () => {
    expect(documentState(undefined, undefined)).toBe('missing');
    expect(documentState(doc(), undefined)).toBe('uploaded');
    expect(documentState(doc(), review('verified'))).toBe('verified');
    expect(documentState(doc(), review('rejected'))).toBe('rejected');
    expect(documentState(doc(2), review('verified', 1))).toBe('reuploaded');
  });

  it('summarises the required set for the Decide panel', () => {
    const s = documentsSummary(
      ['boda'],
      { 'national-id': doc() },
      { 'national-id': review('verified') },
    );
    expect(s).toMatchObject({
      verified: 1,
      missing: ['certification', 'riding-permit'],
      rejected: [],
      pending: [],
    });
    expect(summaryText(s)).toBe('1 of 3 verified · 2 not uploaded');
    // ID and certification are required for everyone; only the permit depends on vehicles.
    expect(summaryText(documentsSummary([], {}, {}))).toBe('0 of 2 verified · 2 not uploaded');
  });
});
