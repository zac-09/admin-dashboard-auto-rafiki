import { formatAgo, formatDateTime } from '@/lib/format';
import { useNow } from '@/lib/useLive';

import { Spinner } from '../ui/Spinner';

/**
 * For views read once rather than live: when the numbers were loaded, and a way to load them
 * again. `updatedAt` is react-query's `dataUpdatedAt`.
 */
export function Freshness({
  updatedAt,
  fetching,
  onRefresh,
}: {
  updatedAt: number;
  fetching: boolean;
  onRefresh: () => void;
}) {
  const now = useNow(30_000).getTime();
  if (!updatedAt) return null;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span title={formatDateTime(new Date(updatedAt).toISOString())}>
        {fetching ? 'Refreshing…' : `Updated ${formatAgo(updatedAt, now)}`}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={fetching}
        aria-busy={fetching || undefined}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-control border border-hairline px-2 font-semibold text-primary hover:border-primary disabled:cursor-progress"
      >
        {fetching ? <Spinner className="size-3" /> : null}
        Refresh
      </button>
    </span>
  );
}
