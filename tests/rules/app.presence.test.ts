import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { setPresence } from './appClient';
import { anonymous, appUser, rulesEnv, setupRulesEnv } from './env';
import { UID } from './world';

beforeAll(setupRulesEnv);
afterAll(() => rulesEnv().cleanup());
beforeEach(async () => {
  await rulesEnv().clearFirestore();
});

describe('app path: presence/{uid}', () => {
  it('heartbeats with the server clock, viewing a job or not', async () => {
    const db = appUser(UID.customer);
    await assertSucceeds(setPresence(db, UID.customer, { online: true, viewingJobId: 'job_1' }));
    await assertSucceeds(setPresence(db, UID.customer, { online: false, viewingJobId: null }));
  });

  it('any signed-in user reads presence; anonymous cannot', async () => {
    await setPresence(appUser(UID.customer), UID.customer, { online: true, viewingJobId: null });
    await assertSucceeds(getDoc(doc(appUser(UID.mechanic), 'presence', UID.customer)));
    await assertFails(getDoc(doc(anonymous(), 'presence', UID.customer)));
  });

  it("rejects a client clock, extra keys, or someone else's presence", async () => {
    const db = appUser(UID.customer);
    const base = { userId: UID.customer, online: true, viewingJobId: null };
    await assertFails(setDoc(doc(db, 'presence', UID.customer), { ...base, lastSeen: new Date() }));
    await assertFails(
      setPresence(appUser(UID.mechanic), UID.customer, { online: true, viewingJobId: null }),
    );
    await assertFails(
      setDoc(doc(db, 'presence', UID.customer), { ...base, lastSeen: serverTimestamp(), extra: 1 }),
    );
  });
});
