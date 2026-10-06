import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { MECHANICS } from '../../src/lib/mocks/contractFixtures';
import { ASSESSMENT_CHECKLIST } from '../../src/lib/vetting';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';
const ALL = ASSESSMENT_CHECKLIST.map((i) => i.id);

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'vetting-admin');
let client: FirebaseApp;

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const decide = (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), 'decideVetting')(data);

async function mechanic(id: string) {
  return (await adminDb(admin).collection('mechanics').doc(id).get()).data();
}

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'vetting-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(':');
  connectFirestoreEmulator(getFirestore(client), host!, Number(port));
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);

  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['vadmin', 'admin'],
    ['vops', 'ops'],
    ['vsupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  const db = adminDb(admin);
  await db.recursiveDelete(db.collection('auditLog'));
  for (const m of MECHANICS) await db.collection('mechanics').doc(m.userId).set(m);
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('decideVetting callable (emulator)', () => {
  it('an admin approves a real-shaped pending mechanic; vetting and audit land together', async () => {
    await signInAs('vadmin');
    const result = await decide({
      mechanicId: 'u_mech_ssempala',
      decision: 'approve',
      reason: 'Passed the practical',
      checklist: ALL,
    });
    expect(result.data).toEqual({
      mechanicId: 'u_mech_ssempala',
      vetting: 'verified',
      changed: true,
    });
    const after = await mechanic('u_mech_ssempala');
    // Only `vetting` changed; every app-owned field is untouched.
    const original = MECHANICS.find((m) => m.userId === 'u_mech_ssempala')!;
    expect(after).toEqual({ ...original, vetting: 'verified' });

    // The dashboard's own audit query (needs the targetType + at index in production).
    const entries = await getDocs(
      query(
        collection(getFirestore(client), 'auditLog'),
        where('targetType', '==', 'mechanic'),
        orderBy('at', 'desc'),
      ),
    );
    expect(entries.docs.map((d) => d.data())).toEqual([
      expect.objectContaining({
        action: 'mechanic.vetting.approve',
        actorUid: 'vadmin',
        actorRole: 'admin',
        targetId: 'u_mech_ssempala',
        targetLabel: 'Ssempala Boda Fix',
        before: 'pending',
        after: 'verified',
        checklist: ALL,
      }),
    ]);
  });

  it('ops rejects: the applicant stays pending, the rejection is audited', async () => {
    await signInAs('vops');
    await decide({ mechanicId: 'u_mech_kato', decision: 'reject', reason: 'No battery tester' });
    expect((await mechanic('u_mech_kato'))?.vetting).toBe('pending');
    const audit = await adminDb(admin)
      .collection('auditLog')
      .where('targetId', '==', 'u_mech_kato')
      .get();
    expect(audit.docs.map((d) => d.data().action)).toEqual(['mechanic.vetting.reject']);
  });

  it('support cannot decide, and nothing is written', async () => {
    await signInAs('vsupport');
    await expect(
      decide({ mechanicId: 'u_mech_okello', decision: 'suspend', reason: 'x' }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
    expect((await mechanic('u_mech_okello'))?.vetting).toBe('verified');
  });

  it('a decision that does not apply is refused without an audit entry', async () => {
    await signInAs('vadmin');
    await expect(
      decide({ mechanicId: 'u_mech_waiswa', decision: 'suspend', reason: 'again' }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' });
    const audit = await adminDb(admin)
      .collection('auditLog')
      .where('targetId', '==', 'u_mech_waiswa')
      .get();
    expect(audit.size).toBe(0);
  });

  it('even an admin cannot set vetting directly from the client', async () => {
    await signInAs('vadmin');
    await expect(
      updateDoc(doc(getFirestore(client), 'mechanics', 'u_mech_kato'), { vetting: 'verified' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
