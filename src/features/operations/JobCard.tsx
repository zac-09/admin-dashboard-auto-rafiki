import { Link } from 'react-router';

import { itemLabels } from '@/lib/catalogue';
import { formatUgx } from '@/lib/format';
import { bookingWindow, jobTitle } from '@/lib/jobs';
import { VEHICLE_LABELS } from '@/lib/labels';
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
      {job.request.booking ? (
        // Scheduled, not urgent: say when, in words and with its own shape.
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <span aria-hidden className="size-2 rounded-full border border-accent" />
          Booked for {bookingWindow(job.request.booking)}
        </span>
      ) : null}
      <span className="font-semibold">
        {jobTitle(job)} · {VEHICLE_LABELS[job.request.vehicle]}
        {job.request.vehiclePlate ? (
          <span className="font-normal text-muted"> · {job.request.vehiclePlate}</span>
        ) : null}
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
              : job.request.booking && job.status === 'requested'
                ? 'Waiting for a mechanic to confirm'
                : `${formatDuration(msInStatus(job, now))} in status`}
        </span>
      </span>
    </Link>
  );
}
