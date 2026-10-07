import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { DEFAULT_APP_SETTINGS } from '../../src/lib/appSettings';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'settings-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const publish = (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), 'updateSettings')(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'settings-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['setadmin', 'admin'],
    ['setops', 'ops'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  await db.recursiveDelete(db.collection('settings'));
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('updateSettings (emulator)', () => {
  it('an admin publishes: settings/app holds exactly the app contract, audited', async () => {
    await signInAs('setadmin');
    const next = structuredClone(DEFAULT_APP_SETTINGS);
    next.prices.battery = 40_000;
    next.broadcast.expandedRadiusKm = 12;
    const { data } = (await publish({ settings: next, reason: 'Battery up, wider search' })) as {
      data: { changes: string[] };
    };
    expect(data.changes).toEqual([
      'Dead battery: UGX 35,000 → UGX 40,000',
      'Widened radius: 8 km → 12 km',
    ]);
    const stored = (await db.collection('settings').doc('app').get()).data();
    expect(stored).toEqual({ ...next, updatedAt: expect.any(String), updatedBy: 'setadmin' });
    const audit = await db.collection('auditLog').where('action', '==', 'settings.update').get();
    expect(audit.size).toBe(1);
  });

  it('refuses values the app would reject; the document is unchanged', async () => {
    await signInAs('setadmin');
    const bad = structuredClone(DEFAULT_APP_SETTINGS);
    bad.broadcast.expandedRadiusKm = 40;
    await expect(publish({ settings: bad, reason: 'x' })).rejects.toMatchObject({
      code: 'functions/invalid-argument',
    });
    expect(
      (await db.collection('settings').doc('app').get()).data()?.broadcast.expandedRadiusKm,
    ).toBe(12);
  });

  it('ops cannot publish settings', async () => {
    await signInAs('setops');
    await expect(publish({ settings: DEFAULT_APP_SETTINGS, reason: 'x' })).rejects.toMatchObject({
      code: 'functions/permission-denied',
    });
  });
});
