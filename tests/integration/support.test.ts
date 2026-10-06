import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { JOBS, MECHANICS } from '../../src/lib/mocks/contractFixtures';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'support-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const call = (name: string, data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), name)(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'support-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['sadmin', 'admin'],
    ['ssupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  for (const name of ['jobs', 'mechanics', 'disputes', 'auditLog']) {
    await db.recursiveDelete(db.collection(name));
  }
  for (const m of MECHANICS) await db.collection('mechanics').doc(m.userId).set(m);
  for (const j of JOBS) await db.collection('jobs').doc(j.id).set(j);
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('support callables (emulator)', () => {
  it('support adds a note: stored under the job, nothing else touched', async () => {
    await signInAs('ssupport');
    await call('addSupportNote', { jobId: 'job_enroute_late', text: 'Called the customer' });
    const notes = await db.collection('jobs/job_enroute_late/supportNotes').get();
    expect(notes.docs.map((d) => d.data())).toEqual([
      expect.objectContaining({ kind: 'note', text: 'Called the customer', authorUid: 'ssupport' }),
    ]);
    const job = (await db.collection('jobs').doc('job_enroute_late').get()).data();
    expect(job).toEqual(JOBS.find((j) => j.id === 'job_enroute_late'));
  });

  it('flags a dispute with the job label and parties, audited', async () => {
    await signInAs('ssupport');
    await call('flagDispute', { jobId: 'job_complete', reason: 'Battery died again' });
    const dispute = (await db.collection('disputes').doc('job_complete').get()).data();
    expect(dispute).toMatchObject({
      status: 'open',
      customerId: 'u_customer_aisha',
      mechanicId: 'u_mech_okello',
      jobLabel: 'Dead battery, Nakawa, Jinja Road',
    });
    await expect(
      call('flagDispute', { jobId: 'job_complete', reason: 'again' }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  });

  it('support cannot resolve with a suspension; nothing changes', async () => {
    await signInAs('ssupport');
    await expect(
      call('resolveDispute', { jobId: 'job_complete', outcome: 'mechanic-suspended', note: 'x' }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect((await db.collection('disputes').doc('job_complete').get()).data()?.status).toBe('open');
    expect((await db.collection('mechanics').doc('u_mech_okello').get()).data()?.vetting).toBe(
      'verified',
    );
  });

  it('an admin resolves with a suspension: dispute, mechanic and audit land together', async () => {
    await signInAs('sadmin');
    await call('resolveDispute', {
      jobId: 'job_complete',
      outcome: 'mechanic-suspended',
      note: 'Second complaint',
    });
    expect((await db.collection('disputes').doc('job_complete').get()).data()).toMatchObject({
      status: 'resolved',
      resolution: { outcome: 'mechanic-suspended', note: 'Second complaint', resolvedBy: 'sadmin' },
    });
    const okello = (await db.collection('mechanics').doc('u_mech_okello').get()).data();
    expect(okello).toEqual({
      ...MECHANICS.find((m) => m.userId === 'u_mech_okello'),
      vetting: 'suspended',
    });
    const audit = await db.collection('auditLog').get();
    expect(audit.docs.map((d) => d.data().action).sort()).toEqual([
      'job.dispute.open',
      'job.dispute.resolve',
      'mechanic.vetting.suspend',
    ]);
    const notes = await db.collection('jobs/job_complete/supportNotes').get();
    expect(notes.docs.map((d) => d.data().kind).sort()).toEqual([
      'dispute-opened',
      'dispute-resolved',
    ]);
  });

  it('unknown jobs are refused', async () => {
    await signInAs('sadmin');
    await expect(call('addSupportNote', { jobId: 'nope', text: 'x' })).rejects.toMatchObject({
      code: 'functions/not-found',
    });
  });
});
