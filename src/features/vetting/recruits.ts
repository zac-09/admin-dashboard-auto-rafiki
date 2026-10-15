import { median } from '@/features/revenue/kpis';
import { enteredAt } from '@/features/insights/jobFacts';
import type { AuditEntry, AvailabilityRecord, Job, MechanicDoc } from '@/types';

const DAY_MS = 86_400_000;

export type RecruitStage =
  /** The log covers everything since approval and shows no time online. */
  | 'never-online'
  /** Approved before the availability log began and no job yet: we cannot tell. */
  | 'unknown'
  /** Has been online, no completed job yet. */
  | 'online-no-job'
  | 'first-job-done';

export const RECRUIT_STAGE_LABELS: Record<RecruitStage, string> = {
  'never-online': 'Not seen online since approval',
  unknown: 'No job yet (approved before the online log began)',
  'online-no-job': 'Online, no completed job yet',
  'first-job-done': 'First job done',
};

export interface Recruit {
  mechanic: MechanicDoc;
  approvedAt: string;
  daysSinceApproval: number;
  firstOnlineAt: string | null;
  firstJobAt: string | null;
  /** Days from approval to the first completed job. */
  daysToFirstJob: number | null;
  stage: RecruitStage;
}

/**
 * Mechanics first approved (from pending) in the last `windowDays` days and how they got
 * going: first time online (from the availability log) and first completed job.
 */
export function recentRecruits(
  mechanics: readonly MechanicDoc[],
  entries: readonly AuditEntry[],
  jobs: readonly Job[],
  availability: readonly AvailabilityRecord[],
  now: Date,
  windowDays = 60,
): Recruit[] {
  const since = now.getTime() - windowDays * DAY_MS;
  const logStart = availability.length
    ? Math.min(...availability.map((e) => Date.parse(e.at)))
    : null;
  const byId = new Map(mechanics.map((m) => [m.userId, m]));
  const firstApproval = new Map<string, string>();
  for (const e of entries) {
    if (e.action !== 'mechanic.vetting.approve' || e.before !== 'pending') continue;
    const prev = firstApproval.get(e.targetId);
    if (!prev || e.at < prev) firstApproval.set(e.targetId, e.at);
  }
  return [...firstApproval]
    .filter(([id, at]) => Date.parse(at) >= since && byId.get(id)?.vetting === 'verified')
    .map(([id, approvedAt]) => {
      const mechanic = byId.get(id)!;
      const approved = Date.parse(approvedAt);
      const online = availability
        .filter((e) => e.mechanicId === id && e.event !== 'offline' && Date.parse(e.at) >= approved)
        .map((e) => e.at)
        .sort();
      const done = jobs
        .filter((j) => j.mechanicId === id)
        .flatMap((j) => {
          const at = enteredAt(j, 'complete');
          return at !== null && at >= approved ? [at] : [];
        })
        .sort((a, b) => a - b);
      const firstJob = done[0] ?? null;
      const firstOnlineAt = online[0] ?? null;
      const stage: RecruitStage =
        firstJob !== null
          ? 'first-job-done'
          : firstOnlineAt
            ? 'online-no-job'
            : logStart !== null && logStart <= approved
              ? 'never-online'
              : 'unknown';
      return {
        mechanic,
        approvedAt,
        daysSinceApproval: Math.floor((now.getTime() - approved) / DAY_MS),
        firstOnlineAt,
        firstJobAt: firstJob === null ? null : new Date(firstJob).toISOString(),
        daysToFirstJob: firstJob === null ? null : (firstJob - approved) / DAY_MS,
        stage,
      };
    })
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
}

export function medianDaysToFirstJob(recruits: readonly Recruit[]): number | null {
  return median(recruits.flatMap((r) => (r.daysToFirstJob === null ? [] : [r.daysToFirstJob])));
}
