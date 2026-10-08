import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { DEFAULT_APP_SETTINGS } from '../../src/lib/appSettings';
import { JOBS } from '../../src/lib/mocks/contractFixtures';
import type { Job } from '../../src/types';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'iv-admin');
const db = adminDb(admin);
let client: FirebaseApp;
const fixture = (id: string) => JOBS.find((j) => j.id === id)!;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const call = (name: string, data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), name)(data);

const read = async (id: string) => (await db.collection('jobs').doc(id).get()).data() as Job;

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'iv-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['ivops', 'ops'],
    ['ivsupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  for (const name of ['jobs', 'settings', 'auditLog'])
    await db.recursiveDelete(db.collection(name));
  for (const j of JOBS) await db.collection('jobs').doc(j.id).set(j);
  const settings = structuredClone(DEFAULT_APP_SETTINGS);
  settings.broadcast.windowMs = 120_000;
  await db.collection('settings').doc('app').set(settings);
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('interventions (emulator)', () => {
  it('rebroadcast writes only radiusKm and expiresAt, using the published window', async () => {
    await signInAs('ivops');
    const before = Date.now();
    await call('rebroadcastJob', { jobId: 'job_req_stale', radiusKm: 12, reason: 'No taker' });
    const job = await read('job_req_stale');
    const { radiusKm: _r, expiresAt: _e, ...rest } = job;
    const { radiusKm: _r0, expiresAt: _e0, ...original } = fixture('job_req_stale');
    expect(rest).toEqual(original);
    expect(job.radiusKm).toBe(12);
    const window = Date.parse(job.expiresAt) - before;
    expect(window).toBeGreaterThan(110_000);
    expect(window).toBeLessThan(130_000);
  });

  it('cancel writes the app’s own cancel fields with cancelledBy admin', async () => {
    await signInAs('ivops');
    await call('cancelJob', { jobId: 'job_enroute_late', reason: 'Mechanic unreachable' });
    const job = await read('job_enroute_late');
    const original = fixture('job_enroute_late');
    expect(job).toEqual({
      ...original,
      status: 'cancelled',
      cancelledBy: 'admin',
      timeline: [...original.timeline, { status: 'cancelled', at: expect.any(String) }],
    });
    const audit = await db.collection('auditLog').where('targetId', '==', 'job_enroute_late').get();
    expect(audit.docs.map((d) => d.data().action)).toEqual(['job.cancel']);
    const notes = await db.collection('jobs/job_enroute_late/supportNotes').get();
    expect(notes.docs.map((d) => d.data().kind)).toEqual(['intervention']);
  });

  it('respects the app state machine: no cancel once working', async () => {
    await signInAs('ivops');
    await expect(call('cancelJob', { jobId: 'job_working', reason: 'x' })).rejects.toMatchObject({
      code: 'functions/failed-precondition',
    });
    expect((await read('job_working')).status).toBe('working');
  });

  it('support cannot intervene', async () => {
    await signInAs('ivsupport');
    await expect(call('cancelJob', { jobId: 'job_req_stale', reason: 'x' })).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });
});
