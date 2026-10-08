/**
 * Control-room interventions, shared by the dashboard and the cancelJob / rebroadcastJob
 * Cloud Functions. They follow the app's own rules: the job state machine (ported verbatim in
 * src/types/jobStateMachine.ts) and the settings/app broadcast bounds.
 */
import { canTransition } from '../types/jobStateMachine';
import type { Job, JobStatus } from '../types/domain';

import { LIMITS } from './appSettings';

/**
 * Ops cancel with exactly the customer's cancel rights in the app's state machine
 * (requested, matched, enroute): never once the mechanic has arrived or work has started.
 */
export function canAdminCancel(status: JobStatus): boolean {
  return canTransition(status, 'cancelled', 'customer');
}

/** Only an open request (no mechanic yet) can be re-broadcast, as in the app. */
export function canRebroadcast(job: Pick<Job, 'status' | 'mechanicId'>): boolean {
  return job.status === 'requested' && !job.mechanicId;
}

/**
 * Radius choices for re-broadcasting a job now at `currentKm`: the same radius (renews the
 * window and alerts everyone again) or wider, never narrower, within the settings bounds.
 */
export function rebroadcastOptions(currentKm: number, expandedKm: number): number[] {
  const candidates = [currentKm, expandedKm, 10, 12, 15, 20, 30];
  return [...new Set(candidates)]
    .filter((km) => km >= currentKm && km >= LIMITS.radiusKm.min && km <= LIMITS.radiusKm.max)
    .sort((a, b) => a - b);
}

export function isValidRebroadcastRadius(currentKm: number, km: unknown): km is number {
  return (
    typeof km === 'number' &&
    Number.isFinite(km) &&
    km >= currentKm &&
    km >= LIMITS.radiusKm.min &&
    km <= LIMITS.radiusKm.max
  );
}
