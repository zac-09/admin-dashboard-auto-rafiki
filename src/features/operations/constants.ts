import type { JobStatus } from '@/types';

/** Statuses the control room watches live (everything not yet finished). */
export const ACTIVE_STATUSES: readonly JobStatus[] = [
  'requested',
  'matched',
  'enroute',
  'arrived',
  'working',
];
export const CLOSED_STATUSES: readonly JobStatus[] = ['complete', 'cancelled'];

/** Alert rail thresholds (CLAUDE.md, module 2). */
export const STALE_REQUEST_MS = 2 * 60_000;
/** The north-star metric: a mechanic on the way for longer than this is a breach. */
export const LATE_ENROUTE_MS = 30 * 60_000;
export const LOW_RATING_MAX_STARS = 2;
/** How far back the alert rail looks for low ratings. */
export const LOW_RATING_WINDOW_MS = 7 * 24 * 60 * 60_000;
/** How far back the board shows complete / cancelled jobs. */
export const CLOSED_WINDOW_MS = 24 * 60 * 60_000;
