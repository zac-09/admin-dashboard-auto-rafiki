import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'handover-admin');
const db = adminDb(admin);
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}
const fn = (name: string) => (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), name)(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'handover-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['hsupport', 'support'],
    ['hops', 'ops'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  await adminAuth(admin).createUser({
    uid: 'happ',
    email: 'happ@autorafiki.test',
    password: PASSWORD,
  });
  await db.recursiveDelete(db.collection('handoverNotes'));
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('handover notes (emulator)', () => {
  it('support adds a note, ops marks it handled once; app users cannot write', async () => {
    await signInAs('hsupport');
    const { data } = await fn('addHandoverNote')({ text: 'Watch job_x', jobId: 'job_x' });
    const id = (data as { id: string }).id;
    expect((await db.doc(`handoverNotes/${id}`).get()).data()).toMatchObject({
      text: 'Watch job_x',
      jobId: 'job_x',
      authorUid: 'hsupport',
      authorRole: 'support',
      handledAt: null,
    });
    await signInAs('hops');
    await fn('markHandoverHandled')({ id });
    expect((await db.doc(`handoverNotes/${id}`).get()).data()).toMatchObject({
      handledBy: 'hops',
      handledByEmail: 'hops@autorafiki.test',
    });
    await expect(fn('markHandoverHandled')({ id })).rejects.toThrow(/already/);
    await signInAs('happ');
    await expect(fn('addHandoverNote')({ text: 'x' })).rejects.toThrow(/staff/);
  });
});
