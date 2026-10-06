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

const admin = initAdmin({ projectId: PROJECT_ID }, 'integration-admin');
let client: FirebaseApp;

async function createStaff(uid: string, role?: string, phoneNumber?: string) {
  await adminAuth(admin).createUser({
    uid,
    email: phoneNumber ? undefined : `${uid}@autorafiki.test`,
    password: phoneNumber ? undefined : PASSWORD,
    phoneNumber,
  });
  if (role) await adminAuth(admin).setCustomUserClaims(uid, { role });
}

async function callAs(uid: string, data: unknown) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
  return httpsCallable(getFunctions(client, 'europe-west1'), 'setUserRole')(data);
}

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'integration-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  await createStaff('boss', 'admin');
  await createStaff('opsy', 'ops');
  await createStaff('helper', 'support');
  await createStaff('newhire');
  await createStaff('appuser', undefined, '+256772000001');
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('setUserRole callable (emulator)', () => {
  it('an admin grants a role: the claim is set and the change is audited', async () => {
    const result = await callAs('boss', {
      email: 'newhire@autorafiki.test',
      role: 'support',
      reason: 'Hired',
    });
    expect(result.data).toEqual({ uid: 'newhire', role: 'support', changed: true });
    expect((await adminAuth(admin).getUser('newhire')).customClaims).toEqual({ role: 'support' });
    const audit = await adminDb(admin)
      .collection('auditLog')
      .where('targetId', '==', 'newhire')
      .get();
    expect(audit.docs.map((d) => d.data())).toEqual([
      expect.objectContaining({
        action: 'staff.role.set',
        actorUid: 'boss',
        before: null,
        after: 'support',
        reason: 'Hired',
      }),
    ]);
  });

  it('support and ops cannot change roles', async () => {
    for (const uid of ['helper', 'opsy']) {
      await expect(
        callAs(uid, { uid: 'newhire', role: 'admin', reason: 'x' }),
      ).rejects.toMatchObject({
        code: 'functions/permission-denied',
      });
    }
    expect((await adminAuth(admin).getUser('newhire')).customClaims).toEqual({ role: 'support' });
  });

  it('an admin cannot give an app (phone) account a dashboard role', async () => {
    await expect(
      callAs('boss', { uid: 'appuser', role: 'ops', reason: 'x' }),
    ).rejects.toMatchObject({
      code: 'functions/failed-precondition',
    });
  });

  it('signed-out callers are rejected', async () => {
    await signOut(getAuth(client));
    await expect(
      httpsCallable(
        getFunctions(client, 'europe-west1'),
        'setUserRole',
      )({ uid: 'newhire', role: 'admin', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'functions/unauthenticated' });
  });
});
