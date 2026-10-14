import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { MECHANICS, PLACES } from '../../src/lib/mocks/contractFixtures';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'messages-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const send = (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), 'sendMechanicMessage')(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'messages-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['mops', 'ops'],
    ['msupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  for (const name of ['mechanics', 'opsMessages', 'auditLog']) {
    await db.recursiveDelete(db.collection(name));
  }
  for (const m of MECHANICS) {
    await db
      .collection('mechanics')
      .doc(m.userId)
      .set({ ...m, fcmToken: `token-${m.userId}` });
  }
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('sendMechanicMessage (emulator)', () => {
  it('writes the contract inbox copy for each verified mechanic nearby, the record and the audit', async () => {
    await signInAs('mops');
    const { data } = await send({
      title: 'Nakawa needs cover tonight',
      body: 'Requests near Nakawa are going unanswered after 6 pm.',
      audience: { kind: 'near', ...PLACES.nakawa, radiusKm: 3 },
    });
    // Okello (Kololo, ~2.9 km) and Namukasa (Nakawa) are verified and nearby; FCM is skipped
    // in the emulator.
    expect(data).toMatchObject({ recipients: 2, pushed: 0, withoutPush: 0 });
    const id = (data as { id: string }).id;
    for (const uid of ['u_mech_okello', 'u_mech_namukasa']) {
      const copy = (await db.doc(`mechanics/${uid}/inbox/${id}`).get()).data();
      expect(copy).toEqual({
        title: 'Nakawa needs cover tonight',
        body: 'Requests near Nakawa are going unanswered after 6 pm.',
        sentAt: expect.stringMatching(/^\d{4}-\d\d-\d\dT/),
        readAt: null,
      });
    }
    expect((await db.doc(`mechanics/u_mech_waiswa/inbox/${id}`).get()).exists).toBe(false);
    const record = (await db.doc(`opsMessages/${id}`).get()).data();
    expect(record).toMatchObject({
      audienceLabel: 'verified mechanics within 3 km of Nakawa, Jinja Road',
      recipientIds: ['u_mech_okello', 'u_mech_namukasa'].sort(),
      sentBy: 'mops',
    });
    const audit = await db
      .collection('auditLog')
      .where('action', '==', 'mechanic.message.send')
      .get();
    expect(audit.docs.map((d) => d.data().targetId)).toEqual([id]);
  });

  it('support cannot message mechanics', async () => {
    await signInAs('msupport');
    await expect(send({ title: 't', body: 'b', audience: { kind: 'verified' } })).rejects.toThrow(
      /cannot message/,
    );
  });
});
