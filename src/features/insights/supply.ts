import type { AvailabilityRecord, Job, MechanicDoc } from '@/types';

import { DAYS } from './demand';
import { isUnserved, kampalaSlot } from './jobFacts';
import { onlineStretches } from './presence';

const HOUR_MS = 3_600_000;
const KAMPALA_MS = 3 * HOUR_MS;

export interface SupplyCell {
  /** Average mechanics online during this weekday-hour, over the log. */
  online: number;
  /** Requests per week in this weekday-hour, over the same span. */
  requestsPerWeek: number;
  unservedPerWeek: number;
}

export interface Supply {
  /** [day 0 = Monday][hour], Kampala time; null before there is any log. */
  grid: SupplyCell[][] | null;
  /** The span compared: from the first availability event to now. */
  from: number | null;
  to: number;
  /** Weekday-hours with requests but, on average, under half a mechanic online. */
  uncovered: { day: number; hour: number; requestsPerWeek: number; online: number }[];
}

/** Kampala weekday (0 = Monday) and hour of an instant. */
function slotOf(ms: number): { day: number; hour: number } {
  return kampalaSlot(new Date(ms).toISOString());
}

/**
 * Mechanics online against requests, per weekday-hour, over the span the app has logged
 * availability (both sides use the same span, so the comparison is like for like). Online
 * time counts for mechanics who are not pending: only verified mechanics get job alerts, and
 * suspended ones were verified while they were online.
 */
export function supply(
  availability: readonly AvailabilityRecord[],
  mechanics: readonly MechanicDoc[],
  jobs: readonly Job[],
  now: Date,
): Supply {
  const to = now.getTime();
  if (availability.length === 0) return { grid: null, from: null, to, uncovered: [] };
  const from = Math.min(...availability.map((e) => Date.parse(e.at)));

  const blank = () => DAYS.map(() => Array.from({ length: 24 }, () => 0));
  // How many hours of each weekday-hour the span contains (partial hours count partly).
  const exposure = blank();
  const mechanicHours = blank();
  const addSpan = (target: number[][], start: number, end: number) => {
    // Walk Kampala hour boundaries (Kampala has no daylight saving: whole hours line up).
    let t = start;
    while (t < end) {
      const next = Math.min(
        end,
        (Math.floor((t + KAMPALA_MS) / HOUR_MS) + 1) * HOUR_MS - KAMPALA_MS,
      );
      const { day, hour } = slotOf(t);
      target[day]![hour]! += (next - t) / HOUR_MS;
      t = next;
    }
  };
  addSpan(exposure, from, to);
  const counted = mechanics.filter((m) => m.vetting !== 'pending');
  for (const m of counted) {
    for (const s of onlineStretches(availability, m.userId, now)) {
      const start = Math.max(s.from, from);
      const end = Math.min(s.to, to);
      if (end > start) addSpan(mechanicHours, start, end);
    }
  }

  const requests = blank();
  const unserved = blank();
  for (const j of jobs) {
    const at = Date.parse(j.request.createdAt);
    if (at < from || at > to || j.request.booking) continue;
    const { day, hour } = slotOf(at);
    requests[day]![hour]! += 1;
    if (isUnserved(j)) unserved[day]![hour]! += 1;
  }

  // Each weekday-hour occurs once a week: exposure hours ≈ weeks of that slot.
  const grid = DAYS.map((_, day) =>
    Array.from({ length: 24 }, (_, hour) => {
      const weeks = exposure[day]![hour]!;
      return {
        online: weeks ? mechanicHours[day]![hour]! / weeks : 0,
        requestsPerWeek: weeks ? requests[day]![hour]! / weeks : 0,
        unservedPerWeek: weeks ? unserved[day]![hour]! / weeks : 0,
      };
    }),
  );
  const uncovered = grid
    .flatMap((row, day) => row.map((c, hour) => ({ day, hour, ...c })))
    .filter((c) => c.requestsPerWeek > 0 && c.online < 0.5)
    .sort((a, b) => b.requestsPerWeek - a.requestsPerWeek || a.online - b.online)
    .slice(0, 5)
    .map(({ day, hour, requestsPerWeek, online }) => ({ day, hour, requestsPerWeek, online }));
  return { grid, from, to, uncovered };
}
