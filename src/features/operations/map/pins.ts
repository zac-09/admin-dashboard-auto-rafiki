import type { Job, JobStatus, MechanicDoc } from '@/types';

import type { Alert } from '../alerts';

export interface JobPin {
  id: string;
  position: google.maps.LatLngLiteral;
  status: JobStatus;
  /** Short status text shown on the pin itself. */
  label: string;
  attention: boolean;
}

export interface MechanicPin {
  id: string;
  position: google.maps.LatLngLiteral;
  name: string;
  /** Only verified + online mechanics receive broadcasts. */
  receivesJobs: boolean;
}

const PIN_LABELS: Partial<Record<JobStatus, string>> = {
  requested: 'Request',
  matched: 'Assigned',
  enroute: 'On the way',
  arrived: 'Arrived',
  working: 'Working',
};

export function jobPins(jobs: readonly Job[], alerts: readonly Alert[]): JobPin[] {
  const flagged = new Set(alerts.flatMap((a) => (a.kind === 'low-rating' ? [] : [a.job.id])));
  return jobs
    .filter((j) => PIN_LABELS[j.status])
    .map((j) => ({
      id: j.id,
      position: { lat: j.request.location.latitude, lng: j.request.location.longitude },
      status: j.status,
      label: PIN_LABELS[j.status]!,
      attention: flagged.has(j.id),
    }));
}

export function mechanicPins(mechanics: readonly MechanicDoc[]): MechanicPin[] {
  return mechanics.flatMap((m) =>
    m.isOnline && m.lastKnownLocation
      ? [
          {
            id: m.userId,
            position: { lat: m.lastKnownLocation.latitude, lng: m.lastKnownLocation.longitude },
            name: m.businessName,
            receivesJobs: m.vetting === 'verified',
          },
        ]
      : [],
  );
}
