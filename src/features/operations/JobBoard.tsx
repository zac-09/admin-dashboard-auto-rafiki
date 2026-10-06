import { LayoutGroup, motion } from 'motion/react';

import { AnimatedNumber, springs } from '@/components/motion';
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
      {/* Shared layout ids: when a job changes status its card glides to the next column. */}
      <LayoutGroup>
        <div className="grid min-w-max auto-cols-[13.5rem] grid-flow-col gap-3">
          {JOB_STATUSES.map((status) => (
            <section
              key={status}
              aria-label={STATUS_LABELS[status]}
              className="flex flex-col gap-2"
            >
              <h3 className="micro-label flex items-center justify-between border-b border-hairline pb-2">
                <span>{STATUS_LABELS[status]}</span>
                <AnimatedNumber value={columns[status].length} />
              </h3>
              {columns[status].length === 0 ? (
                <p className="py-2 text-xs text-muted">None</p>
              ) : null}
              {/* No AnimatePresence: a moved card unmounts at once and its shared layoutId makes
                  the new one glide in from the old column (an exit here would leave a ghost). */}
              {columns[status].map((job) => (
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
                    attention={flagged.get(job.id)}
                    mechanicName={job.mechanicId ? mechanicNames.get(job.mechanicId) : undefined}
                  />
                </motion.div>
              ))}
            </section>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}
