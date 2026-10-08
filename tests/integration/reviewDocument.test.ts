import { deleteApp as deleteAdminApp, initializeApp as initAdmin } from 'firebase-admin/app';
import { getAuth as adminAuth } from 'firebase-admin/auth';
import { getFirestore as adminDb } from 'firebase-admin/firestore';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

import { MECHANICS } from '../../src/lib/mocks/contractFixtures';

const PROJECT_ID = 'demo-autorafiki';
const PASSWORD = 'password123';

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run with `npm run test:emulator` (auth, firestore and functions emulators).');
}

const admin = initAdmin({ projectId: PROJECT_ID }, 'review-admin');
const db = adminDb(admin);
let client: FirebaseApp;

/** The record the app writes after an upload (its exact six fields). */
const uploaded = (uid: string, docType: string, version = 1) => ({
  docType,
  storagePath: `vetting/${uid}/${docType}/file-${version}`,
  contentType: 'image/jpeg',
  sizeBytes: 240000,
  uploadedAt: '2026-10-08T09:00:00.000Z',
  version,
});

async function signInAs(uid: string) {
  const auth = getAuth(client);
  await signOut(auth);
  await signInWithEmailAndPassword(auth, `${uid}@autorafiki.test`, PASSWORD);
}

const review = (data: unknown) =>
  httpsCallable(getFunctions(client, 'europe-west1'), 'reviewDocument')(data);

beforeAll(async () => {
  client = initializeApp({ projectId: PROJECT_ID, apiKey: 'demo-key' }, 'review-client');
  connectAuthEmulator(getAuth(client), `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  });
  connectFunctionsEmulator(getFunctions(client, 'europe-west1'), '127.0.0.1', 5001);
  const { users } = await adminAuth(admin).listUsers();
  await adminAuth(admin).deleteUsers(users.map((u) => u.uid));
  for (const [uid, role] of [
    ['rops', 'ops'],
    ['rsupport', 'support'],
  ] as const) {
    await adminAuth(admin).createUser({ uid, email: `${uid}@autorafiki.test`, password: PASSWORD });
    await adminAuth(admin).setCustomUserClaims(uid, { role });
  }
  for (const name of ['mechanics', 'vettingReviews', 'auditLog']) {
    await db.recursiveDelete(db.collection(name));
  }
  for (const m of MECHANICS) await db.collection('mechanics').doc(m.userId).set(m);
  await db
    .collection('mechanics')
    .doc('u_mech_ssempala')
    .collection('vettingDocuments')
    .doc('national-id')
    .set(uploaded('u_mech_ssempala', 'national-id', 2));
});

afterAll(async () => {
  await deleteApp(client);
  await deleteAdminApp(admin);
});

describe('reviewDocument (emulator)', () => {
  it('ops verifies an uploaded document: the review names the file, audited', async () => {
    await signInAs('rops');
    await review({
      mechanicId: 'u_mech_ssempala',
      docType: 'national-id',
      decision: 'verified',
      reason: 'Seen in person',
    });
    const reviews = (await db.collection('vettingReviews').doc('u_mech_ssempala').get()).data();
    expect(reviews?.['national-id']).toMatchObject({
      decision: 'verified',
      storagePath: 'vetting/u_mech_ssempala/national-id/file-2',
      version: 2,
      reviewedBy: 'rops',
      reviewedByRole: 'ops',
    });
    const audit = await db
      .collection('auditLog')
      .where('action', '==', 'mechanic.document.review')
      .get();
    expect(audit.docs.map((d) => d.data().targetLabel)).toEqual([
      'Ssempala Boda Fix: National ID v2',
    ]);
    // The app-owned record is untouched: no status crept in.
    const record = (
      await db.collection('mechanics/u_mech_ssempala/vettingDocuments').doc('national-id').get()
    ).data();
    expect(record).toEqual(uploaded('u_mech_ssempala', 'national-id', 2));
  });

  it('a document that was never uploaded cannot be reviewed', async () => {
    await signInAs('rops');
    await expect(
      review({
        mechanicId: 'u_mech_ssempala',
        docType: 'riding-permit',
        decision: 'verified',
        reason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  });

  it('support cannot review', async () => {
    await signInAs('rsupport');
    await expect(
      review({
        mechanicId: 'u_mech_ssempala',
        docType: 'national-id',
        decision: 'rejected',
        reason: 'x',
      }),
    ).rejects.toMatchObject({ code: 'functions/permission-denied' });
  });
});
