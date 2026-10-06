import type { Job, JobStatus } from '@/types';

/** When the job entered its current status: the latest timeline entry for it. */
export function enteredStatusAt(job: Job): string {
  for (let i = job.timeline.length - 1; i >= 0; i -= 1) {
    const entry = job.timeline[i]!;
    if (entry.status === job.status) return entry.at;
  }
  return job.request.createdAt;
}

export function msInStatus(job: Job, now: Date): number {
  return Math.max(0, now.getTime() - new Date(enteredStatusAt(job)).getTime());
}

/** `45 s`, `4 min`, `1 h 05 min`, `2 d 3 h`. */
export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${String(m % 60).padStart(2, '0')} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

/** Time from one status to the next in the timeline, for the job detail page. */
export function timelineSteps(
  job: Job,
): { status: JobStatus; at: string; durationMs: number | null }[] {
  return job.timeline.map((entry, i) => {
    const next = job.timeline[i + 1];
    return {
      status: entry.status,
      at: entry.at,
      durationMs: next ? new Date(next.at).getTime() - new Date(entry.at).getTime() : null,
    };
  });
}
