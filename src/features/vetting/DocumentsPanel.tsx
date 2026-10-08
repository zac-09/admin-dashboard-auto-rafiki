import { useState, type FormEvent } from 'react';

import { Reveal, staggerDelay, SuccessMoment } from '@/components/motion';
import { Button, Notice, Skeleton, SkeletonLines } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';
import { MAX_REASON } from '@/lib/vetting';
import {
  DOC_LABELS,
  DOCUMENT_STATE_LABELS,
  documentState,
  formatBytes,
  requiredDocTypes,
  type DocumentState,
} from '@/lib/vettingDocuments';
import {
  VETTING_DOC_TYPES,
  type DocumentDecision,
  type MechanicDoc,
  type VettingDocType,
  type VettingDocument,
  type DocumentReview,
} from '@/types';

import {
  useDocumentFile,
  useDocumentReviews,
  useReviewDocument,
  useVettingDocuments,
} from './documentHooks';

/** Shape + text per state; colour is only a secondary cue. */
const STATE_SHAPE: Record<DocumentState, string> = {
  missing: 'sonar bg-warning text-warning',
  uploaded: 'border border-current bg-transparent text-muted',
  verified: 'bg-success',
  rejected: 'bg-danger',
  reuploaded: 'sonar bg-warning text-warning',
};

function StateBadge({ state }: { state: DocumentState }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-hairline px-2 py-0.5 text-xs font-semibold">
      <span aria-hidden className={`size-2 rotate-45 ${STATE_SHAPE[state]}`} />
      {DOCUMENT_STATE_LABELS[state]}
    </span>
  );
}

function Preview({ doc, label }: { doc: VettingDocument; label: string }) {
  const file = useDocumentFile(doc.storagePath, doc.contentType);
  if (file.isPending) return <Skeleton className="h-48 w-full" />;
  if (file.error) {
    return <Notice tone="error">Could not load the file: {file.error.message}</Notice>;
  }
  const { url } = file.data;
  if (doc.contentType === 'application/pdf') {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={url}
          title={`${label} (PDF)`}
          className="h-96 w-full rounded-control border border-hairline bg-surface"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-xs underline"
        >
          Open the PDF in a new tab
        </a>
      </div>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      title="Open full size"
    >
      <img
        src={url}
        alt={`${label}, as uploaded`}
        className="max-h-96 w-auto max-w-full rounded-control border border-hairline"
      />
    </a>
  );
}

function ReviewForm({
  mechanic,
  docType,
  onMoment,
}: {
  mechanic: MechanicDoc;
  docType: VettingDocType;
  onMoment: (m: { status: 'pending' | 'success'; title: string } | null) => void;
}) {
  const review = useReviewDocument();
  const [decision, setDecision] = useState<DocumentDecision | null>(null);
  const [reason, setReason] = useState('');
  const label = DOC_LABELS[docType];
  if (!decision) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setDecision('verified')}>
          Verify {label}
        </Button>
        <Button variant="ghost" onClick={() => setDecision('rejected')}>
          Reject…
        </Button>
      </div>
    );
  }
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim() || !decision) return;
    onMoment({ status: 'pending', title: '' });
    try {
      await review.mutateAsync({
        mechanicId: mechanic.userId,
        docType,
        decision,
        reason: reason.trim(),
      });
      onMoment({
        status: 'success',
        title: decision === 'verified' ? `${label} verified` : `${label} rejected`,
      });
      setDecision(null);
      setReason('');
    } catch {
      onMoment(null);
    }
  }
  return (
    <form
      onSubmit={onSubmit}
      aria-label={`${decision === 'verified' ? 'Verify' : 'Reject'} ${label}`}
      className="flex flex-col gap-2 rounded-control border border-hairline bg-surface p-3"
    >
      <label className="flex flex-col gap-1.5">
        <span className="micro-label">
          {decision === 'verified'
            ? 'What you checked (kept in the audit log)'
            : 'Why it is rejected (tell the mechanic by phone)'}
        </span>
        <input
          value={reason}
          maxLength={MAX_REASON}
          onChange={(e) => setReason(e.target.value)}
          className="min-h-10 rounded-control border border-hairline bg-background px-3 text-sm"
        />
      </label>
      {review.error ? <Notice tone="error">{review.error.message}</Notice> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={() => setDecision(null)}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant={decision === 'rejected' ? 'danger' : 'primary'}
          disabled={!reason.trim() || review.isPending}
        >
          {decision === 'verified' ? 'Mark verified' : 'Mark rejected'}
        </Button>
      </div>
    </form>
  );
}

