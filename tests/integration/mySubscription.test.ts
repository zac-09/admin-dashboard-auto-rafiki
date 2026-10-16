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

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'mysub-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}
const fn = (name: string) => (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), name)(data);

const okello = MECHANICS.find((m) => m.userId === 'u_mech_okello')!;
const thisWeek = weekStartOf(new Date());

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'mysub-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  // An app user (no role claim) who is a verified mechanic, and an admin.
  for (const uid of ['u_mech_okello', 'u_mech_kato', 'badmin']) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
  }
  await adminAuth(admin).setCustomUserClaims('badmin', { role: 'admin' });
  for (const name of ['mechanics', 'subscriptions', 'auditLog', 'settings']) {
    await db.recursiveDelete(db.collection(name));
  }
  await db.doc('mechanics/u_mech_okello').set(okello);
  await db.doc('mechanics/u_mech_kato').set(MECHANICS.find((m) => m.userId === 'u_mech_kato')!);
  await db.doc(`subscriptions/u_mech_okello_${thisWeek}`).set({
    mechanicId: 'u_mech_okello',
    weekStart: thisWeek,
    amount: 15000,
    method: 'cash',
    reference: 'RCPT-SECRET',
    paidAt: new Date().toISOString(),
    recordedBy: 'staff-ops',
    recordedByEmail: 'ops@autorafiki.test',
  });
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('getMySubscription and updateBilling (emulator)', () => {
  it('the admin sets the numbers; a verified mechanic gets exactly the contract shape', async () => {
    await signInAs('badmin');
    await fn('updateBilling')({
      payTo: {
        numbers: [{ network: 'MTN', number: '0772 123 456', name: 'AutoRafiki Ltd' }],
        note: 'Use your phone number as the reference.',
      },
      reason: 'Company collection line',
    });

    await signInAs('u_mech_okello');
    const { data } = await fn('getMySubscription')({});
    const s = data as Record<string, unknown> & { weeks: Record<string, unknown>[] };
    expect(Object.keys(s).sort()).toEqual(
      [
        'weeklyFee',
        'overdueAfterDays',
        'suspensionAfterOverdueWeeks',
        'weeks',
        'owed',
        'overdueCount',
        'payTo',
        'computedAt',
      ].sort(),
    );
    expect(s.weeks[0]).toEqual({
      weekStart: thisWeek,
      status: 'paid',
      amount: 15000,
      paidAt: expect.any(String),
      method: 'cash',
    });
    for (const w of s.weeks) {
      expect(Object.keys(w).sort()).toEqual(['amount', 'method', 'paidAt', 'status', 'weekStart']);
    }
    expect(s.payTo).toEqual({
      numbers: [{ network: 'MTN', number: '+256772123456', name: 'AutoRafiki Ltd' }],
      note: 'Use your phone number as the reference.',
    });
    expect(JSON.stringify(s)).not.toMatch(/RCPT-SECRET|staff-ops|ops@autorafiki/);
  });

  it('a pending applicant owes nothing', async () => {
    await signInAs('u_mech_kato');
    const { data } = await fn('getMySubscription')({});
    expect(data).toMatchObject({ weeks: [], owed: 0, overdueCount: 0 });
  });

  it('an app user cannot change the numbers', async () => {
    await signInAs('u_mech_okello');
    await expect(fn('updateBilling')({ payTo: { numbers: [] }, reason: 'x' })).rejects.toThrow(
      /Only admins/,
    );
  });
});
