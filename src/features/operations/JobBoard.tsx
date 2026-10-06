import { JOB_STATUSES, type Job } from '@/types';

import type { Alert } from './alerts';
import { groupByStatus, STATUS_LABELS } from './board';
import { JobCard } from './JobCard';

const ATTENTION: Record<'stale-request' | 'late-enroute', string> = {
  'stale-request': 'No taker yet',
  'late-enroute': 'On the way over 30 min',
};

export function JobBoard({
  jobs,
  alerts,
  now,
  mechanicNames,
}: {
  jobs: readonly Job[];
  alerts: readonly Alert[];
  now: Date;
  mechanicNames: Map<string, string | null>;
}) {
  const columns = groupByStatus(jobs);
  const flagged = new Map(
    alerts.flatMap((a) =>
      a.kind === 'low-rating' ? [] : [[a.job.id, ATTENTION[a.kind]] as const],
    ),
  );
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-max auto-cols-[13.5rem] grid-flow-col gap-3">
        {JOB_STATUSES.map((status) => (
          <section key={status} aria-label={STATUS_LABELS[status]} className="flex flex-col gap-2">
            <h3 className="micro-label flex items-center justify-between border-b border-hairline pb-2">
              <span>{STATUS_LABELS[status]}</span>
              <span>{columns[status].length}</span>
            </h3>
            {columns[status].length === 0 ? (
              <p className="py-2 text-xs text-muted">None</p>
            ) : (
              columns[status].map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  now={now}
                  attention={flagged.get(job.id)}
                  mechanicName={job.mechanicId ? mechanicNames.get(job.mechanicId) : undefined}
                />
              ))
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
