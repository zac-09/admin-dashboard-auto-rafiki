import { APP_CALLOUT_PRICES } from '@/lib/pricing';
import type { Job, JobTimelineEntry, Place, Rating, ServiceType, VehicleCategory } from '@/types';

import { AUDIT_ENTRIES } from './auditFixtures';
import { PLACES } from './contractFixtures';

/**
 * Ten weeks of past jobs for mock mode (dev only; tests opt in), so trends, coverage, demand
 * and scorecards have something real-shaped to show. Deterministic: the same seed always
 * produces the same history relative to `now`. Shaped like the app's writes; never in
 * production (mocks are dropped from production builds).
 *
 * The story it tells: demand grows week on week; the centre is well served while the outer
 * areas (Kira, Mukono, Nansana, Kajjansi) often go unanswered; requests peak at the morning
 * and evening rush; Okello is fast and well rated, Namukasa slower with a slipping rating,
 * Waiswa slow and cancelling until his suspension.
 */

const OUTER = {
  kira: { latitude: 0.3972, longitude: 32.6398, label: 'Kira town, Kira Road' },
  najjera: { latitude: 0.3711, longitude: 32.6158, label: 'Najjera, Kira Road' },
  mukono: { latitude: 0.3533, longitude: 32.7553, label: 'Mukono, Jinja Road' },
  nansana: { latitude: 0.364, longitude: 32.528, label: 'Nansana, Hoima Road' },
  kajjansi: { latitude: 0.2186, longitude: 32.5523, label: 'Kajjansi, Entebbe Road' },
} satisfies Record<string, Place>;

const CENTRAL: Place[] = Object.values(PLACES);
const OUTER_PLACES: Place[] = Object.values(OUTER);

const SERVICES: ServiceType[] = [
  'flat-tyre',
  'flat-tyre',
  'battery',
  'battery',
  'engine',
  'fuel',
  'lockout',
  'towing',
  'other',
];
const VEHICLES: VehicleCategory[] = ['car', 'car', 'car', 'boda', 'boda', 'matatu', 'truck'];
const CUSTOMERS = ['u_customer_aisha', 'u_customer_brian'];

/** Requests by Kampala hour: morning and evening rush, quiet nights. */
const HOUR_WEIGHTS = [1, 0, 0, 0, 1, 2, 5, 9, 10, 6, 4, 4, 5, 4, 4, 5, 7, 10, 11, 8, 5, 3, 2, 1];

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function auditAt(id: string): number {
  const entry = AUDIT_ENTRIES.find((e) => e.id === id);
  return entry ? Date.parse(entry.at) : 0;
}

interface MechanicProfile {
  id: string;
  /** Travel time as a multiple of the app's 18 km/h estimate. */
  pace: [number, number];
  cancelRate: number;
  /** Stars given by customers: [min, max] early in the history, then late. */
  stars: { early: [number, number]; late: [number, number] };
  active: (at: number) => boolean;
}

const DAY_MS = 86_400_000;

