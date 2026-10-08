import { documentsSummary, summaryText } from '@/lib/vettingDocuments';
import type { MechanicDoc } from '@/types';

import { useDocumentReviews, useVettingDocuments } from './documentHooks';

/** One line in the Decide panel: how the required documents stand before approving. */
export function DocumentsStanding({ mechanic }: { mechanic: MechanicDoc }) {
  const docs = useVettingDocuments(mechanic.userId);
  const reviews = useDocumentReviews(mechanic.userId);
  if (docs.status !== 'ready' || reviews.status !== 'ready') return null;
  const s = documentsSummary(mechanic.vehicles, docs.data, reviews.data);
  const complete = s.verified === s.required.length;
  return (
    <p className="mb-4 flex items-start gap-2 text-sm" aria-label="Documents standing">
      <span
        aria-hidden
        className={`mt-1.5 diamond ${complete ? 'text-success' : 'text-warning'}`}
      />
      <span>
        <span className="font-semibold">Documents: </span>
        {summaryText(s)}
        {!complete ? (
          <span className="text-muted">
            {' '}
            · approving is still your call; the checklist covers what was seen in person.
          </span>
        ) : null}
      </span>
    </p>
  );
}
