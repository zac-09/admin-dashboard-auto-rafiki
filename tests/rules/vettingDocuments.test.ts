import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from 'firebase/firestore';

import { anonymous, appUser, rulesEnv, seed, setupRulesEnv, staff } from './env';
import { baseWorld, UID } from './world';

/** Exactly what the app's nextRecord() writes (auto-rafiki src/lib/vetting.ts). */
const record = (uid: string, docType: string, version = 1, fileId = 'f1') => ({
  docType,
  storagePath: `vetting/${uid}/${docType}/${fileId}`,
  contentType: 'image/jpeg',
  sizeBytes: 240_000,
  uploadedAt: '2026-10-08T09:00:00.000Z',
  version,
});

const path = (uid: string, docType: string) => `mechanics/${uid}/vettingDocuments/${docType}`;

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
  await seed(baseWorld());
});

describe('app path: mechanics/{uid}/vettingDocuments/{docType}', () => {
  it('the mechanic records a first upload of each type, exactly as the app writes it', async () => {
    const db = appUser(UID.pendingMechanic);
    for (const t of ['national-id', 'certification', 'riding-permit']) {
      await assertSucceeds(
        setDoc(doc(db, path(UID.pendingMechanic, t)), record(UID.pendingMechanic, t)),
      );
    }
  });

  it('a re-upload is a setDoc with the next version and a new file: allowed', async () => {
    const db = appUser(UID.mechanic);
    await setDoc(doc(db, path(UID.mechanic, 'national-id')), record(UID.mechanic, 'national-id'));
    await assertSucceeds(
      setDoc(
        doc(db, path(UID.mechanic, 'national-id')),
        record(UID.mechanic, 'national-id', 2, 'f2'),
      ),
    );
  });

  it('rejects a version that does not advance by one, or starts above 1', async () => {
    const db = appUser(UID.mechanic);
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'national-id')), record(UID.mechanic, 'national-id', 2)),
    );
    await setDoc(doc(db, path(UID.mechanic, 'national-id')), record(UID.mechanic, 'national-id'));
    await assertFails(
      setDoc(
        doc(db, path(UID.mechanic, 'national-id')),
        record(UID.mechanic, 'national-id', 1, 'f2'),
      ),
    );
    await assertFails(
      setDoc(
        doc(db, path(UID.mechanic, 'national-id')),
        record(UID.mechanic, 'national-id', 3, 'f3'),
      ),
    );
  });

  it("rejects writing another mechanic's record, a path for another uid, or a mismatched type", async () => {
    const db = appUser(UID.mechanic);
    await assertFails(
      setDoc(
        doc(db, path(UID.otherMechanic, 'national-id')),
        record(UID.otherMechanic, 'national-id'),
      ),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'national-id')), {
        ...record(UID.mechanic, 'national-id'),
        storagePath: `vetting/${UID.otherMechanic}/national-id/f1`,
      }),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'national-id')), {
        ...record(UID.mechanic, 'national-id'),
        docType: 'certification',
      }),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'passport')), record(UID.mechanic, 'passport')),
    );
  });

  it('rejects any status or review field, a missing field, a bad type or size', async () => {
    const db = appUser(UID.mechanic);
    const base = record(UID.mechanic, 'certification');
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'certification')), { ...base, status: 'verified' }),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'certification')), { ...base, reviewed: true }),
    );
    const { sizeBytes: _s, ...missing } = base;
    await assertFails(setDoc(doc(db, path(UID.mechanic, 'certification')), missing));
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'certification')), { ...base, contentType: 'image/gif' }),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'certification')), {
        ...base,
        sizeBytes: 11 * 1024 * 1024,
      }),
    );
    await assertFails(
      setDoc(doc(db, path(UID.mechanic, 'certification')), { ...base, sizeBytes: 0 }),
    );
  });

  it('nobody deletes a record; the mechanic cannot patch one field in', async () => {
    const db = appUser(UID.mechanic);
    await setDoc(doc(db, path(UID.mechanic, 'national-id')), record(UID.mechanic, 'national-id'));
    await assertFails(deleteDoc(doc(db, path(UID.mechanic, 'national-id'))));
    await assertFails(
      updateDoc(doc(db, path(UID.mechanic, 'national-id')), { status: 'verified' }),
    );
    await assertFails(deleteDoc(doc(staff('admin'), path(UID.mechanic, 'national-id'))));
  });

  it('staff read the records; other app users and anonymous cannot', async () => {
    await setDoc(
      doc(appUser(UID.mechanic), path(UID.mechanic, 'national-id')),
      record(UID.mechanic, 'national-id'),
    );
    for (const role of ['admin', 'ops', 'support']) {
      await assertSucceeds(getDoc(doc(staff(role), path(UID.mechanic, 'national-id'))));
      await assertSucceeds(
        getDocs(collection(staff(role), `mechanics/${UID.mechanic}/vettingDocuments`)),
      );
    }
    await assertFails(getDoc(doc(appUser(UID.customer), path(UID.mechanic, 'national-id'))));
    await assertFails(getDoc(doc(anonymous(), path(UID.mechanic, 'national-id'))));
  });
});

describe('vettingReviews/{mechanicId} (dashboard-only)', () => {
  beforeEach(async () => {
    await seed({ [`vettingReviews/${UID.mechanic}`]: { 'national-id': { decision: 'verified' } } });
  });

  it('staff read; the mechanic, other app users and anonymous cannot', async () => {
    await assertSucceeds(getDoc(doc(staff('ops'), `vettingReviews/${UID.mechanic}`)));
    await assertFails(getDoc(doc(appUser(UID.mechanic), `vettingReviews/${UID.mechanic}`)));
    await assertFails(getDoc(doc(appUser(UID.customer), `vettingReviews/${UID.mechanic}`)));
    await assertFails(getDoc(doc(anonymous(), `vettingReviews/${UID.mechanic}`)));
  });

  it('nobody writes reviews directly, not even admins (the callable does)', async () => {
    await assertFails(
      setDoc(doc(staff('admin'), `vettingReviews/${UID.mechanic}`), {
        'national-id': { decision: 'rejected' },
      }),
    );
    await assertFails(
      setDoc(doc(appUser(UID.mechanic), `vettingReviews/${UID.mechanic}`), {
        'national-id': { decision: 'verified' },
      }),
    );
  });
});