export function generateHistory(now: Date, seed = 7): { jobs: Job[]; ratings: Rating[] } {
  const rand = mulberry32(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

  const namukasaFrom = auditAt('audit_namukasa_approve');
  const waiswaUntil = auditAt('audit_waiswa_suspend');
  const profiles: MechanicProfile[] = [
    {
      id: 'u_mech_okello',
      pace: [0.8, 1.2],
      cancelRate: 0.03,
      stars: { early: [4, 5], late: [4, 5] },
      active: () => true,
    },
    {
      id: 'u_mech_namukasa',
      pace: [1.1, 1.9],
      cancelRate: 0.08,
      stars: { early: [4, 5], late: [2, 4] },
      active: (at) => at > namukasaFrom,
    },
    {
      id: 'u_mech_waiswa',
      pace: [1.6, 2.6],
      cancelRate: 0.3,
      stars: { early: [2, 4], late: [1, 3] },
      active: (at) => at < waiswaUntil,
    },
  ];

  const hourTotal = HOUR_WEIGHTS.reduce((a, b) => a + b, 0);
  const randomHour = () => {
    let r = rand() * hourTotal;
    for (let h = 0; h < 24; h++) {
      r -= HOUR_WEIGHTS[h]!;
      if (r < 0) return h;
    }
    return 18;
  };

  const jobs: Job[] = [];
  const ratings: Rating[] = [];
  // Days 2..70 ago: yesterday and today belong to the live fixtures and the board.
  for (let daysBack = 70; daysBack >= 2; daysBack--) {
    const growth = (70 - daysBack) / 68; // 0 → 1 over the history
    const perDay = Math.round(2 + growth * 6 + between(-1, 1));
    const dayStart = now.getTime() - daysBack * DAY_MS;
    // Kampala midnight of that day (UTC+3).
    const midnight = Math.floor((dayStart + 3 * 3_600_000) / DAY_MS) * DAY_MS - 3 * 3_600_000;
    for (let n = 0; n < perDay; n++) {
      const createdMs = midnight + randomHour() * 3_600_000 + Math.floor(rand() * 3_600_000);
      const outer = rand() < 0.3;
      const location = outer ? pick(OUTER_PLACES) : pick(CENTRAL);
      const service = pick(SERVICES);
      const id = `job_hist_${daysBack}_${n}`;
      const createdAt = new Date(createdMs).toISOString();
      const timeline: JobTimelineEntry[] = [{ status: 'requested', at: createdAt }];
      const at = (minutes: number) => new Date(createdMs + minutes * 60_000).toISOString();
      const job: Job = {
        id,
        request: {
          id,
          customerId: pick(CUSTOMERS),
          location,
          vehicle: pick(VEHICLES),
          service,
          description: 'Earlier request (mock history).',
          createdAt,
        },
        status: 'requested',
        radiusKm: 5,
        expiresAt: new Date(createdMs + 90_000).toISOString(),
        fee: APP_CALLOUT_PRICES[service],
        timeline,
      };

      const available = profiles.filter((p) => p.active(createdMs));
      const unserved = available.length === 0 || rand() < (outer ? 0.45 : 0.08);
      if (unserved) {
        // Nobody took it: the customer gives up, or the broadcast runs out.
        const byCustomer = rand() < 0.4;
        job.radiusKm = 8;
        job.status = 'cancelled';
        job.cancelledBy = byCustomer ? 'customer' : 'system';
        timeline.push({ status: 'cancelled', at: at(byCustomer ? between(1, 3) : 3) });
        jobs.push(job);
        continue;
      }

      const mech = pick(available);
      job.mechanicId = mech.id;
      const matched = between(0.3, 2.5);
      timeline.push({ status: 'matched', at: at(matched) });
      if (rand() < mech.cancelRate) {
        job.status = 'cancelled';
        job.cancelledBy = 'mechanic';
        timeline.push({ status: 'cancelled', at: at(matched + between(2, 10)) });
        jobs.push(job);
        continue;
      }
      if (rand() < 0.04) {
        job.status = 'cancelled';
        job.cancelledBy = 'customer';
        timeline.push({ status: 'cancelled', at: at(matched + between(3, 12)) });
        jobs.push(job);
        continue;
      }
      const enroute = matched + between(0.5, 2);
      const km = Math.round(between(1.5, outer ? 12 : 7) * 10) / 10;
      const travel = Math.max(2, (km / 18) * 60) * between(...mech.pace);
      const arrived = enroute + travel;
      const working = arrived + between(1, 4);
      const complete = working + between(10, 50);
      timeline.push(
        { status: 'enroute', at: at(enroute) },
        { status: 'arrived', at: at(arrived) },
        { status: 'working', at: at(working) },
        { status: 'complete', at: at(complete) },
      );
      job.status = 'complete';
      job.distanceKm = km;
      jobs.push(job);

      if (rand() < 0.7) {
        const [lo, hi] = growth > 0.6 ? mech.stars.late : mech.stars.early;
        ratings.push({
          id: `rating_hist_${id}`,
          jobId: id,
          mechanicId: mech.id,
          customerId: job.request.customerId,
          stars: Math.round(between(lo, hi)) as Rating['stars'],
          createdAt: at(complete + between(2, 30)),
        });
      }
    }
  }
  return { jobs, ratings };
}
