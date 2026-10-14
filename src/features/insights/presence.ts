import type { AvailabilityRecord, Job, OfferRecord } from '@/types';

export type { AvailabilityRecord, OfferRecord };

/**
 * Online stretches from the online/offline events (pings never open or close one: the app
 * pings only while moving or open, so gaps between pings are not offline). A stretch still
 * open runs to `now`, since backgrounding keeps a mechanic online by design.
 */
export function onlineStretches(
  events: readonly AvailabilityRecord[],
  mechanicId: string,
  now: Date,
): { from: number; to: number }[] {
  const mine = events
    .filter((e) => e.mechanicId === mechanicId && e.event !== 'ping')
    .sort((a, b) => a.at.localeCompare(b.at));
  const stretches: { from: number; to: number }[] = [];
  let openedAt: number | null = null;
  for (const e of mine) {
    const at = Date.parse(e.at);
    if (e.event === 'online' && openedAt === null) openedAt = at;
    if (e.event === 'offline' && openedAt !== null) {
      stretches.push({ from: openedAt, to: at });
      openedAt = null;
    }
  }
  if (openedAt !== null) stretches.push({ from: openedAt, to: now.getTime() });
  return stretches;
}

/** Hours online between `from` and `to` (ms). */
export function hoursOnline(
  stretches: readonly { from: number; to: number }[],
  from: number,
  to: number,
): number {
  return (
    stretches.reduce(
      (sum, s) => sum + Math.max(0, Math.min(s.to, to) - Math.max(s.from, from)),
      0,
    ) / 3_600_000
  );
}

export interface OfferStats {
  offers: number;
  accepted: number;
  declined: number;
  /** Someone else accepted first while this mechanic had not answered. */
  takenByOthers: number;
  /** Never opened, never answered, and nobody else took it either. */
  ignored: number;
  opened: number;
  /** accepted ÷ offers (null without offers). */
  acceptanceRate: number | null;
}

/**
 * How a mechanic answered the broadcasts that reached them. Accepting is the job transaction
 * (jobs.mechanicId), never written on the offer; matching is first-accept-wins.
 */
export function offerStats(
  offers: readonly OfferRecord[],
  jobs: ReadonlyMap<string, Pick<Job, 'mechanicId'>>,
  mechanicId: string,
): OfferStats {
  const mine = offers.filter((o) => o.mechanicId === mechanicId);
  let accepted = 0;
  let declined = 0;
  let takenByOthers = 0;
  let ignored = 0;
  for (const o of mine) {
    const winner = jobs.get(o.jobId)?.mechanicId;
    if (winner === mechanicId) accepted += 1;
    else if (o.declinedAt) declined += 1;
    else if (winner) takenByOthers += 1;
    else ignored += 1;
  }
  return {
    offers: mine.length,
    accepted,
    declined,
    takenByOthers,
    ignored,
    opened: mine.filter((o) => o.openedAt).length,
    acceptanceRate: mine.length ? accepted / mine.length : null,
  };
}
