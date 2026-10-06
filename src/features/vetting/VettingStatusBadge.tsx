import { VETTING_LABELS } from '@/lib/labels';
import type { VettingStatus } from '@/lib/vetting';

const SHAPE: Record<VettingStatus, string> = {
  // Filled / outlined / struck diamond so the state reads without colour.
  verified: 'bg-success',
  pending: 'border border-current bg-transparent text-muted',
  suspended: 'bg-danger',
};

/** Status as text plus a shape; the colour is a secondary cue only. */
export function VettingStatusBadge({ status }: { status: VettingStatus }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-control border border-hairline px-2 py-0.5 text-xs font-semibold">
      <span aria-hidden className={`size-2 rotate-45 ${SHAPE[status]}`} />
      {VETTING_LABELS[status]}
    </span>
  );
}
