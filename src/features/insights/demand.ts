import type { Job } from '@/types';

import { isUnserved, kampalaSlot } from './jobFacts';

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export interface DemandCell {
  requests: number;
  unserved: number;
}

export interface Demand {
  /** [day 0 = Monday][hour 0–23], Kampala time. */
  grid: DemandCell[][];
  maxRequests: number;
  maxUnserved: number;
  /** The slots with the most unanswered requests, worst first (at most 3). */
  worst: { day: number; hour: number; unserved: number; requests: number }[];
}

export function demand(jobs: readonly Job[]): Demand {
  const grid = DAYS.map(() => Array.from({ length: 24 }, () => ({ requests: 0, unserved: 0 })));
  for (const j of jobs) {
    // When a booking was made says nothing about when help was needed.
    if (j.request.booking) continue;
    const { day, hour } = kampalaSlot(j.request.createdAt);
    const cell = grid[day]![hour]!;
    cell.requests += 1;
    if (isUnserved(j)) cell.unserved += 1;
  }
  const flat = grid.flatMap((row, day) => row.map((c, hour) => ({ day, hour, ...c })));
  return {
    grid,
    maxRequests: Math.max(0, ...flat.map((c) => c.requests)),
    maxUnserved: Math.max(0, ...flat.map((c) => c.unserved)),
    worst: flat
      .filter((c) => c.unserved > 0)
      .sort((a, b) => b.unserved - a.unserved || b.requests - a.requests || a.day - b.day)
      .slice(0, 3),
  };
}

/** "Mon 17:00–18:00". */
export function slotLabel(day: number, hour: number): string {
  const hh = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return `${DAYS[day]} ${hh(hour)}–${hh(hour + 1)}`;
}
