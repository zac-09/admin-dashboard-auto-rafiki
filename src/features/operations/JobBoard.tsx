import { LayoutGroup, motion } from 'motion/react';
import { useState } from 'react';

import { AnimatedNumber, springs } from '@/components/motion';
import { Tabs } from '@/components/ui';
import { useIsDesktop } from '@/lib/useMediaQuery';
import { JOB_STATUSES, type CatalogueItem, type Job, type JobStatus } from '@/types';

import type { Alert } from './alerts';
import { groupByStatus, STATUS_LABELS } from './board';
import { JobCard } from './JobCard';

const ATTENTION: Record<'stale-request' | 'late-enroute', string> = {
  'stale-request': 'No taker yet',
  'late-enroute': 'On the way over 30 min',
};

/**
 * Cards that appeared or changed status since the board first loaded, so they can glow once.
 * Keyed by id + status: a job moving to the next column counts as new there.
 */
function useFreshKeys(jobs: readonly Job[]): Set<string> {
  const keyOf = (j: Job) => `${j.id}:${j.status}`;
  const [baseline] = useState(() => new Set(jobs.map(keyOf)));
  return new Set(jobs.map(keyOf).filter((k) => !baseline.has(k)));
}

interface BoardProps {
  jobs: readonly Job[];
  alerts: readonly Alert[];
  now: Date;
  mechanicNames: Map<string, string | null>;
  catalogue: readonly CatalogueItem[];
}

function Column({
  status,
  jobs,
  fresh,
  flagged,
  now,
  mechanicNames,
  catalogue,
}: {
  status: JobStatus;
  jobs: Job[];
  fresh: Set<string>;
  flagged: Map<string, string>;
  now: Date;
  mechanicNames: Map<string, string | null>;
  catalogue: readonly CatalogueItem[];
}) {
  return (
    <section aria-label={STATUS_LABELS[status]} className="flex flex-col gap-2">
      <h3 className="micro-label flex items-center justify-between border-b border-hairline pb-2">
        <span>{STATUS_LABELS[status]}</span>
        <AnimatedNumber value={jobs.length} />
      </h3>
      {jobs.length === 0 ? (
        <p className="flex min-h-16 items-center justify-center rounded-control border border-dashed border-hairline text-xs text-muted">
          No jobs
        </p>
      ) : null}
      {/* No AnimatePresence: a moved card unmounts at once and its shared layoutId makes the
          new one glide in from the old column (an exit here would leave a ghost). */}
      {jobs.map((job) => (
        <motion.div
          key={job.id}
          layoutId={job.id}
          layout="position"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={springs.settle}
        >
          <JobCard
            job={job}
            now={now}
            fresh={fresh.has(`${job.id}:${job.status}`)}
            attention={flagged.get(job.id)}
            mechanicName={job.mechanicId ? mechanicNames.get(job.mechanicId) : undefined}
            catalogue={catalogue}
          />
        </motion.div>
      ))}
    </section>
  );
}

export function JobBoard({ jobs, alerts, now, mechanicNames, catalogue }: BoardProps) {
  const isDesktop = useIsDesktop();
  const columns = groupByStatus(jobs);
  const fresh = useFreshKeys(jobs);
  const flagged = new Map(
    alerts.flatMap((a) =>
      a.kind === 'low-rating' ? [] : [[a.job.id, ATTENTION[a.kind]] as const],
    ),
  );
  // Phones: one column at a time, starting with the first one that has work in it.
  const [picked, setPicked] = useState<JobStatus | null>(null);
  const shown = picked ?? JOB_STATUSES.find((s) => columns[s].length > 0) ?? 'requested';
  const columnProps = { fresh, flagged, now, mechanicNames, catalogue };

  if (!isDesktop) {
    return (
      <div>
        <div className="-mx-4 px-4">
          <Tabs
            label="Job status"
            value={shown}
            onChange={setPicked}
            items={JOB_STATUSES.map((s) => ({
              id: s,
              label: STATUS_LABELS[s],
              count: columns[s].length,
            }))}
          />
        </div>
        <LayoutGroup>
          <Column status={shown} jobs={columns[shown]} {...columnProps} />
        </LayoutGroup>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto pb-2">
      {/* Shared layout ids: when a job changes status its card glides to the next column. */}
      <LayoutGroup>
        <div className="grid min-w-max auto-cols-[13.5rem] grid-flow-col gap-3">
          {JOB_STATUSES.map((status) => (
            <Column key={status} status={status} jobs={columns[status]} {...columnProps} />
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
