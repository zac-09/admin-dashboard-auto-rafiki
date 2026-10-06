/** Control-room feeds for ops staff on the emulators: live updates, rules, the alert rail. */
import { computeAlerts } from '../../src/features/operations/alerts';
import { FirestoreOperationsRepository } from '../../src/lib/firebase/operationsRepository';
import { MECHANICS, RATINGS } from '../../src/lib/mocks/contractFixtures';
import type { Job, MechanicDoc, Rating } from '../../src/types';

import { restClear } from './emulatorRest';
import { nextMatching, requestedMinutesAgo, signInOnce, signOutClient, write } from './opsHarness';

const repo = new FirestoreOperationsRepository();

beforeAll(async () => {
  await restClear();
  for (const m of MECHANICS) await write(`mechanics/${m.userId}`, m);
  const recent = (r: Rating) => ({ ...r, createdAt: new Date().toISOString() });
  for (const r of RATINGS) await write(`ratings/${r.id}`, recent(r));
  await signInOnce('opsstaff', 'ops');
});

afterAll(signOutClient);

describe('operations feeds for ops staff (emulator)', () => {
  // Each test writes first, then subscribes: in Node, listen-then-write against the emulator is
  // unreliable (see opsHarness.ts). Live updates are verified in a real browser by test:e2e.
  it('a request and its match show up on the active-jobs feed', async () => {
    const job = requestedMinutesAgo('live_1', 0.2);
    await write('jobs/live_1', job);
    const first = await nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (jobs) => jobs.some((j) => j.id === 'live_1'),
    );
    expect(first.find((j) => j.id === 'live_1')?.status).toBe('requested');

    await write(
      'jobs/live_1',
      {
        status: 'matched',
        mechanicId: 'u_mech_okello',
        timeline: [...job.timeline, { status: 'matched', at: new Date().toISOString() }],
      },
      true,
    );
    const second = await nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (jobs) => jobs.find((j) => j.id === 'live_1')?.status === 'matched',
    );
    expect(second.find((j) => j.id === 'live_1')?.mechanicId).toBe('u_mech_okello');
  });

  it('the alert rail fires on a request left unaccepted for over 2 minutes', async () => {
    await write('jobs/stale_1', requestedMinutesAgo('stale_1', 3));
    const jobs = await nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (all) => all.some((j) => j.id === 'stale_1'),
    );
    const alerts = computeAlerts(jobs, [], new Date());
    expect(alerts.map((a) => a.key)).toContain('stale-request:stale_1');
    expect(alerts.map((a) => a.key)).not.toContain('stale-request:live_1');
  });

  it('closed jobs, online mechanics and low ratings load under the rules', async () => {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    await write('jobs/done_1', {
      ...requestedMinutesAgo('done_1', 10),
      status: 'cancelled',
      cancelledBy: 'system',
    });
    const closed = await nextMatching<Job[]>(
      (n, f) => repo.subscribeClosedJobs(since, n, f),
      (j) => j.length > 0,
    );
    expect(closed.map((j) => j.id)).toEqual(['done_1']);
    const online = await nextMatching<MechanicDoc[]>(
      (n, f) => repo.subscribeOnlineMechanics(n, f),
      () => true,
    );
    expect(online.map((m) => m.userId).sort()).toEqual(['u_mech_namukasa', 'u_mech_okello']);
    const low = await nextMatching<Rating[]>(
      (n, f) => repo.subscribeLowRatings(since, n, f),
      () => true,
    );
    expect(low.map((r) => r.id)).toEqual(['rating_m2c']);
  });
});
