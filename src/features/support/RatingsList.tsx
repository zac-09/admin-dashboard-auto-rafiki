import { Notice, SkeletonLines } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { ratedBy } from '@/lib/ratings';

import { useJobRatings } from './hooks';

/** Stars as shape + text ("2 of 5"), never colour alone. */
function Stars({ stars }: { stars: number }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden className="tracking-[0.15em]">
        {'★'.repeat(stars)}
        <span className="text-hairline">{'★'.repeat(5 - stars)}</span>
      </span>
      <span className="text-xs text-muted">{stars} of 5</span>
    </span>
  );
}

/** Both directions: how the customer rated the mechanic, and the mechanic the customer. */
export function RatingsList({ jobId }: { jobId: string }) {
  const live = useJobRatings(jobId);
  if (live.status === 'loading') return <SkeletonLines lines={2} />;
  if (live.status === 'error') {
    return <Notice tone="error">Could not load ratings: {live.error.message}</Notice>;
  }
  const byCustomer = live.data.find((r) => ratedBy(r) === 'customer');
  const byMechanic = live.data.find((r) => ratedBy(r) === 'mechanic');
  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      {(
        [
          ['Customer rated the mechanic', byCustomer],
          ['Mechanic rated the customer', byMechanic],
        ] as const
      ).map(([label, r]) => (
        <div key={label} className="flex flex-col gap-1">
          <dt className="micro-label">{label}</dt>
          <dd className="flex flex-col gap-1">
            {r ? (
              <>
                <Stars stars={r.stars} />
                {r.comment ? <span>“{r.comment}”</span> : null}
                <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
              </>
            ) : (
              <span className="text-muted">Not rated</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