function ReviewSummary({ review }: { review: DocumentReview }) {
  return (
    <p className="text-xs text-muted">
      {review.decision === 'verified' ? 'Verified' : 'Rejected'} by{' '}
      {review.reviewedByEmail ?? review.reviewedBy} · {formatDateTime(review.reviewedAt)} · “
      {review.reason}”
    </p>
  );
}

/** A mechanic's ID, certification and (for boda) riding permit, with the dashboard's reviews. */
export function DocumentsPanel({ mechanic }: { mechanic: MechanicDoc }) {
  const session = useSession();
  const docs = useVettingDocuments(mechanic.userId);
  const reviews = useDocumentReviews(mechanic.userId);
  const [moment, setMoment] = useState<{ status: 'pending' | 'success'; title: string } | null>(
    null,
  );
  const canDecide = can(session?.role, 'vetting.decide');

  if (docs.status === 'loading' || reviews.status === 'loading') return <SkeletonLines lines={3} />;
  if (docs.status === 'error')
    return <Notice tone="error">Could not load documents: {docs.error.message}</Notice>;
  if (reviews.status === 'error')
    return <Notice tone="error">Could not load reviews: {reviews.error.message}</Notice>;

  const required = requiredDocTypes(mechanic.vehicles);
  // Required first, then anything else that was uploaded (e.g. a permit from a car-only mechanic).
  const shown = [
    ...required,
    ...VETTING_DOC_TYPES.filter((t) => !required.includes(t) && docs.data[t]),
  ];
  const uploadedAny = shown.some((t) => docs.data[t]);

  return (
    <div className="flex flex-col gap-5">
      {moment ? (
        <SuccessMoment
          status={moment.status}
          pendingTitle="Saving the review…"
          title={moment.title}
          onDone={() => setMoment(null)}
        />
      ) : null}
      {!uploadedAny ? (
        <p className="text-sm text-muted">
          Nothing uploaded yet. Mechanics upload from the app's apply screen and profile; until
          then, check documents in person during the practical assessment.
        </p>
      ) : null}
      <ul className="flex flex-col gap-5" aria-label="Vetting documents">
        {shown.map((t, i) => {
          const doc = docs.data[t];
          const review = reviews.data[t];
          const state = documentState(doc, review);
          const isRequired = required.includes(t);
          return (
            <Reveal
              as="li"
              key={t}
              delay={staggerDelay(i, shown.length)}
              className="flex flex-col gap-3"
              aria-label={DOC_LABELS[t]}
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-semibold">{DOC_LABELS[t]}</span>
                <StateBadge state={state} />
                {!isRequired ? (
                  <span className="text-xs text-muted">Not required for their vehicles</span>
                ) : null}
                {doc ? (
                  <span className="text-xs text-muted">
                    v{doc.version} · {formatBytes(doc.sizeBytes)} · uploaded{' '}
                    {formatDateTime(doc.uploadedAt)}
                  </span>
                ) : null}
              </div>
              {doc ? <Preview doc={doc} label={DOC_LABELS[t]} /> : null}
              {review && state !== 'reuploaded' ? <ReviewSummary review={review} /> : null}
              {review && state === 'reuploaded' ? (
                <p className="text-xs text-muted">
                  An earlier file (v{review.version}) was {review.decision}. This one has not been
                  reviewed.
                </p>
              ) : null}
              {doc && canDecide ? (
                <ReviewForm mechanic={mechanic} docType={t} onMoment={setMoment} />
              ) : null}
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
}
