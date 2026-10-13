import { SERVICE_LABELS } from '@/lib/labels';

import { ratingDirection, type Alert } from '../alerts';
import { formatDuration } from '../jobTime';

export interface PlannedNotification {
  /** Same tag replaces, never stacks, on the operator's desktop. */
  tag: string;
  title: string;
  body: string;
  /** Where clicking the notification takes the operator. */
  path: string;
}

/** More new alerts than this at once become one summary notification. */
export const MAX_INDIVIDUAL = 3;

function describe(alert: Alert): PlannedNotification {
  if (alert.kind === 'low-rating') {
    const r = alert.rating;
    return {
      tag: alert.key,
      title: `${r.stars}-star rating`,
      body: `${ratingDirection(r)}${r.comment ? `: “${r.comment}”` : ''}`,
      path: `/jobs/${r.jobId}`,
    };
  }
  const { job, ms } = alert;
  const where = `${SERVICE_LABELS[job.request.service]}, ${job.request.location.label}`;
  return {
    tag: alert.key,
    title:
      alert.kind === 'stale-request'
        ? `No mechanic has taken a request for ${formatDuration(ms)}`
        : `Mechanic on the way for ${formatDuration(ms)}`,
    body: where,
    path: `/jobs/${job.id}`,
  };
}

/**
 * What to show for the alerts not notified before (`seen` holds alert keys). A burst (opening
 * the dashboard onto several alerts) becomes one summary instead of a wall of popups.
 */
export function planNotifications(
  alerts: readonly Alert[],
  seen: ReadonlySet<string>,
): PlannedNotification[] {
  const fresh = alerts.filter((a) => !seen.has(a.key));
  if (fresh.length <= MAX_INDIVIDUAL) return fresh.map(describe);
  return [
    {
      tag: 'autorafiki-summary',
      title: `${fresh.length} alerts need attention`,
      body: fresh
        .slice(0, MAX_INDIVIDUAL)
        .map((a) => describe(a).title)
        .join('\n'),
      path: '/operations',
    },
  ];
}
