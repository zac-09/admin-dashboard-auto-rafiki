/**
 * Loads the emulator with staff accounts and contract-shaped app data, so the dashboard runs
 * against real Firestore listeners with VITE_USE_MOCKS=false. EMULATOR ONLY: refuses to run
 * unless both emulator hosts are set and the project is a demo-* project.
 *
 *   npm run emulators        # terminal 1
 *   npm run seed:emulator    # terminal 2
 *
 * Staff: admin@ / ops@ / support@autorafiki.test, password MOCK_PASSWORD (src/lib/mocks).
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import {
  JOBS,
  MECHANICS,
  MESSAGES,
  RATINGS,
  USERS,
  FIXTURE_NOW,
  shiftIso,
  shiftJob,
} from '../src/lib/mocks/contractFixtures';
import { AUDIT_ENTRIES } from '../src/lib/mocks/auditFixtures';
import { DISPUTES_FIXTURE, NOTES_FIXTURE } from '../src/lib/mocks/supportFixtures';
import { MOCK_APP_USER, MOCK_PASSWORD, MOCK_STAFF } from '../src/lib/mocks/fixtures';
import { AUDIT_COLLECTION, COLLECTIONS, DISPUTES, SUPPORT_NOTES } from '../src/types';

const projectId = process.env.GCLOUD_PROJECT ?? 'demo-autorafiki';
if (
  !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
  !process.env.FIRESTORE_EMULATOR_HOST ||
  !projectId.startsWith('demo-')
) {
  console.error('seed-emulator: emulator only (set both emulator hosts; demo-* project).');
  process.exit(1);
}

initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();

async function upsertStaff(uid: string, email: string, displayName: string | null, role?: string) {
  try {
    await auth.deleteUser(uid);
  } catch {
    // not there yet
  }
  await auth.createUser({
    uid,
    email,
    password: MOCK_PASSWORD,
    displayName: displayName ?? undefined,
  });
  if (role) await auth.setCustomUserClaims(uid, { role });
}

for (const s of MOCK_STAFF) await upsertStaff(s.uid, s.email, s.displayName, s.role);
// An email account with no role: signs in, gets "no dashboard access".
await upsertStaff(MOCK_APP_USER.uid, MOCK_APP_USER.email, MOCK_APP_USER.displayName);

const batch = db.batch();
for (const u of USERS) {
  batch.set(db.collection(COLLECTIONS.users).doc(u.id), u);
  batch.set(db.collection(COLLECTIONS.profiles).doc(u.id), {
    id: u.id,
    displayName: u.displayName,
  });
}
for (const m of MECHANICS) batch.set(db.collection(COLLECTIONS.mechanics).doc(m.userId), m);
// Shift fixture times so FIXTURE_NOW is now: the board's elapsed times and alerts look live.
const offset = Date.now() - FIXTURE_NOW.getTime();
for (const j of JOBS) batch.set(db.collection(COLLECTIONS.jobs).doc(j.id), shiftJob(j, offset));
for (const r of RATINGS) {
  batch.set(db.collection(COLLECTIONS.ratings).doc(r.id), {
    ...r,
    createdAt: shiftIso(r.createdAt, offset),
  });
}
for (const msg of MESSAGES) {
  batch.set(
    db.collection(COLLECTIONS.jobs).doc(msg.jobId).collection(COLLECTIONS.messages).doc(msg.id),
    msg,
  );
}
batch.set(db.collection(COLLECTIONS.presence).doc('u_customer_aisha'), {
  userId: 'u_customer_aisha',
  online: true,
  lastSeen: FieldValue.serverTimestamp(),
  viewingJobId: 'job_enroute_late',
});
for (const { id, ...entry } of AUDIT_ENTRIES) {
  batch.set(db.collection(AUDIT_COLLECTION).doc(id), entry);
}
for (const d of DISPUTES_FIXTURE) {
  batch.set(db.collection(DISPUTES).doc(d.jobId), { ...d, openedAt: shiftIso(d.openedAt, offset) });
}
NOTES_FIXTURE.forEach((n, i) => {
  batch.set(
    db
      .collection(COLLECTIONS.jobs)
      .doc(n.jobId)
      .collection(SUPPORT_NOTES)
      .doc(`note_${i + 1}`),
    { ...n, createdAt: shiftIso(n.createdAt, offset) },
  );
});
await batch.commit();

console.log(
  `Seeded ${projectId}: ${MOCK_STAFF.length} staff, ${USERS.length} users, ${MECHANICS.length} mechanics, ${JOBS.length} jobs.`,
);
