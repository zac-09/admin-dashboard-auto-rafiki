import type { Job, MechanicDoc } from '@/types';

import { haversineKm, isUnserved } from './jobFacts';

/** Grid cell size in degrees: about 2.2 km at Kampala's latitude, a neighbourhood. */
export const CELL_DEG = 0.02;

export interface CoverageArea {
  key: string;
  /** The most common request label in the cell, to name the area. */
  label: string;
  center: { latitude: number; longitude: number };
  requests: number;
  unserved: number;
  /** 0–1. */
  unservedShare: number;
  /** Km from the area's centre to the closest verified mechanic's last known location. */
  nearestMechanicKm: number | null;
}

export interface Coverage {
  areas: CoverageArea[];
  requests: number;
  unserved: number;
}

/**
 * Where requests went unanswered, by neighbourhood. Only finished requests count (an open
 * request may still be taken). Areas sort by unanswered requests, then by share.
 */
export function coverage(jobs: readonly Job[], mechanics: readonly MechanicDoc[]): Coverage {
  const finished = jobs.filter((j) => j.status !== 'requested');
  const cells = new Map<string, Job[]>();
  for (const j of finished) {
    const { latitude, longitude } = j.request.location;
    const key = `${Math.round(latitude / CELL_DEG)}:${Math.round(longitude / CELL_DEG)}`;
    cells.set(key, [...(cells.get(key) ?? []), j]);
  }
  const mechanicSpots = mechanics.flatMap((m) =>
    m.vetting === 'verified' && m.lastKnownLocation ? [m.lastKnownLocation] : [],
  );
  const areas = [...cells].map(([key, inCell]): CoverageArea => {
    const center = {
      latitude: inCell.reduce((s, j) => s + j.request.location.latitude, 0) / inCell.length,
      longitude: inCell.reduce((s, j) => s + j.request.location.longitude, 0) / inCell.length,
    };
    const labels = new Map<string, number>();
    for (const j of inCell) {
      labels.set(j.request.location.label, (labels.get(j.request.location.label) ?? 0) + 1);
    }
    const label = [...labels].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    const unserved = inCell.filter(isUnserved).length;
    return {
      key,
      label,
      center,
      requests: inCell.length,
      unserved,
      unservedShare: unserved / inCell.length,
      nearestMechanicKm: mechanicSpots.length
        ? Math.min(...mechanicSpots.map((s) => haversineKm(center, s)))
        : null,
    };
  });
  areas.sort(
    (a, b) =>
      b.unserved - a.unserved ||
      b.unservedShare - a.unservedShare ||
      a.label.localeCompare(b.label),
  );
  return {
    areas,
    requests: finished.length,
    unserved: areas.reduce((n, a) => n + a.unserved, 0),
  };
}
