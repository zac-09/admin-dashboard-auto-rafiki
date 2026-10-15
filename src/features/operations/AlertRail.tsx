import { AnimatePresence, motion } from 'motion/react';
import { Link } from 'react-router';

import { AnimatedNumber, Pop, springs, timings } from '@/components/motion';

import { SERVICE_LABELS } from '@/lib/labels';

import { can } from '@/lib/permissions';
import { useSession } from '@/lib/session';

import { ratingDirection, type Alert } from './alerts';
import { DesktopAlertsToggle } from './notifications/DesktopAlertsToggle';
import { formatDuration } from './jobTime';

function AlertItem({ alert }: { alert: Alert }) {
  if (alert.kind === 'low-rating') {
    const r = alert.rating;
    return (
      <Link to={`/jobs/${r.jobId}`} className="flex flex-col gap-0.5">
        <span className="font-semibold">
          {r.stars} {r.stars === 1 ? 'star' : 'stars'}: {ratingDirection(r)}
        </span>
        {r.comment ? <span className="text-muted">“{r.comment}”</span> : null}
      </Link>
    );
  }
  if (alert.kind === 'out-of-reach') {
    const { job } = alert;
    return (
      <Link to={`/jobs/${job.id}`} className="flex flex-col gap-0.5">
        <span className="font-semibold">No mechanic online within {alert.radiusKm} km</span>
        <span className="text-muted">
          {SERVICE_LABELS[job.request.service]}, {job.request.location.label} ·{' '}
          {alert.nearestKm === null
            ? 'nobody online'
            : `nearest ${alert.nearestKm.toFixed(1)} km away`}
        </span>
      </Link>
    );
  }
  const { job, ms } = alert;
  return (
    <Link to={`/jobs/${job.id}`} className="flex flex-col gap-0.5">
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

/** One-click next step for an alert (the alert text itself opens the job). */
const ACTION =
  'mt-1 inline-flex min-h-8 items-center self-start rounded-control border border-hairline px-2 text-xs font-semibold hover:border-primary';

function AlertAction({ alert }: { alert: Alert }) {
  const session = useSession();
  if (alert.kind !== 'stale-request' && alert.kind !== 'out-of-reach') return null;
  const widen = can(session?.role, 'operations.intervene');
  const message = alert.kind === 'out-of-reach' && can(session?.role, 'mechanics.message');
  if (!widen && !message) return null;
  const { latitude, longitude, label } = alert.job.request.location;
  return (
    <span className="flex flex-wrap gap-2">
      {widen ? (
        <Link to={`/jobs/${alert.job.id}#rebroadcast`} className={ACTION}>
          Widen search
        </Link>
      ) : null}
      {message ? (
        <Link
          to={`/messages?${new URLSearchParams({ lat: String(latitude), lng: String(longitude), place: label })}`}
          className={ACTION}
        >
          Message mechanics near here
        </Link>
      ) : null}
    </span>
  );
}

export function AlertRail({ alerts }: { alerts: readonly Alert[] }) {
  return (
    <section aria-label="Alerts" className="panel p-4">
      <h2 className="micro-label mb-3 flex items-center justify-between">
        <span className="flex items-center gap-3">
          <span>Alerts</span>
          <Pop trigger={alerts.length}>
            <AnimatedNumber value={alerts.length} />
          </Pop>
        </span>
        <DesktopAlertsToggle />
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
                <span className="flex flex-col">
                  <AlertItem alert={alert} />
                  <AlertAction alert={alert} />
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
