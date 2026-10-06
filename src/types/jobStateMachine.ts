/**
 * MIRRORED from the app repo (auto-rafiki) src/types/jobStateMachine.ts. Keep verbatim below
 * this header. Cloud Functions in this repo import it so interventions respect the same
 * transitions the app enforces.
 */

import type { JobStatus, UserRole } from './domain';

/** Legal transitions per actor. Terminal states have none. */
const TRANSITIONS: Record<UserRole, Partial<Record<JobStatus, readonly JobStatus[]>>> = {
  mechanic: {
    requested: ['matched'],
    matched: ['enroute', 'arrived', 'cancelled'],
    enroute: ['arrived', 'cancelled'],
    arrived: ['working'],
    working: ['complete'],
  },
  customer: {
    requested: ['cancelled'],
    matched: ['cancelled'],
    enroute: ['cancelled'],
  },
};

export function canTransition(from: JobStatus, to: JobStatus, by: UserRole): boolean {
  return (TRANSITIONS[by][from] ?? []).includes(to);
}

export class IllegalTransitionError extends Error {
  readonly code = 'illegal-transition' as const;
  constructor(from: JobStatus, to: JobStatus, by: UserRole) {
    super(`${by} cannot move a job from ${from} to ${to}`);
    this.name = 'IllegalTransitionError';
  }
}

/** Throws when the move is not allowed; repositories call this before writing. */
export function assertTransition(from: JobStatus, to: JobStatus, by: UserRole): void {
  if (!canTransition(from, to, by)) throw new IllegalTransitionError(from, to, by);
}
