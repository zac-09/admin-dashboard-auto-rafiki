import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  deleteObject,
  getBytes,
  ref,
  uploadBytes,
  uploadString,
  updateMetadata,
} from 'firebase/storage';

import { anonymousStorage, appUserStorage, rulesEnv, setupRulesEnv, staffStorage } from './env';
import { UID } from './world';

const skip = !process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const describeStorage = skip ? describe.skip : describe;

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
/** Exactly what the app's putFile sets (auto-rafiki firebaseVettingDocumentsRepository.ts). */
const meta = (mechanicId: string, docType: string, contentType = 'image/jpeg') => ({
  contentType,
  customMetadata: { mechanicId, docType },
});
/**
 * A fresh file id per call, as the app's upload does (a new UUID per upload). Fixtures must
 * never share an object: the rule refuses overwrites, so a reused path would fail setup in a
 * later test and hide what is actually under test.
 */
let seq = 0;
const objectPath = (uid: string, docType: string, fileId = `file-${++seq}`) =>
  `vetting/${uid}/${docType}/${fileId}`;

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  if (!skip) await rulesEnv().clearStorage();
});

describeStorage('Storage: vetting/{mechanicId}/{docType}/{fileId}', () => {
  it('the mechanic uploads each document type under their own uid, as the app does', async () => {
    const s = appUserStorage(UID.mechanic);
    for (const t of ['national-id', 'certification', 'riding-permit']) {
      await assertSucceeds(
        uploadBytes(ref(s, objectPath(UID.mechanic, t)), jpeg, meta(UID.mechanic, t)),
      );
    }
    await assertSucceeds(
      uploadString(
        ref(s, objectPath(UID.mechanic, 'certification')),
        '%PDF-1.4',
        'raw',
        meta(UID.mechanic, 'certification', 'application/pdf'),
      ),
    );
  });

  it("rejects uploading under another mechanic's uid, a wrong type, or lying metadata", async () => {
    const s = appUserStorage(UID.mechanic);
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.otherMechanic, 'national-id')),
        jpeg,
        meta(UID.otherMechanic, 'national-id'),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.mechanic, 'passport')),
        jpeg,
        meta(UID.mechanic, 'passport'),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.mechanic, 'national-id')),
        jpeg,
        meta(UID.otherMechanic, 'national-id'),
      ),
    );
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.mechanic, 'national-id')),
        jpeg,
        meta(UID.mechanic, 'certification'),
      ),
    );
    await assertFails(
      uploadBytes(ref(s, objectPath(UID.mechanic, 'national-id')), jpeg, {
        contentType: 'image/jpeg',
      }),
    );
  });

  it('rejects a disallowed content type and an over-size file', async () => {
    const s = appUserStorage(UID.mechanic);
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.mechanic, 'national-id')),
        jpeg,
        meta(UID.mechanic, 'national-id', 'image/gif'),
      ),
    );
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    await assertFails(
      uploadBytes(
        ref(s, objectPath(UID.mechanic, 'national-id', 'big')),
        big,
        meta(UID.mechanic, 'national-id'),
      ),
    );
  });

  it('an object is never overwritten, updated or deleted, by anyone', async () => {
    const s = appUserStorage(UID.mechanic);
    // One object for the whole test: the path is computed once and shared.
    const shared = objectPath(UID.mechanic, 'national-id');
    const r = ref(s, shared);
    await uploadBytes(r, jpeg, meta(UID.mechanic, 'national-id'));
    await assertFails(uploadBytes(r, jpeg, meta(UID.mechanic, 'national-id')));
    await assertFails(
      updateMetadata(r, {
        customMetadata: { mechanicId: UID.mechanic, docType: 'national-id', x: '1' },
      }),
    );
    await assertFails(deleteObject(r));
    await assertFails(deleteObject(ref(staffStorage('admin'), shared)));
  });

  it('staff read documents; other app users, the uploader elsewhere, and anonymous cannot', async () => {
    // One object read by everyone: the path is computed once and shared.
    const shared = objectPath(UID.mechanic, 'national-id');
    await uploadBytes(
      ref(appUserStorage(UID.mechanic), shared),
      jpeg,
      meta(UID.mechanic, 'national-id'),
    );
    for (const role of ['admin', 'ops', 'support']) {
      await assertSucceeds(getBytes(ref(staffStorage(role), shared)));
    }
    await assertFails(getBytes(ref(appUserStorage(UID.customer), shared)));
    await assertFails(getBytes(ref(anonymousStorage(), shared)));
  });

  it('nothing outside vetting/ is reachable', async () => {
    await assertFails(uploadBytes(ref(appUserStorage(UID.mechanic), 'other/file'), jpeg));
    await assertFails(getBytes(ref(staffStorage('admin'), 'other/file')));
  });
});
