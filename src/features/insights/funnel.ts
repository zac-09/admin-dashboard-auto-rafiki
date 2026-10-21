import { median } from '@/features/revenue/kpis';
import { SERVICE_LABELS, VEHICLE_LABELS } from '@/lib/labels';
import type { Job, JobStatus } from '@/types';

import { arrivalMinutes, enteredAt, isUnserved } from './jobFacts';

const DAY_MS = 86_400_000;

/** Jobs requested in the `days` days before `now`. */
export function requestedWithin(jobs: readonly Job[], days: number, now: Date): Job[] {
  const since = now.getTime() - days * DAY_MS;
  return jobs.filter((j) => Date.parse(j.request.createdAt) >= since);
}

/** The happy path, in order: every request starts at the first stage. */
export const FUNNEL_STAGES = [
  'requested',
  'matched',
  'enroute',
  'arrived',
  'working',
  'complete',
] as const satisfies readonly JobStatus[];
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const STAGE_LABELS: Record<FunnelStage, string> = {
  requested: 'Requested',
  matched: 'Accepted by a mechanic',
  enroute: 'Mechanic set off',
  arrived: 'Mechanic arrived',
  working: 'Work started',
  complete: 'Completed',
};

export type Canceller = NonNullable<Job['cancelledBy']> | 'unknown';
export const CANCELLERS: readonly Canceller[] = ['customer', 'mechanic', 'system', 'admin'];
export const CANCELLER_LABELS: Record<Canceller, string> = {
  customer: 'Customer',
  mechanic: 'Mechanic',
  system: 'Nobody took it (expired)',
  admin: 'AutoRafiki',
  unknown: 'Not recorded',
};

/** Stages a job can be cancelled from (the app's state machine). */
export const CANCEL_STAGES = ['requested', 'matched', 'enroute'] as const;
export type CancelStage = (typeof CANCEL_STAGES)[number];

export interface Funnel {
  requests: number;
  /** Jobs still moving (not complete or cancelled): they may yet reach later stages. */
  inProgress: number;
  stages: { stage: FunnelStage; reached: number }[];
  cancelled: number;
  /** Cancellations by the stage the job was in and who cancelled it. */
  cancellations: Record<CancelStage, Partial<Record<Canceller, number>>>;
}

function reached(job: Job, stage: FunnelStage): boolean {
  return stage === 'requested' || job.status === stage || enteredAt(job, stage) !== null;
}

/** The last stage a cancelled job reached before it was cancelled. */
export function cancelledAt(job: Job): CancelStage {
  const last = [...CANCEL_STAGES].reverse().find((s) => reached(job, s));
  return last ?? 'requested';
}

/** How far requests get, and where and by whom the rest are cancelled. */
export function funnel(jobs: readonly Job[]): Funnel {
  const cancellations: Funnel['cancellations'] = { requested: {}, matched: {}, enroute: {} };
  let cancelled = 0;
  for (const job of jobs) {
    if (job.status !== 'cancelled') continue;
    cancelled++;
    const row = cancellations[cancelledAt(job)];
    const who: Canceller = job.cancelledBy ?? 'unknown';
    row[who] = (row[who] ?? 0) + 1;
  }
  return {
    requests: jobs.length,
    inProgress: jobs.filter((j) => j.status !== 'complete' && j.status !== 'cancelled').length,
    stages: FUNNEL_STAGES.map((stage) => ({
      stage,
      reached: jobs.filter((j) => reached(j, stage)).length,
    })),
    cancelled,
    cancellations,
  };
}

/** The legs between request and finish, whose medians show where the minutes go. */
export const LEGS = [
  { id: 'accept', label: 'Waiting for a mechanic to accept', from: 'requested', to: 'matched' },
  { id: 'setOff', label: 'Accepted to setting off', from: 'matched', to: 'enroute' },
  { id: 'travel', label: 'Travelling to the customer', from: 'enroute', to: 'arrived' },
  { id: 'onSite', label: 'On site, arrival to completion', from: 'arrived', to: 'complete' },
] as const satisfies readonly { id: string; label: string; from: JobStatus; to: JobStatus }[];
export type LegId = (typeof LEGS)[number]['id'];

export interface Leg {
  id: LegId;
  label: string;
  medianMin: number | null;
  measured: number;
  /** Counts toward request-to-arrival (the 30-minute target). */
  beforeArrival: boolean;
}

function legStart(job: Job, status: JobStatus): number | null {
  return status === 'requested' ? Date.parse(job.request.createdAt) : enteredAt(job, status);
}

/**
 * Median minutes of each leg over breakdowns (bookings are accepted days ahead, so their
 * waits say nothing about speed).
 */
export function legs(jobs: readonly Job[]): Leg[] {
  const breakdowns = jobs.filter((j) => !j.request.booking);
  return LEGS.map((leg) => {
    const values = breakdowns.flatMap((j) => {
      const from = legStart(j, leg.from);
      const to = enteredAt(j, leg.to);
      return from === null || to === null || to < from ? [] : [(to - from) / 60_000];
    });
    return {
      id: leg.id,
      label: leg.label,
      medianMin: median(values),
      measured: values.length,
      beforeArrival: leg.id !== 'onSite',
    };
  });
}

export interface MixRow {
  key: string;
  label: string;
  requests: number;
  completed: number;
  /** Of finished requests (complete or cancelled), the share completed. */
  completionShare: number | null;
  /** Of finished requests, the share nobody took. */
  unservedShare: number | null;
  medianArrivalMin: number | null;
  /** Call-out fees on completed jobs, UGX (on-site prices are not recorded). */
  completedFees: number;
  averageFee: number | null;
}

function mixRows(
  jobs: readonly Job[],
  keyOf: (j: Job) => string,
  labelOf: (key: string) => string,
): MixRow[] {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = keyOf(job);
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.entries()]
    .map(([key, group]) => {
      const done = group.filter((j) => j.status === 'complete');
      const finished = group.filter((j) => j.status === 'complete' || j.status === 'cancelled');
      const fees = done.reduce((sum, j) => sum + j.fee, 0);
      return {
        key,
        label: labelOf(key),
        requests: group.length,
        completed: done.length,
        completionShare: finished.length ? done.length / finished.length : null,
        unservedShare: finished.length
          ? finished.filter(isUnserved).length / finished.length
          : null,
        medianArrivalMin: median(
          group.flatMap((j) => {
            const m = arrivalMinutes(j);
            return m === null ? [] : [m];
          }),
        ),
        completedFees: fees,
        averageFee: done.length ? fees / done.length : null,
      };
    })
    .sort((a, b) => b.requests - a.requests || a.label.localeCompare(b.label));
}

const BOOKED = 'booking';

/** By service; booked servicing (service 'other' on the job) is its own row. */
export function serviceMix(jobs: readonly Job[]): MixRow[] {
  return mixRows(
    jobs,
    (j) => (j.request.booking ? BOOKED : j.request.service),
    (key) =>
      key === BOOKED ? 'Booked servicing' : SERVICE_LABELS[key as keyof typeof SERVICE_LABELS],
  );
}

export function vehicleMix(jobs: readonly Job[]): MixRow[] {
  return mixRows(
    jobs,
    (j) => j.request.vehicle,
    (key) => VEHICLE_LABELS[key as keyof typeof VEHICLE_LABELS],
  );
}
