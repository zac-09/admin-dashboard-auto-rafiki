import { APP_CALLOUT_PRICES } from '@/lib/pricing';
import { canTransition, type Job } from '@/types';

import { JOBS, MECHANICS, MESSAGES, RATINGS, USERS } from '../contractFixtures';

const UG_PHONE = /^\+2567\d{8}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Who could have made each move: mechanics walk the job, either side may cancel. */
function legalWalk(job: Job): boolean {
  return job.timeline.slice(1).every((entry, i) => {
    const from = job.timeline[i]!.status;
    return (
      canTransition(from, entry.status, 'mechanic') || canTransition(from, entry.status, 'customer')
    );
  });
}

describe('contract fixtures', () => {
  it('use E.164 Ugandan phones', () => {
    for (const u of USERS) expect(u.phone).toMatch(UG_PHONE);
    for (const m of MECHANICS) if (m.phone) expect(m.phone).toMatch(UG_PHONE);
  });

  it('give every mechanic a user holding the mechanic role', () => {
    for (const m of MECHANICS) {
      expect(USERS.find((u) => u.id === m.userId)?.roles).toContain('mechanic');
    }
  });

  it.each(JOBS.map((j) => [j.id, j] as const))('%s is shaped like an app-written job', (_, job) => {
    expect(job.request.id).toBe(job.id);
    expect(job.timeline[0]?.status).toBe('requested');
    expect(job.timeline[0]?.at).toBe(job.request.createdAt);
    expect(job.timeline.at(-1)?.status).toBe(job.status);
    expect(legalWalk(job)).toBe(true);
    for (const t of job.timeline) expect(t.at).toMatch(ISO);
    expect(job.fee).toBe(APP_CALLOUT_PRICES[job.request.service]);
    expect([5, 8]).toContain(job.radiusKm);
    expect(job.mechanicId != null).toBe(job.timeline.some((t) => t.status === 'matched'));
    expect(job.cancelledBy != null).toBe(job.status === 'cancelled');
    expect(job.mechanicId).not.toBe(job.request.customerId);
  });

  it('only rate complete jobs, with the parties on the job', () => {
    for (const r of RATINGS) {
      const job = JOBS.find((j) => j.id === r.jobId);
      expect(job?.status).toBe('complete');
      expect(job?.mechanicId).toBe(r.mechanicId);
      expect(job?.request.customerId).toBe(r.customerId);
    }
  });

  it('only chat between the parties on the job', () => {
    for (const m of MESSAGES) {
      const job = JOBS.find((j) => j.id === m.jobId)!;
      const expected = m.senderRole === 'customer' ? job.request.customerId : job.mechanicId;
      expect(m.senderId).toBe(expected);
    }
  });
});
