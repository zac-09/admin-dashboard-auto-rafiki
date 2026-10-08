import { DEFAULT_APP_SETTINGS } from '../../src/lib/appSettings';
import type { AuditEntry } from '../../src/types/audit';
import type { JobStatus } from '../../src/types/domain';
import type { SupportNote } from '../../src/types/support';
import {
  cancelJob,
  rebroadcastJob,
  type InterventionDeps,
  type JobFields,
} from '../src/interventions';
import type { Caller } from '../src/setUserRole';

const OPS: Caller = { uid: 'o1', email: 'ops@autorafiki.test', role: 'ops' };
const NOW = '2026-10-08T09:00:00.000Z';

function job(status: JobStatus, over: Partial<JobFields> = {}): JobFields {
  return {
    status,
    mechanicId: status === 'requested' ? undefined : 'm1',
    radiusKm: 5,
    expiresAt: '2026-10-08T08:50:00.000Z',
    timeline: [{ status: 'requested', at: '2026-10-08T08:48:00.000Z' }],
    label: 'Dead battery, Ntinda',
    ...over,
  };
}

function world(jobs: Record<string, JobFields>, settings: unknown = null) {
  const updates: Record<string, Record<string, unknown>> = {};
  const notes: Omit<SupportNote, 'id'>[] = [];
  const audit: Omit<AuditEntry, 'id'>[] = [];
  const deps: InterventionDeps = {
    async transact(run) {
      const writes: (() => void)[] = [];
      await run({
        getJob: async (id) => structuredClone(jobs[id] ?? null),
        getSettings: async () => settings,
        updateJob: (id, f) => writes.push(() => (updates[id] = f)),
        addNote: (_id, n) => writes.push(() => notes.push(n)),
        audit: (e) => writes.push(() => audit.push(e)),
      });
      writes.forEach((w) => w());
    },
    now: () => new Date(NOW),
  };
  return { deps, updates, notes, audit };
}

describe('cancelJob', () => {
  it.each(['requested', 'matched', 'enroute'] as const)(
    'cancels from %s like the app does, as admin',
    async (status) => {
      const w = world({ j: job(status) });
      await cancelJob(OPS, { jobId: 'j', reason: 'Customer called: car started' }, w.deps);
      expect(w.updates.j).toEqual({
        status: 'cancelled',
        cancelledBy: 'admin',
        timeline: [
          { status: 'requested', at: '2026-10-08T08:48:00.000Z' },
          { status: 'cancelled', at: NOW },
        ],
      });
      expect(w.notes[0]).toMatchObject({
        kind: 'intervention',
        text: 'Cancelled by ops: Customer called: car started',
      });
      expect(w.audit[0]).toMatchObject({
        action: 'job.cancel',
        targetId: 'j',
        before: status,
        after: 'cancelled',
      });
    },
  );

  it.each(['arrived', 'working', 'complete', 'cancelled'] as const)(
    'refuses to cancel a job that is %s',
    async (status) => {
      const w = world({ j: job(status) });
      await expect(cancelJob(OPS, { jobId: 'j', reason: 'x' }, w.deps)).rejects.toMatchObject({
        code: 'failed-precondition',
      });
      expect(w.updates).toEqual({});
      expect(w.audit).toHaveLength(0);
    },
  );
});

describe('rebroadcastJob', () => {
  it('widens an open request with a fresh window from settings, audited and noted', async () => {
    const settings = structuredClone(DEFAULT_APP_SETTINGS);
    settings.broadcast.windowMs = 120_000;
    const w = world({ j: job('requested') }, settings);
    const result = await rebroadcastJob(
      OPS,
      { jobId: 'j', radiusKm: 12, reason: 'No taker in 4 min' },
      w.deps,
    );
    expect(result).toEqual({ jobId: 'j', radiusKm: 12, expiresAt: '2026-10-08T09:02:00.000Z' });
    expect(w.updates.j).toEqual({ radiusKm: 12, expiresAt: '2026-10-08T09:02:00.000Z' });
    expect(w.notes[0]?.text).toBe('Broadcast widened from 5 km to 12 km by ops: No taker in 4 min');
    expect(w.audit[0]).toMatchObject({ action: 'job.rebroadcast', before: '5 km', after: '12 km' });
  });

  it('renews at the same radius with the app default window when settings are absent', async () => {
    const w = world({ j: job('requested') });
    await rebroadcastJob(OPS, { jobId: 'j', radiusKm: 5, reason: 'Retry' }, w.deps);
    expect(w.updates.j).toEqual({ radiusKm: 5, expiresAt: '2026-10-08T09:01:30.000Z' });
    expect(w.notes[0]?.text).toMatch(/^Broadcast renewed at 5 km/);
  });

  it('refuses accepted jobs, narrower or out-of-range radii', async () => {
    const w = world({ j: job('requested', { radiusKm: 8 }), m: job('matched') });
    await expect(
      rebroadcastJob(OPS, { jobId: 'm', radiusKm: 12, reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(
      rebroadcastJob(OPS, { jobId: 'j', radiusKm: 5, reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      rebroadcastJob(OPS, { jobId: 'j', radiusKm: 31, reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    await expect(
      rebroadcastJob(OPS, { jobId: 'j', radiusKm: '12', reason: 'x' }, w.deps),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
    expect(w.updates).toEqual({});
  });
});

describe('both', () => {
  it('need a reason, a job, and an admin or ops caller', async () => {
    const w = world({ j: job('requested') });
    for (const fn of [cancelJob, rebroadcastJob]) {
      await expect(fn(OPS, { jobId: 'j', radiusKm: 8 }, w.deps)).rejects.toMatchObject({
        code: 'invalid-argument',
      });
      await expect(
        fn(OPS, { jobId: 'nope', radiusKm: 8, reason: 'x' }, w.deps),
      ).rejects.toMatchObject({ code: 'not-found' });
      await expect(
        fn({ ...OPS, role: 'support' }, { jobId: 'j', radiusKm: 8, reason: 'x' }, w.deps),
      ).rejects.toMatchObject({ code: 'permission-denied' });
      await expect(fn(null, {}, w.deps)).rejects.toMatchObject({ code: 'unauthenticated' });
    }
    expect(w.updates).toEqual({});
  });
});
