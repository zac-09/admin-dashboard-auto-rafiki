import { median } from '@/features/revenue/kpis';
import { SERVICE_LABELS } from '@/lib/labels';
import type { AuditEntry, Job, ServiceType } from '@/types';

import { arrivalMinutes, isUnserved } from './jobFacts';

const DAY_MS = 86_400_000;
/** At most this many days either side of a change. */
export const COMPARE_DAYS = 14;

export interface PeriodMetrics {
  days: number;
  requests: number;
  requestsPerDay: number;
  /** 0–1 of finished requests nobody took. */
  unansweredShare: number | null;
  /** 0–1 of accepted, finished jobs that were completed. */
  completionShare: number | null;
  medianArrivalMin: number | null;
  averageFee: number | null;
}

export interface ServiceShift {
  service: ServiceType;
  label: string;
  priceBefore: number | null;
  priceAfter: number;
  perDayBefore: number;
  perDayAfter: number;
}

export interface SettingsChange {
  entry: AuditEntry;
  at: number;
  /** The before window was cut short by an earlier change, or the after window by a later one / today. */
  before: PeriodMetrics;
  after: PeriodMetrics;
  services: ServiceShift[];
  /** "5 → 6 km first radius" and similar, when broadcast values changed. */
  broadcastNotes: string[];
}

interface Snapshot {
  prices?: Partial<Record<ServiceType, number>>;
  broadcast?: { initialRadiusKm?: number; expandedRadiusKm?: number; windowMs?: number };
}

function parse(value: string | null): Snapshot | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Snapshot;
  } catch {
    return null;
  }
}

function metrics(jobs: readonly Job[], from: number, to: number): PeriodMetrics {
  const inside = jobs.filter((j) => {
    const at = Date.parse(j.request.createdAt);
    return at >= from && at < to;
  });
  const days = Math.max(0, (to - from) / DAY_MS);
  const finished = inside.filter((j) => j.status === 'complete' || j.status === 'cancelled');
  const accepted = finished.filter((j) => j.timeline.some((t) => t.status === 'matched'));
  const arrivals = inside.flatMap((j) => {
    const m = arrivalMinutes(j);
    return m === null ? [] : [m];
  });
  return {
    days,
    requests: inside.length,
    requestsPerDay: days ? inside.length / days : 0,
    unansweredShare: finished.length ? finished.filter(isUnserved).length / finished.length : null,
    completionShare: accepted.length
      ? accepted.filter((j) => j.status === 'complete').length / accepted.length
      : null,
    medianArrivalMin: median(arrivals),
    averageFee: inside.length ? inside.reduce((s, j) => s + j.fee, 0) / inside.length : null,
  };
}

/**
 * Each published settings change (audited `settings.update`) with the days either side of
 * it: up to COMPARE_DAYS, cut short by the neighbouring change or today, so effects never
 * mix. Newest first. A comparison, not proof: weather, holidays and growth move these too.
 */
export function settingsChanges(
  entries: readonly AuditEntry[],
  jobs: readonly Job[],
  now: Date,
): SettingsChange[] {
  const changes = entries
    .filter((e) => e.action === 'settings.update')
    .map((e) => ({ entry: e, at: Date.parse(e.at) }))
    .sort((a, b) => a.at - b.at);
  return changes
    .map(({ entry, at }, i) => {
      const prev = changes[i - 1]?.at ?? -Infinity;
      const next = changes[i + 1]?.at ?? Infinity;
      const before = metrics(jobs, Math.max(at - COMPARE_DAYS * DAY_MS, prev), at);
      const after = metrics(jobs, at, Math.min(at + COMPARE_DAYS * DAY_MS, next, now.getTime()));
      const was = parse(entry.before);
      const is = parse(entry.after);
      const services: ServiceShift[] = [];
      for (const [service, price] of Object.entries(is?.prices ?? {}) as [ServiceType, number][]) {
        const old = was?.prices?.[service] ?? null;
        if (old === price) continue;
        const count = (from: number, to: number) =>
          jobs.filter((j) => {
            const t = Date.parse(j.request.createdAt);
            return j.request.service === service && t >= from && t < to;
          }).length;
        const bFrom = Math.max(at - COMPARE_DAYS * DAY_MS, prev);
        const aTo = Math.min(at + COMPARE_DAYS * DAY_MS, next, now.getTime());
        services.push({
          service,
          label: SERVICE_LABELS[service],
          priceBefore: old,
          priceAfter: price,
          perDayBefore: before.days ? count(bFrom, at) / before.days : 0,
          perDayAfter: after.days ? count(at, aTo) / after.days : 0,
        });
      }
      const notes: string[] = [];
      const b0 = was?.broadcast;
      const b1 = is?.broadcast;
      if (b1?.initialRadiusKm !== undefined && b1.initialRadiusKm !== b0?.initialRadiusKm) {
        notes.push(`First radius ${b0?.initialRadiusKm ?? '–'} → ${b1.initialRadiusKm} km`);
      }
      if (b1?.expandedRadiusKm !== undefined && b1.expandedRadiusKm !== b0?.expandedRadiusKm) {
        notes.push(`Widened radius ${b0?.expandedRadiusKm ?? '–'} → ${b1.expandedRadiusKm} km`);
      }
      if (b1?.windowMs !== undefined && b1.windowMs !== b0?.windowMs) {
        const s = (ms?: number) => (ms === undefined ? '–' : `${Math.round(ms / 1000)} s`);
        notes.push(`Broadcast window ${s(b0?.windowMs)} → ${s(b1.windowMs)}`);
      }
      return { entry, at, before, after, services, broadcastNotes: notes };
    })
    .reverse();
}
