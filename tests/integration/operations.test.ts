/**
 * The dashboard's real Firestore operations repository against the emulators: live updates
 * from (app-shaped) writes, the queries' rules, and the alert rail on a stale request.
 */
import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { computeAlerts } from '../../src/features/operations/alerts';
import { env } from '../../src/lib/env';
import { EMULATOR_PROJECT_ID, getFirebaseApp } from '../../src/lib/firebase/app';
import { FirestoreOperationsRepository } from '../../src/lib/firebase/operationsRepository';
import { JOBS, MECHANICS, RATINGS } from '../../src/lib/mocks/contractFixtures';
import type { Job, Rating } from '../../src/types';

// This file drives the dashboard's own Firebase client: it must only ever talk to emulators.
if (!env.useEmulators || getFirebaseApp().options.projectId !== EMULATOR_PROJECT_ID) {
  throw new Error('Refusing to run: the dashboard client is not pointed at the emulators.');
}

const PASSWORD = 'password123';
const admin = initAdmin({ projectId: 'demo-autorafiki' }, 'ops-admin');
const db = adminDb(admin);
const repo = new FirestoreOperationsRepository();

/** Resolves with the first emission that satisfies `until`. */
function nextMatching<T>(
  subscribe: (next: (v: T) => void, fail: (e: Error) => void) => () => void,
  until: (v: T) => boolean,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const stop = subscribe(
      (v) => {
        if (until(v)) {
          stop();
          resolve(v);
        }
      },
      (e) => reject(e),
    );
  });
}

function requestedMinutesAgo(id: string, minutes: number): Job {
  const at = new Date(Date.now() - minutes * 60_000).toISOString();
  const base = JOBS.find((j) => j.id === 'job_req_stale')!;
  return {
    ...base,
    id,
    request: { ...base.request, id, createdAt: at },
    timeline: [{ status: 'requested', at }],
  };
}

beforeAll(async () => {
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  await adminAuth(admin).createUser({
    uid: 'opsstaff',
    email: 'opsstaff@autorafiki.test',
    password: PASSWORD,
  });
  await adminAuth(admin).setCustomUserClaims('opsstaff', { role: 'ops' });
  await adminAuth(admin).createUser({
    uid: 'appuser',
    email: 'appuser@autorafiki.test',
    password: PASSWORD,
  });
  for (const name of ['jobs', 'mechanics', 'ratings'])
    await db.recursiveDelete(db.collection(name));
  for (const m of MECHANICS) await db.collection('mechanics').doc(m.userId).set(m);
  const recent = (r: Rating) => ({ ...r, createdAt: new Date().toISOString() });
  for (const r of RATINGS) await db.collection('ratings').doc(r.id).set(recent(r));
});

afterAll(async () => {
  await signOut(getAuth(getFirebaseApp()));
  await deleteAdminApp(admin);
});

async function signInAs(email: string) {
  await signOut(getAuth(getFirebaseApp()));
  await signInWithEmailAndPassword(getAuth(getFirebaseApp()), email, PASSWORD);
}

describe('operations repository (emulator)', () => {
  it('ops staff see a new request live, then see it move to matched', async () => {
    await signInAs('opsstaff@autorafiki.test');
    const job = requestedMinutesAgo('live_1', 0.2);
    const appeared = nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (jobs) => jobs.some((j) => j.id === 'live_1'),
    );
    await db.collection('jobs').doc('live_1').set(job);
    expect((await appeared).find((j) => j.id === 'live_1')?.status).toBe('requested');

    const matched = nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (jobs) => jobs.find((j) => j.id === 'live_1')?.status === 'matched',
    );
    await db
      .collection('jobs')
      .doc('live_1')
      .update({
        status: 'matched',
        mechanicId: 'u_mech_okello',
        timeline: [...job.timeline, { status: 'matched', at: new Date().toISOString() }],
      });
    expect((await matched).find((j) => j.id === 'live_1')?.mechanicId).toBe('u_mech_okello');
  });

  it('the alert rail fires on a request left unaccepted for over 2 minutes', async () => {
    await signInAs('opsstaff@autorafiki.test');
    const jobs = nextMatching<Job[]>(
      (n, f) => repo.subscribeActiveJobs(n, f),
      (all) => all.some((j) => j.id === 'stale_1'),
    );
    await db.collection('jobs').doc('stale_1').set(requestedMinutesAgo('stale_1', 3));
    const alerts = computeAlerts(await jobs, [], new Date());
    expect(alerts.map((a) => a.key)).toContain('stale-request:stale_1');
  });

  it('closed jobs, online mechanics and low ratings load under the rules', async () => {
    await signInAs('opsstaff@autorafiki.test');
    const since = new Date(Date.now() - 86_400_000).toISOString();
    await db
      .collection('jobs')
      .doc('done_1')
      .set({
        ...requestedMinutesAgo('done_1', 10),
        status: 'cancelled',
        cancelledBy: 'system',
      });
    const closed = await nextMatching<Job[]>(
      (n, f) => repo.subscribeClosedJobs(since, n, f),
      (j) => j.length > 0,
    );
    expect(closed.map((j) => j.id)).toEqual(['done_1']);
    const online = await nextMatching(
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

  it('an app user (no role) cannot open the control-room feeds', async () => {
    await signInAs('appuser@autorafiki.test');
    await expect(
      nextMatching(
        (n, f) => repo.subscribeActiveJobs(n, f),
        () => true,
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
    await expect(
      nextMatching(
        (n, f) => repo.subscribeLowRatings(new Date(0).toISOString(), n, f),
        () => true,
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
