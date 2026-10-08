import type { AuditEntry } from '../../src/types/audit';
import type { VettingDocument } from '../../src/types/domain';
import type { DocumentReview, VettingReviews } from '../../src/types/vettingReviews';
import { reviewDocument, type ReviewDeps } from '../src/reviewDocument';
import type { Caller } from '../src/setUserRole';

const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const NOW = '2026-10-08T12:00:00.000Z';

const doc = (docType: VettingDocument['docType'], version = 1): VettingDocument => ({
  docType,
  storagePath: `vetting/m1/${docType}/file-${version}`,
  contentType: 'image/jpeg',
  sizeBytes: 240_000,
  uploadedAt: '2026-10-08T09:00:00.000Z',
  version,
});

function world(docs: Partial<Record<string, VettingDocument>>, reviews: VettingReviews = {}) {
  const state = { reviews: structuredClone(reviews) };
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: ReviewDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      await run({
        getBusinessName: async (id) => (id === 'm1' ? 'Ssempala Boda Fix' : null),
        getDocument: async (_id, t) => docs[t] ?? null,
        getReviews: async () => structuredClone(state.reviews),
        setReview: (_id, t, r) => writes.push(() => (state.reviews[t] = r)),
        audit: (e) => writes.push(() => audit.push(e)),
      });
      writes.forEach((w) => w());
    },
    now: () => new Date(NOW),
  };
  return { deps, state, audit };
}

describe('reviewDocument', () => {
  it('verifies the exact file, with who and why, audited', async () => {
    const w = world({ 'national-id': doc('national-id', 2) });
    const r = await reviewDocument(
      OPS,
      {
        mechanicId: 'm1',
        docType: 'national-id',
        decision: 'verified',
        reason: 'Matches the person',
      },
      w.deps,
    );
    expect(r).toEqual({ mechanicId: 'm1', docType: 'national-id', decision: 'verified' });
    expect(w.state.reviews['national-id']).toEqual({
      decision: 'verified',
      storagePath: 'vetting/m1/national-id/file-2',
      version: 2,
      reason: 'Matches the person',
      reviewedBy: 'o1',
      reviewedByEmail: 'ops@autorafiki.test',
      reviewedByRole: 'ops',
      reviewedAt: NOW,
    } satisfies DocumentReview);
    expect(w.audit).toEqual([
      expect.objectContaining({
        action: 'mechanic.document.review',
        targetType: 'mechanic',
        targetId: 'm1',
        targetLabel: 'Ssempala Boda Fix: National ID v2',
        before: null,
        after: 'verified',
      }),
    ]);
  });

  it('a second review of the same file records the previous decision', async () => {
    const w = world({ certification: doc('certification') });
    await reviewDocument(
      OPS,
      { mechanicId: 'm1', docType: 'certification', decision: 'rejected', reason: 'Blurry' },
      w.deps,
    );
    await reviewDocument(
      OPS,
      {
        mechanicId: 'm1',
        docType: 'certification',
        decision: 'verified',
        reason: 'Seen in person',
      },
      w.deps,
    );
    expect(w.audit.map((a) => [a.before, a.after])).toEqual([
      [null, 'rejected'],
      ['rejected', 'verified'],
    ]);
  });

  it('a review after a re-upload starts fresh (the old review was of another file)', async () => {
    const stale: DocumentReview = {
      decision: 'rejected',
      storagePath: 'vetting/m1/certification/file-1',
      version: 1,
      reason: 'x',
      reviewedBy: 'o1',
      reviewedByEmail: null,
      reviewedByRole: 'ops',
      reviewedAt: NOW,
    };
    const w = world({ certification: doc('certification', 2) }, { certification: stale });
    await reviewDocument(
      OPS,
      { mechanicId: 'm1', docType: 'certification', decision: 'verified', reason: 'Clear now' },
      w.deps,
    );
    expect(w.audit[0]).toMatchObject({
      before: null,
      after: 'verified',
      targetLabel: 'Ssempala Boda Fix: Mechanic certification v2',
    });
    expect(w.state.reviews.certification?.version).toBe(2);
  });

  it('refuses a document that was never uploaded, an unknown mechanic, bad input, and support', async () => {
    const w = world({ 'national-id': doc('national-id') });
    const ok = { mechanicId: 'm1', docType: 'national-id', decision: 'verified', reason: 'x' };
    await expect(
      reviewDocument(OPS, { ...ok, docType: 'riding-permit' }, w.deps),
    ).rejects.toMatchObject({
      code: 'failed-precondition',
      message: expect.stringMatching(/Riding permit has not been uploaded/),
    });
    await expect(reviewDocument(OPS, { ...ok, mechanicId: 'ghost' }, w.deps)).rejects.toMatchObject(
      { code: 'not-found' },
    );
    await expect(reviewDocument(OPS, { ...ok, docType: 'passport' }, w.deps)).rejects.toMatchObject(
      { code: 'invalid-argument' },
    );
    await expect(reviewDocument(OPS, { ...ok, decision: 'maybe' }, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(reviewDocument(OPS, { ...ok, reason: ' ' }, w.deps)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(reviewDocument({ ...OPS, role: 'support' }, ok, w.deps)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(reviewDocument(null, ok, w.deps)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
    expect(w.audit).toHaveLength(0);
  });
});
