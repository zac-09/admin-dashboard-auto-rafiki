import { JOB_STATUSES, type Job, type JobStatus } from '@/types';

/** Board columns in job-lifecycle order, newest request first in each. */
export function groupByStatus(jobs: readonly Job[]): Record<JobStatus, Job[]> {
  const columns = Object.fromEntries(JOB_STATUSES.map((s) => [s, [] as Job[]])) as Record<
    JobStatus,
    Job[]
  >;
  for (const job of jobs) columns[job.status]?.push(job);
  for (const status of JOB_STATUSES) {
    columns[status].sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt));
  }
  return columns;
}

/** Labels from the app (src/features/jobs/labels.ts), so ops and users use the same words. */
export const STATUS_LABELS: Record<JobStatus, string> = {
  requested: 'Requested',
  matched: 'Mechanic assigned',
  enroute: 'On the way',
  arrived: 'Arrived',
  working: 'Working',
  complete: 'Complete',
  cancelled: 'Cancelled',
};

export const CANCELLED_BY_LABELS: Record<NonNullable<Job['cancelledBy']>, string> = {
  customer: 'by the customer',
  mechanic: 'by the mechanic',
  system: 'no mechanic accepted in time',
  admin: 'by AutoRafiki support',
};
