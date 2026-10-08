import { Link } from 'react-router';

import { itemLabels } from '@/lib/catalogue';
import { formatUgx } from '@/lib/format';
import { SERVICE_LABELS, VEHICLE_LABELS } from '@/lib/labels';
import type { CatalogueItem, Job } from '@/types';

import { CANCELLED_BY_LABELS } from './board';
import { formatDuration, msInStatus } from './jobTime';

export function JobCard({
  job,
  now,
  mechanicName,
  attention,
  fresh = false,
  catalogue = [],
}: {
  job: Job;
  now: Date;
  mechanicName?: string | null;
  /** Resolves request.items (catalogue ids) to labels; an unknown id shows as itself. */
  catalogue?: readonly CatalogueItem[];
  /** Just arrived or just changed status: glow once. */
  fresh?: boolean;
  /** Set when the alert rail flags this job; shown as text, not just colour. */
  attention?: string;
}) {
  const closed = job.status === 'complete' || job.status === 'cancelled';
  return (
    <Link
      to={`/jobs/${job.id}`}
      className={`flex flex-col gap-1 rounded-control border bg-background p-3 text-sm transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary ${
        attention ? 'border-warning' : 'border-hairline'
      } ${fresh ? 'fresh' : ''}`}
    >
      {attention ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span aria-hidden className="diamond sonar text-warning" />
          {attention}
        </span>
      ) : null}
      <span className="font-semibold">
        {SERVICE_LABELS[job.request.service]} · {VEHICLE_LABELS[job.request.vehicle]}
      </span>
      <span className="text-muted">{job.request.location.label}</span>
      {job.request.items?.length ? (
        <span
          className="truncate text-xs text-muted"
          title={itemLabels(job.request.items, catalogue).join(', ')}
        >
          {itemLabels(job.request.items, catalogue).join(' · ')}
        </span>
      ) : null}
      {job.mechanicId ? (
        <span className="text-xs">{mechanicName ?? 'Mechanic assigned'}</span>
      ) : null}
      <span className="flex items-center justify-between text-xs text-muted">
        <span>{formatUgx(job.fee)}</span>
        <span>
          {job.status === 'cancelled' && job.cancelledBy
            ? `Cancelled ${CANCELLED_BY_LABELS[job.cancelledBy] ?? ''}`
            : closed
              ? formatDuration(msInStatus(job, now)) + ' ago'
              : `${formatDuration(msInStatus(job, now))} in status`}
        </span>
      </span>
    </Link>
  );
}
