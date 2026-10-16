import type { Job, JobStatus } from '@/types';

/** When the job entered `status`, from its timeline (ms), or null if it never did. */
export function enteredAt(job: Job, status: JobStatus): number | null {
  const entry = job.timeline.find((t) => t.status === status);
  return entry ? Date.parse(entry.at) : null;
}

/**
 * A request nobody took: it ended cancelled without ever being matched (the broadcast ran
 * out, or the customer gave up waiting). This is the coverage-gap signal.
 */
export function isUnserved(job: Job): boolean {
  return job.status === 'cancelled' && enteredAt(job, 'matched') === null;
}

/** The app's own estimate for a distance (auto-rafiki src/lib/location/geo.ts: 18 km/h, ≥ 2 min). */
export function appEstimateMinutes(km: number): number {
  return Math.max(2, Math.round((km / 18) * 60));
}

/** Minutes from setting off (enroute) to arriving; null without both. */
export function travelMinutes(job: Job): number | null {
  const from = enteredAt(job, 'enroute');
  const to = enteredAt(job, 'arrived');
  return from === null || to === null ? null : (to - from) / 60_000;
}

/**
 * Minutes from request to arrival: the north-star measure, for breakdowns only. A booking is
 * requested days ahead of its window, so it has no request-to-arrival time.
 */
export function arrivalMinutes(job: Job): number | null {
  if (job.request.booking) return null;
  const to = enteredAt(job, 'arrived');
  return to === null ? null : (to - Date.parse(job.request.createdAt)) / 60_000;
}

/**
 * Minutes later (positive) or earlier than expected. The app stores no promised ETA in
 * Firestore, so the expectation is `etaMinutes` when present and otherwise the app's estimate
 * for the kilometres actually driven (`distanceKm`, written on arrival).
 */
export function lateMinutes(job: Job): number | null {
  const actual = travelMinutes(job);
  if (actual === null) return null;
  const expected =
    job.etaMinutes ?? (job.distanceKm != null ? appEstimateMinutes(job.distanceKm) : null);
  return expected === null ? null : actual - expected;
}

/** Kampala local time (UTC+3, no daylight saving): day 0 = Monday, hour 0–23. */
export function kampalaSlot(iso: string): { day: number; hour: number } {
  const local = new Date(Date.parse(iso) + 3 * 3_600_000);
  return { day: (local.getUTCDay() + 6) % 7, hour: local.getUTCHours() };
}

export { haversineKm } from '@/lib/geo';
