import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';

import { AnimatedNumber, Pop, springs, timings } from '@/components/motion';

import { SERVICE_LABELS } from '@/lib/labels';

import { ratingDirection, type Alert } from './alerts';
import { formatDuration } from './jobTime';

function AlertItem({ alert }: { alert: Alert }) {
  if (alert.kind === 'low-rating') {
    const r = alert.rating;
    return (
      <Link to={`/operations/jobs/${r.jobId}`} className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {r.stars} {r.stars === 1 ? 'star' : 'stars'}: {ratingDirection(r)}
        </span>
        {r.comment ? <span className="text-muted">“{r.comment}”</span> : null}
      </Link>
    );
  }
  const { job, ms } = alert;
  return (
    <Link to={`/operations/jobs/${job.id}`} className="flex flex-col gap-0.5">
      <span className="font-semibold">
        {alert.kind === 'stale-request'
          ? `No taker for ${formatDuration(ms)}`
          : `On the way for ${formatDuration(ms)}`}
      </span>
      <span className="text-muted">
        {SERVICE_LABELS[job.request.service]}, {job.request.location.label}
      </span>
    </Link>
  );
}

export function AlertRail({ alerts }: { alerts: readonly Alert[] }) {
  return (
    <section aria-label="Alerts" className="panel p-4">
      <h2 className="micro-label mb-3 flex items-center justify-between">
        <span>Alerts</span>
        <Pop trigger={alerts.length}>
          <AnimatedNumber value={alerts.length} />
        </Pop>
      </h2>
      {alerts.length === 0 ? (
        <p className="flex items-center gap-3 text-sm text-muted">
          <span aria-hidden className="diamond text-success" />
          Nothing needs you right now.
        </p>
      ) : (
        <ul className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {alerts.map((alert) => (
              <motion.li
                key={alert.key}
                layout
                className="flex gap-3"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: timings.exit }}
                transition={springs.settle}
              >
                <span aria-hidden className="mt-1.5 diamond sonar text-warning" />
                <AlertItem alert={alert} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
