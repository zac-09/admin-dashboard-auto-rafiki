import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { MECHANICS } from '../../src/lib/mocks/contractFixtures';
import { weekStartOf } from '../../src/lib/subscriptions';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';
const WEEK = weekStartOf(new Date());

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'subs-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const markPaid = (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), 'markSubscriptionPaid')(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'subs-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['pops', 'ops'],
    ['psupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  for (const name of ['mechanics', 'subscriptions', 'auditLog']) {
    await db.recursiveDelete(db.collection(name));
  }
  for (const m of MECHANICS) await db.collection('mechanics').doc(m.userId).set(m);
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('markSubscriptionPaid (emulator)', () => {
  it('ops records this week for a verified mechanic: payment and audit together', async () => {
    await signInAs('pops');
    await markPaid({
      mechanicId: 'u_mech_okello',
      weekStart: WEEK,
      method: 'cash',
      reference: 'R1',
    });
    const payment = (
      await db.collection('subscriptions').doc(`u_mech_okello_${WEEK}`).get()
    ).data();
    expect(payment).toMatchObject({
      mechanicId: 'u_mech_okello',
      weekStart: WEEK,
      amount: 15000,
      method: 'cash',
      reference: 'R1',
      recordedBy: 'pops',
    });
    const audit = await db.collection('auditLog').where('action', '==', 'subscription.paid').get();
    expect(audit.size).toBe(1);
  });

  it('a week can only be paid once', async () => {
    await signInAs('pops');
    await expect(
      markPaid({ mechanicId: 'u_mech_okello', weekStart: WEEK, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'functions/already-exists' });
  });

  it('a pending mechanic does not owe, so nothing is recorded', async () => {
    await signInAs('pops');
    await expect(
      markPaid({ mechanicId: 'u_mech_kato', weekStart: WEEK, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    expect((await db.collection('subscriptions').doc(`u_mech_kato_${WEEK}`).get()).exists).toBe(
      false,
    );
  });

  it('support cannot record payments', async () => {
    await signInAs('psupport');
    await expect(
      markPaid({ mechanicId: 'u_mech_namukasa', weekStart: WEEK, method: 'cash' }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
  });
});
