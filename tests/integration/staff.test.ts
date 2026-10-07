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

const admin = initAdmin({ projectId: PROJECT_ID }, 'staff-admin');
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const call = (name: string, data?: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), name)(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'staff-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['boss', 'admin'],
    ['opsy', 'ops'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  await adminAuth(admin).createUser({ uid: 'appuser', phoneNumber: '+256772000009' });
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('staff callables (emulator)', () => {
  it('an admin invites: account created with the role, setup link returned, audited', async () => {
    await signInAs('boss');
    const { data } = (await call('inviteStaff', {
      email: 'Grace@AutoRafiki.test',
      displayName: 'Grace Achieng',
      role: 'support',
      reason: 'New support hire',
    })) as { data: { uid: string; created: boolean; setupLink: string } };
    expect(data.created).toBe(true);
    expect(data.setupLink).toMatch(/mode=resetPassword/);
    const user = await adminAuth(admin).getUserByEmail('grace@autorafiki.test');
    expect(user.customClaims).toEqual({ role: 'support' });
    expect(user.displayName).toBe('Grace Achieng');
    const audit = await adminDb(admin)
      .collection('auditLog')
      .where('action', '==', 'staff.invite')
      .where('targetId', '==', user.uid)
      .get();
    expect(audit.size).toBe(1);
  });

  it('lists email accounts with roles, never phone (app) accounts', async () => {
    await signInAs('boss');
    const { data } = (await call('listStaff')) as {
      data: { email: string; role: string | null }[];
    };
    expect(data.map((m) => [m.email, m.role])).toEqual([
      ['boss@autorafiki.test', 'admin'],
      ['opsy@autorafiki.test', 'ops'],
      ['grace@autorafiki.test', 'support'],
    ]);
  });

  it('ops can neither list nor invite staff', async () => {
    await signInAs('opsy');
    await expect(call('listStaff')).rejects.toMatchObject({ code: 'functions/permission-denied' });
    await expect(
      call('inviteStaff', { email: 'x@autorafiki.test', role: 'admin', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
  });

  it('inviting existing staff is refused (change their role instead)', async () => {
    await signInAs('boss');
    await expect(
      call('inviteStaff', { email: 'opsy@autorafiki.test', role: 'admin', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'functions/already-exists' });
  });
});
